import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import VERTEX_SHADER from '@/shaders/void.vert.glsl?raw'
import FRAGMENT_SHADER from '@/shaders/void.frag.glsl?raw'

// ─── Props ─────────────────────────────────────────────────────────────────────
interface VoidBackgroundProps {
  cpuLoad:     number   // 0–100
  memPercent:  number   // 0–100
  glitchAmount: number  // 0–1
}

// ─── Component ─────────────────────────────────────────────────────────────────
const VoidBackground: React.FC<VoidBackgroundProps> = ({
  cpuLoad,
  memPercent,
  glitchAmount,
}) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const uniformsRef = useRef<Record<string, THREE.IUniform> | null>(null)
  const rafRef      = useRef<number>(0)
  const clockRef    = useRef(new THREE.Clock())

  // ── Init Three.js scene ───────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const W = canvas.clientWidth
    const H = canvas.clientHeight

    // Renderer — use existing canvas, enable WebGL2 for M4 GPU
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,   // Not needed for full-screen quad
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'highp',
    })
    renderer.setSize(W, H, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))  // Cap at 2x for M4
    rendererRef.current = renderer

    // Scene — full-screen quad
    const scene    = new THREE.Scene()
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    const uniforms: Record<string, THREE.IUniform> = {
      uTime:        { value: 0.0 },
      uResolution:  { value: new THREE.Vector2(W, H) },
      uCpuLoad:     { value: 0.0 },
      uMemPercent:  { value: 0.0 },
      uGlitchAmount:{ value: 0.0 },
    }
    uniformsRef.current = uniforms

    const material = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthTest:  false,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // ── Render loop ───────────────────────────────────────────────────────
    const clock = clockRef.current
    clock.start()

    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      uniforms.uTime.value = clock.getElapsedTime()
      renderer.render(scene, camera)
    }
    animate()

    // ── Resize handler ────────────────────────────────────────────────────
    const handleResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      renderer.setSize(w, h, false)
      uniforms.uResolution.value.set(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', handleResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      rendererRef.current = null
      uniformsRef.current = null
    }
  }, [])

  // ── Update uniforms when props change (no re-render needed) ───────────────
  useEffect(() => {
    if (!uniformsRef.current) return
    uniformsRef.current.uCpuLoad.value     = cpuLoad    / 100.0
    uniformsRef.current.uMemPercent.value  = memPercent / 100.0
    uniformsRef.current.uGlitchAmount.value = glitchAmount
  }, [cpuLoad, memPercent, glitchAmount])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        // Pointer events disabled — background only
        pointerEvents: 'none',
      }}
    />
  )
}

export default VoidBackground
