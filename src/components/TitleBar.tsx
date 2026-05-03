import React, { useState, useEffect } from 'react'

interface TitleBarProps {
  glitchActive: boolean
}

const TitleBar: React.FC<TitleBarProps> = ({ glitchActive }) => {
  const [time, setTime] = useState(new Date())
  const [uptime, setUptime] = useState(0)
  const startupTime = Date.now()

  useEffect(() => {
    const int = setInterval(() => {
      setTime(new Date())
      setUptime(Math.floor((Date.now() - startupTime) / 1000))
    }, 1000)
    return () => clearInterval(int)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const h = Math.floor(uptime / 3600)
  const m = Math.floor((uptime % 3600) / 60)
  const uptimeStr = `${h}h ${m.toString().padStart(2, '0')}m`
  const timeStr = time.toLocaleTimeString('zh-CN', { hour12: false })

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        height:         '38px',
        padding:        '0 16px',
        background:     'rgba(10, 0, 8, 0.9)',
        borderBottom:   '1px solid rgba(157, 78, 221, 0.15)',
        WebkitAppRegion: 'drag' as any,
        flexShrink:     0,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: session info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        pointerEvents: 'none',
      }}>
        <span style={{ color: glitchActive ? '#ff2244' : 'rgba(157,78,221,0.7)', fontWeight: 700 }}>
          ◈
        </span>
        <span style={{
          color: glitchActive ? '#ff4466' : 'rgba(200,184,232,0.6)',
          letterSpacing: '3px', fontWeight: 700,
        }}>
          VoidShell
        </span>
        <span style={{ color: 'rgba(107,94,138,0.5)', fontSize: '10px' }}>
          v1.0.2
        </span>
      </div>

      {/* Center: uptime */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: 'rgba(107,94,138,0.4)',
        letterSpacing: '2px',
        pointerEvents: 'none',
      }}>
        {glitchActive
          ? <span style={{ color: '#ff2244', animation: 'void-pulse 0.3s infinite' }}>⚠ SYSTEM GLITCH</span>
          : <span>UPTIME {uptimeStr}</span>
        }
      </div>

      {/* Right: clock */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        color: 'rgba(107,94,138,0.5)',
        letterSpacing: '1px',
        pointerEvents: 'none',
      }}>
        {timeStr}
      </div>
    </div>
  )
}

export default TitleBar
