import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ─── Inline Shader Sources ─────────────────────────────────────────────────────
// (Inlined to avoid Vite raw import complexity; identical to .glsl files)

const VERTEX_SHADER = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */`
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform float uCpuLoad;
uniform float uMemPercent;
uniform float uGlitchAmount;

// ── Hash / Noise ──────────────────────────────────────────────────────────────
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y);
}

float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * noise(p * f);
    f *= 2.1; a *= 0.45;
  }
  return v;
}

float warpedFbm(vec2 p, float speed) {
  float t = uTime * speed;
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t*0.15, 4),
                fbm(p + vec2(5.2, 1.3) + t*0.12, 4));
  vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7, 9.2) + t*0.08, 4),
                fbm(p + 4.0*q + vec2(8.3, 2.8) + t*0.06, 4));
  return fbm(p + 4.0*r, 5);
}

vec2 glitchUv(vec2 uv) {
  if (uGlitchAmount < 0.001) return uv;
  float t    = uTime * 60.0;
  float band = floor(uv.y * 20.0);
  float bn   = fract(sin(band * 127.1 + t) * 43758.5);
  float shift = (bn - 0.5) * uGlitchAmount * 0.08;
  float tear  = step(0.98 - uGlitchAmount * 0.5, bn) * uGlitchAmount * 0.02;
  return uv + vec2(shift, tear);
}

void main() {
  vec2 uv = glitchUv(vUv);
  vec2 p  = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  float speed = 0.3 + uCpuLoad * 1.7;
  float f     = warpedFbm(p * 2.5, speed) * 0.5 + 0.5;
  f = pow(f, 1.4);

  vec3 colorDark   = vec3(0.04, 0.01, 0.06);
  vec3 colorMid    = vec3(0.11, 0.04, 0.20);
  vec3 colorBright = vec3(0.18, 0.07, 0.30);
  vec3 colorCrimson = vec3(0.24, 0.02, 0.02);
  vec3 colorBlood   = vec3(0.35, 0.03, 0.03);

  float memShift = smoothstep(0.3, 0.9, uMemPercent);
  colorMid    = mix(colorMid,    colorCrimson, memShift * 0.7);
  colorBright = mix(colorBright, colorBlood,   memShift * 0.6);

  vec3 color;
  if (f < 0.4) {
    color = mix(colorDark, colorMid, f / 0.4);
  } else if (f < 0.75) {
    color = mix(colorMid, colorBright, (f - 0.4) / 0.35);
  } else {
    color = mix(colorBright, vec3(0.30, 0.10, 0.50), (f - 0.75) / 0.25);
  }

  float vignette = 1.0 - smoothstep(0.4, 1.2, length(uv - 0.5) * 2.0);
  color *= vignette * 0.85 + 0.15;

  if (uGlitchAmount > 0.01) {
    float rNoise = fract(sin(dot(uv, vec2(12.9898, 78.233)) + uTime * 100.0) * 43758.5);
    float rFlash = step(0.7, rNoise) * uGlitchAmount;
    color = mix(color, vec3(0.8, 0.0, 0.05), rFlash * 0.4);
    float aberr = uGlitchAmount * 0.005;
    color.r += fbm(uv + vec2(aberr, 0.0), 2) * uGlitchAmount * 0.3;
    color.b -= fbm(uv - vec2(aberr, 0.0), 2) * uGlitchAmount * 0.3;
  }

  float scanline = sin(uv.y * uResolution.y * 1.5) * 0.5 + 0.5;
  color *= 1.0 - scanline * 0.03;

  color = clamp(color, 0.0, 0.35);
  gl_FragColor = vec4(color, 1.0);
}
`

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
