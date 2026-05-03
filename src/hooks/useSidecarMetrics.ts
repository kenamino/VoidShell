import { useState, useEffect, useRef } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface SystemMetrics {
  cpuLoad:    number   // 0–100
  memUsed:    number   // bytes
  memTotal:   number   // bytes
  memPercent: number   // 0–100
  timestamp:  number   // Unix ms
}

export interface SidecarState {
  metrics:   SystemMetrics | null
  connected: boolean
}

// ─── Smoothing ─────────────────────────────────────────────────────────────────
const SMOOTH_FACTOR = 0.2   // EMA alpha: lower = smoother

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev)
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useSidecarMetrics(): SidecarState {
  const [state, setState] = useState<SidecarState>({
    metrics:   null,
    connected: false,
  })

  // Smoothed values to avoid jitter in visual effects
  const smoothedRef = useRef({ cpuLoad: 0, memPercent: 0 })

  useEffect(() => {
    const api = (window as any).voidshell
    if (!api) return

    const unsubMetrics = api.onSidecarMetrics((raw: SystemMetrics) => {
      const prev = smoothedRef.current
      const smoothedCpu = ema(prev.cpuLoad,    raw.cpuLoad,    SMOOTH_FACTOR)
      const smoothedMem = ema(prev.memPercent, raw.memPercent, SMOOTH_FACTOR)
      smoothedRef.current = { cpuLoad: smoothedCpu, memPercent: smoothedMem }

      setState(s => ({
        ...s,
        metrics: {
          ...raw,
          cpuLoad:    smoothedCpu,
          memPercent: smoothedMem,
        }
      }))
    })

    const unsubConn = api.onSidecarConnected((connected: boolean) => {
      setState(s => ({ ...s, connected }))
    })

    return () => {
      unsubMetrics()
      unsubConn()
    }
  }, [])

  return state
}
