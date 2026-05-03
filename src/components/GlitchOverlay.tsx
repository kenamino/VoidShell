import React, { useEffect, useRef } from 'react'

interface GlitchOverlayProps {
  intensity: number   // 0–1
}

/**
 * Canvas-based red noise overlay rendered during glitch events.
 * Uses requestAnimationFrame to draw random pixel noise for authentic
 * "bitmap distortion" / CRT corruption aesthetics.
 */
const GlitchOverlay: React.FC<GlitchOverlayProps> = ({ intensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (intensity < 0.01) {
      // Clear canvas when not glitching
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      cancelAnimationFrame(rafRef.current)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width  = canvas.clientWidth
    const H = canvas.height = canvas.clientHeight

    function drawNoise() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, W, H)

      // ── Horizontal scan-line tears ──────────────────────────────────────
      const tearCount = Math.floor(intensity * 8)
      for (let i = 0; i < tearCount; i++) {
        const y     = Math.random() * H
        const h     = Math.random() * 4 + 1
        const alpha = Math.random() * intensity * 0.6
        const xOff  = (Math.random() - 0.5) * intensity * 30

        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,20,40' : '180,0,20'}, ${alpha})`
        ctx.fillRect(xOff, y, W, h)
      }

      // ── Random pixel noise ──────────────────────────────────────────────
      const pixelCount = Math.floor(intensity * W * H * 0.004)
      for (let i = 0; i < pixelCount; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        const s = Math.random() * 3 + 1
        const r = Math.floor(200 + Math.random() * 55)
        const g = Math.floor(Math.random() * 20)
        const b = Math.floor(Math.random() * 30)
        const a = Math.random() * intensity

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fillRect(x, y, s, s)
      }

      // ── Block corruption ────────────────────────────────────────────────
      if (intensity > 0.3) {
        const blockCount = Math.floor(intensity * 5)
        for (let i = 0; i < blockCount; i++) {
          const bx = Math.random() * W
          const by = Math.random() * H
          const bw = Math.random() * 80 + 10
          const bh = Math.random() * 6 + 2
          ctx.fillStyle = `rgba(255,0,30,${Math.random() * intensity * 0.3})`
          ctx.fillRect(bx, by, bw, bh)
        }
      }

      rafRef.current = requestAnimationFrame(drawNoise)
    }

    rafRef.current = requestAnimationFrame(drawNoise)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [intensity])

  if (intensity < 0.01) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        10,
        mixBlendMode:  'screen',
      }}
    />
  )
}

export default GlitchOverlay
