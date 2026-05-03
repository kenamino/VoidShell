import { useState, useRef, useCallback } from 'react'

// ─── Configuration ─────────────────────────────────────────────────────────────
const GLITCH_DURATION_MS = 500
const GLITCH_PEAK        = 1.0   // Max glitch intensity

// Keywords that trigger the glitch effect (case-insensitive)
const ERROR_PATTERNS = [
  /\bError\b/i,
  /\bException\b/i,
  /\bFATAL\b/i,
  /\bSEGFAULT\b/i,
  /\bAborted\b/i,
  /\bPanic\b/i,
  /\bfailed\b/i,
  /\bNullPointerException\b/i,
  /\bStackOverflow\b/i,
  /\bOutOfMemory\b/i,
  /command not found/i,
  /No such file or directory/i,
  /Permission denied/i,
  /BUILD FAILED/i,
  /COMPILATION ERROR/i,
]

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useGlitchDetector() {
  const [glitchAmount, setGlitchAmount] = useState(0)
  const glitchTimerRef   = useRef<NodeJS.Timeout | null>(null)
  const glitchStartRef   = useRef<number>(0)
  const rafRef           = useRef<number>(0)
  const isGlitchingRef   = useRef(false)

  // ── Animate glitch decay ─────────────────────────────────────────────────
  const animateGlitch = useCallback(() => {
    const elapsed = performance.now() - glitchStartRef.current
    const progress = Math.min(elapsed / GLITCH_DURATION_MS, 1.0)

    // Easing: fast attack, exponential decay
    let intensity: number
    if (progress < 0.1) {
      // Attack: 0 → peak in first 10%
      intensity = GLITCH_PEAK * (progress / 0.1)
    } else {
      // Decay: exponential falloff
      intensity = GLITCH_PEAK * Math.pow(1.0 - (progress - 0.1) / 0.9, 2.5)
    }

    setGlitchAmount(intensity)

    if (progress < 1.0) {
      rafRef.current = requestAnimationFrame(animateGlitch)
    } else {
      setGlitchAmount(0)
      isGlitchingRef.current = false
    }
  }, [])

  // ── Trigger glitch ───────────────────────────────────────────────────────
  const triggerGlitch = useCallback(() => {
    // Cancel any existing animation
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    if (glitchTimerRef.current) {
      clearTimeout(glitchTimerRef.current)
    }

    isGlitchingRef.current = true
    glitchStartRef.current = performance.now()
    rafRef.current = requestAnimationFrame(animateGlitch)

    // Also add CSS class to terminal wrapper for DOM-level glitch
    const termWrapper = document.getElementById('terminal-wrapper')
    if (termWrapper) {
      termWrapper.classList.add('glitch-active')
      glitchTimerRef.current = setTimeout(() => {
        termWrapper.classList.remove('glitch-active')
      }, GLITCH_DURATION_MS)
    }
  }, [animateGlitch])

  // ── Process terminal output ──────────────────────────────────────────────
  const processOutput = useCallback((data: string) => {
    // Strip ANSI escape codes for clean pattern matching
    const clean = data.replace(/\x1b\[[0-9;]*[mGKHF]/g, '')
                      .replace(/\x1b\][^\x07]*\x07/g, '')

    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(clean)) {
        triggerGlitch()
        break  // One glitch per output chunk
      }
    }
  }, [triggerGlitch])

  return { glitchAmount, processOutput, triggerGlitch }
}
