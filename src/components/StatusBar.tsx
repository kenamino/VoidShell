import React, { useState, useEffect } from 'react'
import { SystemMetrics } from '../hooks/useSidecarMetrics'

interface StatusBarProps {
  metrics:   SystemMetrics | null
  connected: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

function getCpuColor(load: number): string {
  if (load < 30) return '#4edd9d'
  if (load < 60) return '#ddaa4e'
  if (load < 80) return '#ff8844'
  return '#ff2244'
}

function getMemColor(pct: number): string {
  if (pct < 50) return '#4edd9d'
  if (pct < 75) return '#ddaa4e'
  return '#ff2244'
}

const StatusBar: React.FC<StatusBarProps> = ({ metrics, connected }) => {
  const [uptime, setUptime] = useState(0)
  const [ts, setTs] = useState(new Date())
  const startTime = Date.now()

  useEffect(() => {
    const int = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime) / 1000))
      setTs(new Date())
    }, 1000)
    return () => clearInterval(int)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const h = Math.floor(uptime / 3600)
  const m = Math.floor((uptime % 3600) / 60)
  const s = uptime % 60
  const uptimeStr = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         '3px 16px',
      background:      'rgba(10, 0, 8, 0.85)',
      borderTop:       '1px solid rgba(157, 78, 221, 0.2)',
      fontSize:        '11px',
      fontFamily:      'var(--font-mono)',
      color:           'var(--void-text-dim)',
      backdropFilter:  'blur(8px)',
      flexShrink:      0,
      userSelect:      'none',
    }}>
      {/* Left: session info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--void-accent)', fontWeight: 700, letterSpacing: '2px' }}>
          VOIDSHELL
        </span>
        <span style={{ opacity: 0.4 }}>v1.0.2</span>
      </div>

      {/* Center: metrics or fallback */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {metrics ? (
          <>
            <span>
              CPU{' '}
              <span style={{ color: getCpuColor(metrics.cpuLoad), fontWeight: 600 }}>
                {metrics.cpuLoad.toFixed(1)}%
              </span>
            </span>
            <span>
              MEM{' '}
              <span style={{ color: getMemColor(metrics.memPercent), fontWeight: 600 }}>
                {formatBytes(metrics.memUsed)}
              </span>
              <span style={{ opacity: 0.5 }}>/{formatBytes(metrics.memTotal)}</span>
            </span>
            <div style={{
              width: '60px', height: '4px',
              background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${metrics.cpuLoad}%`, height: '100%',
                background: getCpuColor(metrics.cpuLoad),
                borderRadius: '2px', transition: 'width 0.8s ease, background 0.5s ease',
              }} />
            </div>
          </>
        ) : (
          <span style={{ opacity: 0.6 }}>
            UPTIME {uptimeStr}
          </span>
        )}
      </div>

      {/* Right: status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: metrics ? '#4edd9d' : '#9d4edd',
          boxShadow: metrics
            ? '0 0 6px rgba(78, 221, 157, 0.8)'
            : '0 0 6px rgba(157, 78, 221, 0.8)',
          animation: 'void-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ opacity: 0.6 }}>
          {metrics ? 'METRICS OK' : (connected ? 'CONNECTED' : 'LOCAL')}
        </span>
      </div>
    </div>
  )
}

export default StatusBar
