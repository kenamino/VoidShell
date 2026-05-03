import { contextBridge, ipcRenderer } from 'electron'

// ─── Type Definitions ──────────────────────────────────────────────────────────
export interface SystemMetrics {
  cpuLoad:    number   // 0–100 percentage
  memUsed:    number   // bytes
  memTotal:   number   // bytes
  memPercent: number   // 0–100 percentage
  timestamp:  number   // Unix ms
}

// ─── Expose API via contextBridge ──────────────────────────────────────────────
// IMPORTANT: contextBridge.exposeInMainWorld clones all values across the
// context boundary using the Structured Clone Algorithm.
// Functions ARE supported (they become proxy functions), but:
//   - Arrow functions inside object literals are fine
//   - Closures over ipcRenderer are fine
//   - Returning functions (unsubscribers) from exposed methods IS supported
//     in Electron 20+ with contextIsolation=true
//
// The API is intentionally minimal — no classes, no Promises that hold
// renderer references, just plain function proxies.

contextBridge.exposeInMainWorld('voidshell', {
  // ── PTY: send user keystrokes to shell ──────────────────────────────────
  ptyWrite(data: string): void {
    ipcRenderer.send('pty:write', data)
  },

  // ── PTY: notify main process of terminal resize ─────────────────────────
  ptyResize(cols: number, rows: number): void {
    ipcRenderer.send('pty:resize', { cols, rows })
  },

  // ── PTY: signal renderer is mounted and ready ───────────────────────────
  ptyInit(): void {
    ipcRenderer.send('pty:init')
  },

  // ── PTY: subscribe to shell stdout/stderr ───────────────────────────────
  // Returns an unsubscribe function — caller must invoke it on cleanup.
  onPtyData(callback: (data: string) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, data: string) => {
      callback(data)
    }
    ipcRenderer.on('pty:data', handler)
    return () => { ipcRenderer.removeListener('pty:data', handler) }
  },

  // ── PTY: subscribe to shell exit ────────────────────────────────────────
  onPtyExit(callback: (code: number) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, code: number) => {
      callback(code)
    }
    ipcRenderer.on('pty:exit', handler)
    return () => { ipcRenderer.removeListener('pty:exit', handler) }
  },

  // ── Sidecar: subscribe to system metrics ────────────────────────────────
  onSidecarMetrics(callback: (metrics: SystemMetrics) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, metrics: SystemMetrics) => {
      callback(metrics)
    }
    ipcRenderer.on('sidecar:metrics', handler)
    return () => { ipcRenderer.removeListener('sidecar:metrics', handler) }
  },

  // ── Sidecar: subscribe to connection status ──────────────────────────────
  onSidecarConnected(callback: (connected: boolean) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, connected: boolean) => {
      callback(connected)
    }
    ipcRenderer.on('sidecar:connected', handler)
    return () => { ipcRenderer.removeListener('sidecar:connected', handler) }
  },

  // ── PTY: subscribe to spawn-ready notification ───────────────────────────
  // Payload: { shell: string, args: string[], pid: number }
  onPtyReady(callback: (info: { shell: string; args: string[]; pid: number }) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, info: any) => { callback(info) }
    ipcRenderer.on('pty:ready', handler)
    return () => { ipcRenderer.removeListener('pty:ready', handler) }
  },

  // ── PTY: subscribe to per-tier spawn errors ──────────────────────────────
  // Payload: { tier: string, message: string, code: string }
  onPtyError(callback: (err: { tier: string; message: string; code: string }) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, err: any) => { callback(err) }
    ipcRenderer.on('pty:error', handler)
    return () => { ipcRenderer.removeListener('pty:error', handler) }
  },

  // ── PTY: subscribe to fatal (all tiers exhausted) ────────────────────────
  // Payload: { message: string }
  onPtyFatal(callback: (err: { message: string }) => void): () => void {
    const handler = (_evt: Electron.IpcRendererEvent, err: any) => { callback(err) }
    ipcRenderer.on('pty:fatal', handler)
    return () => { ipcRenderer.removeListener('pty:fatal', handler) }
  },

  // ── PTY: request a full respawn from renderer ────────────────────────────
  ptyRespawn(): void {
    ipcRenderer.send('pty:respawn')
  },
})
