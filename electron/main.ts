import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import net from 'net'
import os from 'os'
import fs from 'fs'
import { execFileSync } from 'child_process'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Environment ───────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

// ─── PTY State ─────────────────────────────────────────────────────────────────
let ptyProcess: any = null
let mainWindow: BrowserWindow | null = null

// ─── Shell Resolution ──────────────────────────────────────────────────────────
/**
 * Returns a verified absolute path to an executable shell.
 *
 * Strategy (in order):
 *   1. $SHELL env var — but only if it is an absolute path AND the file exists
 *      and is executable. Electron on macOS sometimes inherits a stripped env
 *      where $SHELL is set to a non-existent path (e.g. from a GUI launch).
 *   2. Read /etc/passwd for the current user's login shell.
 *   3. Walk a hardcoded priority list of known macOS / Linux shell paths.
 *   4. Last resort: /bin/sh (POSIX guaranteed).
 */
function resolveShell(): string {
  // ── Candidate list (macOS arm64 first, then common Linux paths) ────────────
  const candidates: string[] = []

  // 1. $SHELL — validate before trusting
  const envShell = process.env.SHELL
  if (envShell && path.isAbsolute(envShell)) {
    candidates.push(envShell)
  }

  // 2. /etc/passwd lookup (synchronous, fast, reliable on macOS)
  try {
    const passwd = fs.readFileSync('/etc/passwd', 'utf8')
    const uid = process.getuid ? process.getuid() : -1
    if (uid >= 0) {
      for (const line of passwd.split('\n')) {
        const parts = line.split(':')
        // passwd format: name:password:uid:gid:gecos:home:shell
        if (parts.length >= 7 && parseInt(parts[2], 10) === uid) {
          const passwdShell = parts[6].trim()
          if (passwdShell && path.isAbsolute(passwdShell)) {
            candidates.push(passwdShell)
          }
          break
        }
      }
    }
  } catch {
    // /etc/passwd not readable — skip
  }

  // 3. Hardcoded known-good paths (macOS arm64 + x64 + Linux)
  candidates.push(
    '/bin/zsh',          // macOS default since Catalina
    '/usr/bin/zsh',      // some Linux distros
    '/opt/homebrew/bin/zsh', // Homebrew arm64
    '/usr/local/bin/zsh',    // Homebrew x64
    '/bin/bash',
    '/usr/bin/bash',
    '/opt/homebrew/bin/bash',
    '/usr/local/bin/bash',
    '/bin/sh',           // POSIX fallback — always exists
  )

  // ── Verify each candidate ─────────────────────────────────────────────────
  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate)
      // Must be a regular file (or symlink to one) and executable
      if (stat.isFile() || stat.isSymbolicLink()) {
        // Check execute bit: mode & 0o111
        if ((stat.mode & 0o111) !== 0) {
          console.log(`[VoidShell] Shell resolved: ${candidate}`)
          return candidate
        }
      }
    } catch {
      // File doesn't exist or stat failed — try next
    }
  }

  // Should never reach here on any POSIX system
  console.error('[VoidShell] No valid shell found! Falling back to /bin/sh')
  return '/bin/sh'
}

/**
 * Build a clean environment object for the PTY process.
 *
 * node-pty's posix_spawnp will fail if the env object contains:
 *   - undefined values (serialised as the string "undefined")
 *   - null values
 *   - non-string values
 *   - keys with = characters
 *
 * This function sanitises every entry.
 */
function buildPtyEnv(shellBin: string): Record<string, string> {
  const env: Record<string, string> = {}

  // Copy process.env, skipping any non-string values
  for (const [key, value] of Object.entries(process.env)) {
    if (
      typeof key   === 'string' && key.length > 0 &&
      typeof value === 'string' &&
      !key.includes('=')   // POSIX: env key must not contain '='
    ) {
      env[key] = value
    }
  }

  // ── Override / augment critical variables ──────────────────────────────────

  // Build a comprehensive PATH that covers Homebrew arm64, Homebrew x64,
  // system paths, and whatever was already in the environment.
  const pathSegments = [
    '/opt/homebrew/bin',       // Homebrew arm64 (M-series)
    '/opt/homebrew/sbin',
    '/usr/local/bin',          // Homebrew x64 / manual installs
    '/usr/local/sbin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    `${os.homedir()}/.cargo/bin`,   // Rust
    `${os.homedir()}/.local/bin`,   // pipx / user installs
    env.PATH || '',
  ]
  // Deduplicate while preserving order
  const seenPaths = new Set<string>()
  const dedupedPath = pathSegments
    .flatMap(p => p.split(':'))
    .filter(p => {
      if (!p || seenPaths.has(p)) return false
      seenPaths.add(p)
      return true
    })
    .join(':')

  env.PATH       = dedupedPath
  env.TERM       = 'xterm-256color'
  env.COLORTERM  = 'truecolor'
  env.LANG       = env.LANG  || 'en_US.UTF-8'
  env.LC_ALL     = env.LC_ALL || 'en_US.UTF-8'
  env.HOME       = env.HOME  || os.homedir()
  env.USER       = env.USER  || os.userInfo().username
  env.LOGNAME    = env.LOGNAME || env.USER
  env.SHELL      = shellBin
  env.VOIDSHELL  = '1'

  // Remove ELECTRON_RUN_AS_NODE — it confuses some shell init scripts
  delete env.ELECTRON_RUN_AS_NODE
  // Remove ATOM_SHELL_INTERNAL_RUN_AS_NODE (legacy Electron env)
  delete env.ATOM_SHELL_INTERNAL_RUN_AS_NODE

  return env
}

/**
 * Determine the safest set of spawn arguments for the given shell.
 *
 * Rules:
 *   - Login shell flag (-l) is desirable so .zprofile / .bash_profile are
 *     sourced and PATH is fully populated.
 *   - However, on some macOS configurations (especially when launched via
 *     Spotlight or a packaged .app), -l causes zsh to read /etc/zprofile
 *     which may call `path_helper` and reset PATH — this is actually fine.
 *   - The ONLY case where -l must be omitted is when the shell binary itself
 *     does not support it (e.g. /bin/sh on some minimal Linux images).
 *   - We never pass empty strings in the args array — node-pty passes them
 *     verbatim to posix_spawnp and an empty string is an invalid argv entry.
 */
function buildSpawnArgs(shellBin: string): string[] {
  const basename = path.basename(shellBin)

  // Shells known to support -l
  const loginShellSupported = ['zsh', 'bash', 'fish', 'ksh', 'tcsh', 'csh']
  if (loginShellSupported.some(name => basename.startsWith(name))) {
    return ['-l']
  }

  // /bin/sh and unknown shells: no flags (safest)
  return []
}

// ─── PTY Creation with Full Error Recovery ─────────────────────────────────────
/**
 * Attempt to spawn a PTY process.
 *
 * Implements a three-tier fallback strategy:
 *   Tier 1: Resolved shell + login flag  (ideal)
 *   Tier 2: Resolved shell, no flags     (if -l caused posix_spawnp failure)
 *   Tier 3: /bin/sh, no flags            (guaranteed POSIX fallback)
 *
 * Each tier is wrapped in try-catch so a posix_spawnp failure at one tier
 * automatically triggers the next, and the renderer is notified of the
 * degraded state via 'pty:error' IPC message.
 */
function createPtyProcess() {
  // Kill any existing PTY first
  if (ptyProcess) {
    try { ptyProcess.kill() } catch { /* ignore */ }
    ptyProcess = null
  }

  const pty = require('node-pty')
  const shellBin  = resolveShell()
  const spawnArgs = buildSpawnArgs(shellBin)
  const env       = buildPtyEnv(shellBin)

  // ── Tier definitions ────────────────────────────────────────────────────────
  const tiers: Array<{ shell: string; args: string[]; label: string }> = [
    { shell: shellBin,  args: spawnArgs, label: `${shellBin} ${spawnArgs.join(' ')}`.trim() },
    { shell: shellBin,  args: [],        label: `${shellBin} (no flags)`                    },
    { shell: '/bin/sh', args: [],        label: '/bin/sh (POSIX fallback)'                  },
  ]

  // Deduplicate tiers (e.g. if shellBin is already /bin/sh)
  const seen = new Set<string>()
  const uniqueTiers = tiers.filter(t => {
    const key = `${t.shell}|${t.args.join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let lastError: Error | null = null

  for (const tier of uniqueTiers) {
    try {
      console.log(`[VoidShell] Attempting PTY spawn: ${tier.label}`)

      // ── Validate shell exists before calling spawn ────────────────────────
      // posix_spawnp gives a generic ENOENT if the binary is missing;
      // catching it here gives a clearer error message.
      if (!fs.existsSync(tier.shell)) {
        throw new Error(`Shell binary not found: ${tier.shell}`)
      }

      // ── Validate args: no empty strings, no null, no undefined ────────────
      const safeArgs = tier.args.filter(
        (a): a is string => typeof a === 'string' && a.length > 0
      )

      // ── Attempt spawn ─────────────────────────────────────────────────────
      const proc = pty.spawn(tier.shell, safeArgs, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: fs.existsSync(os.homedir()) ? os.homedir() : '/',
        env,
        // encoding: null tells node-pty to emit raw Buffers — more reliable
        // than UTF-8 string mode when dealing with binary escape sequences
        encoding: 'utf8',
      })

      // ── Verify spawn succeeded (pid must be a positive integer) ───────────
      if (!proc || typeof proc.pid !== 'number' || proc.pid <= 0) {
        throw new Error(`spawn returned invalid process (pid=${proc?.pid})`)
      }

      console.log(`[VoidShell] PTY spawned successfully: ${tier.label} (pid=${proc.pid})`)

      // ── Source voidshell init (only if file exists, only once) ────────────
      const voidInit = path.join(os.homedir(), '.voidshell', 'init.sh')
      if (fs.existsSync(voidInit)) {
        setTimeout(() => {
          try {
            proc.write(`source ${voidInit}\n`)
          } catch { /* PTY might not be ready yet */ }
        }, 200)
      }

      // ── Wire up data/exit handlers ────────────────────────────────────────
      proc.onData((data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty:data', data)
        }
      })

      proc.onExit(({ exitCode }: { exitCode: number }) => {
        console.log(`[VoidShell] PTY exited (code=${exitCode})`)
        ptyProcess = null
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pty:exit', exitCode)
        }
      })

      ptyProcess = proc

      // Notify renderer of the actual shell being used (for status bar display)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:ready', {
          shell: tier.shell,
          args:  safeArgs,
          pid:   proc.pid,
        })
      }

      return // Success — stop trying further tiers

    } catch (err: any) {
      lastError = err
      const msg = err?.message || String(err)
      console.error(`[VoidShell] PTY spawn failed (${tier.label}): ${msg}`)

      // Send diagnostic info to renderer so the user sees what went wrong
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:error', {
          tier:    tier.label,
          message: msg,
          // Include the raw POSIX error code if available
          code:    err?.code || 'UNKNOWN',
        })
      }

      // Continue to next tier
    }
  }

  // ── All tiers exhausted ───────────────────────────────────────────────────
  const finalMsg = `posix_spawnp failed on all tiers. Last error: ${lastError?.message}`
  console.error(`[VoidShell] FATAL: ${finalMsg}`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pty:fatal', { message: finalMsg })
  }
}

// ─── IPC Handlers (module-level — registered exactly once) ────────────────────

ipcMain.on('pty:write', (_event, data: string) => {
  if (!ptyProcess) {
    console.warn('[VoidShell] pty:write — no PTY, attempting respawn')
    createPtyProcess()
    return
  }
  try {
    ptyProcess.write(data)
  } catch (err: any) {
    console.error('[VoidShell] pty.write error:', err?.message)
    // PTY may have died — respawn and retry once
    createPtyProcess()
  }
})

ipcMain.on('pty:resize', (_event, { cols, rows }: { cols: number; rows: number }) => {
  if (!ptyProcess) return
  try {
    const safeCols = Math.max(1, Math.min(Math.floor(cols), 500))
    const safeRows = Math.max(1, Math.min(Math.floor(rows), 500))
    ptyProcess.resize(safeCols, safeRows)
  } catch (err: any) {
    console.error('[VoidShell] pty.resize error:', err?.message)
  }
})

// Renderer ready — (re)spawn PTY
ipcMain.on('pty:init', () => {
  console.log('[VoidShell] pty:init received')
  createPtyProcess()
})

// Renderer explicitly requests a respawn (e.g. after fatal error)
ipcMain.on('pty:respawn', () => {
  console.log('[VoidShell] pty:respawn requested by renderer')
  createPtyProcess()
})

// ─── Java Sidecar Socket Bridge ────────────────────────────────────────────────
const JAVA_SIDECAR_PORT = 27182
let javaSocket: net.Socket | null = null
let javaReconnectTimer: NodeJS.Timeout | null = null

function connectToJavaSidecar() {
  if (javaSocket) {
    javaSocket.destroy()
    javaSocket = null
  }

  javaSocket = new net.Socket()
  javaSocket.connect(JAVA_SIDECAR_PORT, '127.0.0.1', () => {
    console.log('[VoidShell] Connected to Java Sidecar on port', JAVA_SIDECAR_PORT)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sidecar:connected', true)
    }
  })

  let buffer = ''
  javaSocket.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const payload = JSON.parse(trimmed)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sidecar:metrics', payload)
        }
      } catch { /* non-JSON, ignore */ }
    }
  })

  javaSocket.on('error', (err: Error) => {
    console.warn('[VoidShell] Java Sidecar unavailable:', err.message)
    scheduleJavaReconnect()
  })

  javaSocket.on('close', () => { scheduleJavaReconnect() })
}

function scheduleJavaReconnect() {
  if (javaReconnectTimer) return
  javaReconnectTimer = setTimeout(() => {
    javaReconnectTimer = null
    connectToJavaSidecar()
  }, 5000)
}

// ─── Window Creation ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  800,
    minHeight: 500,
    titleBarStyle:      'hiddenInset',
    backgroundColor:    '#0a0008',
    vibrancy:           'ultra-dark',
    visualEffectState:  'active',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      webgl:            true,
    },
    icon:  path.join(__dirname, '../public/icon.png'),
    show:  false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show()
    mainWindow!.focus()
  })

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  createPtyProcess()
  connectToJavaSidecar()

  mainWindow.on('closed', () => {
    mainWindow = null
    if (ptyProcess) {
      try { ptyProcess.kill() } catch { /* ignore */ }
      ptyProcess = null
    }
    if (javaSocket) { javaSocket.destroy(); javaSocket = null }
    if (javaReconnectTimer) { clearTimeout(javaReconnectTimer); javaReconnectTimer = null }
  })
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
