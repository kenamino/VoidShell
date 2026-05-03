import React, { useEffect, useCallback } from 'react'
import VoidBackground from './components/VoidBackground'
import Terminal from './components/Terminal'
import GlitchOverlay from './components/GlitchOverlay'
import StatusBar from './components/StatusBar'
import TitleBar from './components/TitleBar'
import EdgeSmokeOverlay from './components/EdgeSmokeOverlay'
import { useGlitchDetector } from './hooks/useGlitchDetector'
import { useSidecarMetrics } from './hooks/useSidecarMetrics'

// ─── Root Styles ───────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  background: '#0a0008',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
}

const terminalContainerStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  zIndex: 2,
  margin: '0.5rem 0.5rem 0 0.5rem',
  borderRadius: '6px',
  overflow: 'hidden',
}

// ─── App ───────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const { glitchAmount, processOutput, triggerGlitch } = useGlitchDetector()
  const { metrics, connected } = useSidecarMetrics()

  // ── IPC: init PTY on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).voidshell
    if (api?.ptyInit) api.ptyInit()
  }, [])

  // ── Ctrl+G: glitch trigger (fired by Terminal xterm custom key handler) ──
  useEffect(() => {
    const handler = () => {
      triggerGlitch()
      const api = (window as any).voidshell
      if (api?.ptyWrite) {
        api.ptyWrite('\r\n\x1b[1;31m▓▒░ 坏疽反馈手动触发 ░▒▓\x1b[0m\r\n')
      }
    }
    window.addEventListener('void:glitch', handler)
    return () => window.removeEventListener('void:glitch', handler)
  }, [triggerGlitch])

  // CPU load for smoke & shader — VoidBackground expects 0–100
  const cpuLoad    = metrics?.cpuLoad ?? 0
  const memPercent = metrics?.memPercent ?? 0

  return (
    <div style={rootStyle}>
      {/* ── Shader Background (fullscreen, behind everything) ── */}
      <VoidBackground
        cpuLoad={cpuLoad}
        memPercent={memPercent}
        glitchAmount={glitchAmount}
      />

      {/* ── Edge Smoke ── */}
      <EdgeSmokeOverlay cpuLoad={cpuLoad / 100} />

      {/* ── Title Bar ── */}
      <TitleBar glitchActive={glitchAmount > 0.1} />

      {/* ── Terminal ── */}
      <div style={terminalContainerStyle}>
        <Terminal
          onOutput={processOutput}
          onReady={() => console.log('[VoidShell] Terminal ready')}
        />
      </div>

      {/* ── Glitch Overlay ── */}
      {glitchAmount > 0.01 && <GlitchOverlay intensity={glitchAmount} />}

      {/* ── Status Bar ── */}
      <StatusBar metrics={metrics} connected={connected} />
    </div>
  )
}

export default App
