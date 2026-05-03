// ─── VoidShell Fragment Shader ────────────────────────────────────────────────
// Slowly writhing dark organic tissue — inspired by Carrion (2020)
// Optimized for Apple Silicon M4 GPU

precision highp float;

varying vec2 vUv;

// ── Uniforms ──────────────────────────────────────────────────────────────────
uniform float uTime;          // seconds elapsed
uniform vec2  uResolution;    // viewport size in pixels
uniform float uCpuLoad;       // 0.0–1.0: controls wriggle speed
uniform float uMemPercent;    // 0.0–1.0: controls color shift toward deep red
uniform float uGlitchAmount;  // 0.0–1.0: glitch distortion intensity

// ── Hash / Noise Utilities ────────────────────────────────────────────────────
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Gradient noise (Perlin-like)
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y
  );
}

// Fractional Brownian Motion — layered noise for organic texture
float fbm(vec2 p, int octaves) {
  float value     = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float lacunarity = 2.1;
  float gain       = 0.45;

  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value     += amplitude * noise(p * frequency);
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return value;
}

// Domain-warped fbm — creates the "tissue" wriggling effect
float warpedFbm(vec2 p, float speed) {
  float t = uTime * speed;

  // First warp layer
  vec2 q = vec2(
    fbm(p + vec2(0.0,  0.0) + t * 0.15, 4),
    fbm(p + vec2(5.2,  1.3) + t * 0.12, 4)
  );

  // Second warp layer (deeper, slower)
  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.08, 4),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.06, 4)
  );

  return fbm(p + 4.0 * r, 5);
}

// ── Glitch Distortion ─────────────────────────────────────────────────────────
vec2 glitchUv(vec2 uv) {
  if (uGlitchAmount < 0.001) return uv;

  float t = uTime * 60.0;
  float band = floor(uv.y * 20.0);
  float bandNoise = fract(sin(band * 127.1 + t) * 43758.5);

  // Horizontal slice shift
  float shift = (bandNoise - 0.5) * uGlitchAmount * 0.08;

  // Vertical tear
  float tear = step(0.98 - uGlitchAmount * 0.5, bandNoise) * uGlitchAmount * 0.02;

  return uv + vec2(shift, tear);
}

// ── Main ──────────────────────────────────────────────────────────────────────
void main() {
  vec2 uv = vUv;

  // Apply glitch distortion first
  uv = glitchUv(uv);

  // Aspect-correct coordinates
  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  // CPU load controls wriggle speed (0.3x at idle → 2.0x at full load)
  float speed = 0.3 + uCpuLoad * 1.7;

  // Sample domain-warped noise
  float f = warpedFbm(p * 2.5, speed);

  // Remap to [0, 1] with contrast boost
  f = f * 0.5 + 0.5;
  f = pow(f, 1.4);

  // ── Color Palette ──────────────────────────────────────────────────────────
  // Base: deep void purple-black
  vec3 colorDark   = vec3(0.04, 0.01, 0.06);   // #0a0310 — void black
  vec3 colorMid    = vec3(0.11, 0.04, 0.20);   // #1c0a33 — deep purple
  vec3 colorBright = vec3(0.18, 0.07, 0.30);   // #2d1248 — purple vein

  // Memory pressure shifts toward deep crimson
  vec3 colorCrimson = vec3(0.24, 0.02, 0.02);  // #3d0505 — gangrene red
  vec3 colorBlood   = vec3(0.35, 0.03, 0.03);  // #590505 — blood

  // Interpolate base palette with crimson based on memory load
  float memShift = smoothstep(0.3, 0.9, uMemPercent);
  colorMid    = mix(colorMid,    colorCrimson, memShift * 0.7);
  colorBright = mix(colorBright, colorBlood,   memShift * 0.6);

  // Three-stop color gradient along noise value
  vec3 color;
  if (f < 0.4) {
    color = mix(colorDark, colorMid, f / 0.4);
  } else if (f < 0.75) {
    color = mix(colorMid, colorBright, (f - 0.4) / 0.35);
  } else {
    // Bright veins — subtle purple glow
    vec3 veinColor = mix(colorBright, vec3(0.30, 0.10, 0.50), (f - 0.75) / 0.25);
    color = veinColor;
  }

  // ── Vignette ───────────────────────────────────────────────────────────────
  float vignette = 1.0 - smoothstep(0.4, 1.2, length(uv - 0.5) * 2.0);
  color *= vignette * 0.85 + 0.15;

  // ── Glitch red noise overlay ───────────────────────────────────────────────
  if (uGlitchAmount > 0.01) {
    float rNoise = fract(sin(dot(uv, vec2(12.9898, 78.233)) + uTime * 100.0) * 43758.5);
    float rFlash = step(0.7, rNoise) * uGlitchAmount;
    color = mix(color, vec3(0.8, 0.0, 0.05), rFlash * 0.4);

    // Chromatic aberration
    float aberr = uGlitchAmount * 0.005;
    // (Applied via UV offset — simplified for single-pass)
    color.r += fbm(uv + vec2(aberr, 0.0), 2) * uGlitchAmount * 0.3;
    color.b -= fbm(uv - vec2(aberr, 0.0), 2) * uGlitchAmount * 0.3;
  }

  // ── Scanline subtle texture ────────────────────────────────────────────────
  float scanline = sin(uv.y * uResolution.y * 1.5) * 0.5 + 0.5;
  color *= 1.0 - scanline * 0.03;

  // ── Final output ───────────────────────────────────────────────────────────
  // Keep luminance low (max ~0.35) to not interfere with text readability
  color = clamp(color, 0.0, 0.35);

  gl_FragColor = vec4(color, 1.0);
}
