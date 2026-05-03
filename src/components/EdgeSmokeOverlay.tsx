import React, { useEffect, useRef } from 'react'

interface EdgeSmokeOverlayProps {
  cpuLoad: number
}

interface Wisp {
  edge: 'top' | 'right' | 'bottom' | 'left'
  anchor: number
  driftA: number
  driftB: number
  radius: number
  alpha: number
  speed: number
  phase: number
}

const EDGE_COUNT = 28

const makeWisps = (): Wisp[] => {
  const edges: Wisp['edge'][] = ['top', 'right', 'bottom', 'left']

  return Array.from({ length: EDGE_COUNT }, (_, idx) => ({
    edge: edges[idx % 4],
    anchor: Math.random(),
    driftA: 20 + Math.random() * 80,
    driftB: 12 + Math.random() * 60,
    radius: 110 + Math.random() * 180,
    alpha: 0.035 + Math.random() * 0.05,
    speed: 0.1 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
  }))
}

const EdgeSmokeOverlay: React.FC<EdgeSmokeOverlayProps> = ({ cpuLoad }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const wispsRef = useRef<Wisp[]>(makeWisps())
  const startTimeRef = useRef<number>(0)
  const cpuLoadRef = useRef(0)

  useEffect(() => {
    cpuLoadRef.current = Math.min(Math.max(cpuLoad / 100, 0), 1)
  }, [cpuLoad])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(canvas.clientWidth))
      const height = Math.max(1, Math.floor(canvas.clientHeight))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (time: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      if (!startTimeRef.current) startTimeRef.current = time
      const elapsed = (time - startTimeRef.current) * 0.001
      const loadBoost = cpuLoadRef.current * 0.18

      try {
        ctx.clearRect(0, 0, w, h)
        ctx.filter = 'blur(24px)'
        ctx.globalCompositeOperation = 'source-over'

        wispsRef.current.forEach((wisp) => {
          const pulse = Math.sin(elapsed * wisp.speed + wisp.phase)
          const sway = Math.sin(elapsed * (wisp.speed * 0.7) + wisp.phase * 1.7)
          const alpha = wisp.alpha + loadBoost * 0.04 + pulse * 0.01
          let x = 0
          let y = 0

          if (wisp.edge === 'top') {
            x = wisp.anchor * w + sway * wisp.driftA
            y = -wisp.radius * 0.35 + pulse * wisp.driftB
          } else if (wisp.edge === 'bottom') {
            x = wisp.anchor * w + sway * wisp.driftA
            y = h + wisp.radius * 0.35 + pulse * wisp.driftB
          } else if (wisp.edge === 'left') {
            x = -wisp.radius * 0.35 + pulse * wisp.driftB
            y = wisp.anchor * h + sway * wisp.driftA
          } else {
            x = w + wisp.radius * 0.35 + pulse * wisp.driftB
            y = wisp.anchor * h + sway * wisp.driftA
          }

          const gradient = ctx.createRadialGradient(x, y, wisp.radius * 0.15, x, y, wisp.radius)
          gradient.addColorStop(0, `rgba(22, 16, 28, ${alpha})`)
          gradient.addColorStop(0.65, `rgba(12, 8, 18, ${alpha * 0.7})`)
          gradient.addColorStop(1, 'rgba(8, 4, 12, 0)')

          ctx.fillStyle = gradient
          ctx.fillRect(x - wisp.radius, y - wisp.radius, wisp.radius * 2, wisp.radius * 2)
        })

        // Dark edge vignette keeps the abyss mood while leaving center readable.
        const vignette = ctx.createRadialGradient(
          w * 0.5,
          h * 0.5,
          Math.min(w, h) * 0.35,
          w * 0.5,
          h * 0.5,
          Math.max(w, h) * 0.85,
        )
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
        vignette.addColorStop(0.7, 'rgba(5, 2, 8, 0.05)')
        vignette.addColorStop(1, 'rgba(4, 1, 7, 0.16)')
        ctx.filter = 'none'
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, w, h)
      } catch {
        // Fail soft: never block the app if GPU/canvas state glitches.
        ctx.filter = 'none'
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

export default EdgeSmokeOverlay
