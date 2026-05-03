import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TerminalProps {
  onOutput?: (data: string) => void
  onReady?:  () => void
}

interface PtyStatus {
  type:    'ok' | 'error' | 'fatal' | 'retrying'
  message: string
  shell?:  string
}

// ─── VoidShell xterm Theme ─────────────────────────────────────────────────────
const VOID_THEME = {
  background:          'transparent',
  foreground:          '#c8b8e8',
  cursor:              '#9d4edd',
  cursorAccent:        '#0a0008',
  selectionBackground: 'rgba(157, 78, 221, 0.3)',
  black:         '#0a0008', red:           '#ff2244',
  green:         '#4edd9d', yellow:        '#ddaa4e',
  blue:          '#4e9ddd', magenta:       '#9d4edd',
  cyan:          '#4edddd', white:         '#c8b8e8',
  brightBlack:   '#3d2a5e', brightRed:     '#ff4466',
  brightGreen:   '#6efdbd', brightYellow:  '#ffcc6e',
  brightBlue:    '#6ebdff', brightMagenta: '#bd6eff',
  brightCyan:    '#6efdfd', brightWhite:   '#e8d8ff',
}

// ─── Error Overlay ─────────────────────────────────────────────────────────────
const PtyErrorOverlay: React.FC<{
  status: PtyStatus
  onRetry: () => void
}> = ({ status, onRetry }) => (
  <div style={{
    position:       'absolute',
    inset:          0,
    zIndex:         10,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(10, 0, 8, 0.92)',
    backdropFilter: 'blur(4px)',
    fontFamily:     "'JetBrains Mono', 'SF Mono', monospace",
    color:          '#ff4466',
    padding:        '2rem',
    textAlign:      'center',
  }}>
    {/* Glitch icon */}
    <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 8px #ff2244)' }}>
      ▓▒░ VOID ERROR ░▒▓
    </div>

    {/* Error type badge */}
    <div style={{
      display:        'inline-block',
      padding:        '0.2rem 0.8rem',
      marginBottom:   '0.75rem',
      border:         '1px solid #ff2244',
      borderRadius:   '2px',
      fontSize:       '0.7rem',
      letterSpacing:  '0.15em',
      color:          '#ff6680',
      textTransform:  'uppercase',
    }}>
      {status.type === 'fatal' ? 'FATAL — ALL SPAWN TIERS EXHAUSTED' : 'PTY SPAWN FAILED'}
    </div>

    {/* Error message */}
    <div style={{
      maxWidth:    '520px',
      padding:     '0.75rem 1rem',
      background:  'rgba(255, 34, 68, 0.08)',
      border:      '1px solid rgba(255, 34, 68, 0.3)',
      borderRadius:'2px',
      fontSize:    '0.8rem',
      lineHeight:  1.6,
      color:       '#e8b0b8',
      marginBottom:'1.5rem',
      wordBreak:   'break-word',
    }}>
      {status.message}
    </div>

    {/* Diagnostic hint */}
    <div style={{
      fontSize:    '0.72rem',
      color:       '#6e4a5e',
      marginBottom:'1.5rem',
      lineHeight:  1.7,
    }}>
      Possible causes: node-pty not rebuilt for Electron arm64 · shell binary missing<br />
      Run: <code style={{ color: '#9d6edd' }}>./scripts/rebuild-arm64.sh</code> then restart
    </div>

    {/* Retry button */}
    <button
      onClick={onRetry}
      style={{
        padding:        '0.5rem 1.5rem',
        background:     'transparent',
        border:         '1px solid #9d4edd',
        borderRadius:   '2px',
        color:          '#bd6eff',
        fontFamily:     'inherit',
        fontSize:       '0.8rem',
        letterSpacing:  '0.1em',
        cursor:         'pointer',
        transition:     'all 0.15s',
      }}
      onMouseEnter={e => {
        (e.target as HTMLButtonElement).style.background = 'rgba(157,78,221,0.15)'
        ;(e.target as HTMLButtonElement).style.color = '#e8d8ff'
      }}
      onMouseLeave={e => {
        (e.target as HTMLButtonElement).style.background = 'transparent'
        ;(e.target as HTMLButtonElement).style.color = '#bd6eff'
      }}
    >
      ↺  RESPAWN SHELL
    </button>
  </div>
)

// ─── Main Terminal Component ───────────────────────────────────────────────────
const Terminal: React.FC<TerminalProps> = ({ onOutput, onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef     = useRef<XTerm | null>(null)
  const fitAddonRef  = useRef<FitAddon | null>(null)
  const cleanupRef   = useRef<Array<() => void>>([])
  const onOutputRef  = useRef(onOutput)
  useEffect(() => { onOutputRef.current = onOutput }, [onOutput])

  // PTY status state — drives error overlay visibility
  const [ptyStatus, setPtyStatus] = useState<PtyStatus | null>(null)

  // ── Retry handler ──────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    const api = (window as any).voidshell
    if (!api) return
    setPtyStatus({ type: 'retrying', message: 'Attempting to respawn shell…' })
    api.ptyRespawn()
    // Clear the retrying state after a moment; pty:ready will confirm success
    setTimeout(() => {
      setPtyStatus(prev => prev?.type === 'retrying' ? null : prev)
    }, 3000)
  }, [])

  // ── Init xterm (once on mount) ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm({
      theme:                VOID_THEME,
      fontFamily:           "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', monospace",
      fontSize:             14,
      lineHeight:           1.5,
      letterSpacing:        0.5,
      cursorBlink:          true,
      cursorStyle:          'block',
      scrollback:           5000,
      allowTransparency:    true,
      smoothScrollDuration: 100,
      macOptionIsMeta:      true,
      allowProposedApi:     true,
      disableStdin:         false,
      // Intercept Ctrl+G before xterm sends it to the shell
      attachCustomKeyEventHandler: (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'g') {
          // Trigger glitch via custom event — App.tsx listens for this
          window.dispatchEvent(new CustomEvent('void:glitch'))
          return false  // don't send to shell
        }
        return true
      },
    })

    const fitAddon      = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(container)

    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch { /* ignore */ }
    })

    xtermRef.current    = term
    fitAddonRef.current = fitAddon

    // ── IPC wiring ───────────────────────────────────────────────────────────
    const api = (window as any).voidshell
    if (!api) {
      term.writeln('\r\n\x1b[1;31m[VoidShell] FATAL: IPC bridge unavailable — preload failed.\x1b[0m')
      setPtyStatus({ type: 'fatal', message: 'window.voidshell is undefined. The preload script did not execute. Check Electron webPreferences.sandbox and preload path.' })
      return
    }

    // Signal main: renderer mounted, spawn PTY
    api.ptyInit()

    // PTY stdout → xterm
    const unsubData = api.onPtyData((data: string) => {
      term.write(data)
      onOutputRef.current?.(data)
    })
    cleanupRef.current.push(unsubData)

    // PTY exit
    const unsubExit = api.onPtyExit((code: number) => {
      term.writeln(`\r\n\x1b[1;31m[VoidShell] Shell exited (code ${code}). Press any key to restart.\x1b[0m`)
    })
    cleanupRef.current.push(unsubExit)

    // PTY ready — clear error state, show welcome banner (once only)
    let welcomeShown = false
    const unsubReady = api.onPtyReady((info: { shell: string; args: string[]; pid: number }) => {
      setPtyStatus(null)
      if (welcomeShown) return  // skip duplicate banners
      welcomeShown = true
      const logo = [
        '',
        '\x1b[38;5;99m  ██╗   ██╗ ██████╗ ██╗██████╗',
        '  ██║   ██║██╔═══██╗██║██╔══██╗',
        '  ██║   ██║██║   ██║██║██║  ██║',
        '  ╚██╗ ██╔╝██║   ██║██║██║  ██║',
        '   ╚████╔╝ ╚██████╔╝██║██████╔╝',
        '    ╚═══╝   ╚═════╝ ╚═╝╚═════╝\x1b[0m',
      ]
      logo.forEach(l => term.writeln(l))
      term.writeln('')
      term.writeln(`\x1b[38;5;240m[VoidShell] v1.0.2 · 👁️‍🗨️ 虚空之眼永不闭合\x1b[0m`)
      term.writeln(`\x1b[38;5;240m[VoidShell] shell=${info.shell} pid=${info.pid}\x1b[0m`)
      term.writeln(`\x1b[38;5;240m[VoidShell] type \x1b[38;5;99mhelp\x1b[38;5;240m for commands, \x1b[38;5;99mCtrl+G\x1b[38;5;240m for glitch\x1b[0m`)
      term.writeln('')
    })
    cleanupRef.current.push(unsubReady)

    // PTY per-tier spawn error — write diagnostic to terminal but don't block
    const unsubError = api.onPtyError((err: { tier: string; message: string; code: string }) => {
      term.writeln(`\r\n\x1b[1;33m[VoidShell] spawn attempt failed (${err.tier}): ${err.message} [${err.code}]\x1b[0m`)
      setPtyStatus({ type: 'error', message: `${err.message} (tier: ${err.tier}, code: ${err.code})` })
    })
    cleanupRef.current.push(unsubError)

    // PTY fatal — all tiers exhausted, show blocking overlay
    const unsubFatal = api.onPtyFatal((err: { message: string }) => {
      term.writeln(`\r\n\x1b[1;31m[VoidShell] FATAL: ${err.message}\x1b[0m`)
      setPtyStatus({ type: 'fatal', message: err.message })
    })
    cleanupRef.current.push(unsubFatal)

    // Keystrokes → PTY
    const dataDisposable = term.onData((data: string) => {
      // If there's a fatal error, any keypress triggers a respawn attempt
      if (ptyStatus?.type === 'fatal') {
        handleRetry()
        return
      }
      api.ptyWrite(data)
    })
    cleanupRef.current.push(() => dataDisposable.dispose())

    // Resize → PTY
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      api.ptyResize(cols, rows)
    })
    cleanupRef.current.push(() => resizeDisposable.dispose())

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => { try { fitAddon.fit() } catch { /* ignore */ } })
    })
    ro.observe(container)
    cleanupRef.current.push(() => ro.disconnect())

    // Window resize
    const onWinResize = () => {
      requestAnimationFrame(() => { try { fitAddon.fit() } catch { /* ignore */ } })
    }
    window.addEventListener('resize', onWinResize)
    cleanupRef.current.push(() => window.removeEventListener('resize', onWinResize))

    // Focus — critical on macOS for keyboard input
    term.focus()
    const onWindowFocus = () => { term.focus() }
    window.addEventListener('focus', onWindowFocus)
    cleanupRef.current.push(() => window.removeEventListener('focus', onWindowFocus))

    onReady?.()

    return () => {
      cleanupRef.current.forEach(fn => { try { fn() } catch { /* ignore */ } })
      cleanupRef.current = []
      term.dispose()
      xtermRef.current    = null
      fitAddonRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* xterm container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={() => xtermRef.current?.focus()}
        style={{
          width:         '100%',
          height:        '100%',
          pointerEvents: 'auto',
          outline:       'none',
          filter:        'drop-shadow(0 0 2px rgba(157, 78, 221, 0.3))',
        }}
      />

      {/* Error / fatal overlay */}
      {ptyStatus && ptyStatus.type !== 'ok' && (
        <PtyErrorOverlay status={ptyStatus} onRetry={handleRetry} />
      )}

      {/* Retrying spinner (lightweight, non-blocking) */}
      {ptyStatus?.type === 'retrying' && (
        <div style={{
          position:    'absolute',
          bottom:      '1rem',
          right:       '1rem',
          fontSize:    '0.75rem',
          color:       '#9d4edd',
          fontFamily:  'monospace',
          animation:   'void-pulse 1s ease-in-out infinite',
        }}>
          ◈ respawning…
        </div>
      )}
    </div>
  )
}

export default Terminal
