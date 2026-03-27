// ---------------------------------------------------------------------------
// Postcard flight shaders — three-phase: approach → float → land
// ---------------------------------------------------------------------------

export const postcardFlightVertex = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform vec3  uStartPos;
  uniform vec3  uOrbitPos;
  uniform vec3  uLandPos;
  uniform float uScale;
  uniform float uSeed;          // per-card random seed

  varying vec2  vUv;
  varying float vCurl;          // curl amount passed to fragment for shadow

  #define PI  3.14159265
  #define TAU 6.28318530

  // -----------------------------------------------------------------------
  // Simplex 3D noise (Ashima Arts — compact GLSL version)
  // -----------------------------------------------------------------------
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Fractional Brownian Motion — two octaves for turbulence
  float fbm(vec3 p) {
    float v = 0.0;
    v += 0.5  * snoise(p);
    v += 0.25 * snoise(p * 2.1 + vec3(17.3));
    return v;
  }

  // -----------------------------------------------------------------------
  // Rotation helpers
  // -----------------------------------------------------------------------
  mat3 rotateY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0,s, 0,1,0, -s,0,c);
  }
  mat3 rotateX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1,0,0, 0,c,-s, 0,s,c);
  }
  mat3 rotateZ(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,-s,0, s,c,0, 0,0,1);
  }

  // -----------------------------------------------------------------------
  // Easing
  // -----------------------------------------------------------------------
  float easeInOutCubic(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    vUv = uv;

    // --- Unique time offset per card so they don't move in unison ---
    float t = uTime + uSeed * 100.0;

    // --- Three-phase flight path ---
    // Phase 1 (0–0.25):  approach from camera to orbit point
    // Phase 2 (0.25–0.65): float/drift near orbit point
    // Phase 3 (0.65–1.0):  descend and land

    float p1End = 0.25;
    float p2End = 0.65;

    vec3 worldPos;

    if (uProgress < p1End) {
      // Phase 1: fly from camera toward orbit point
      float lp = easeInOutCubic(uProgress / p1End);
      worldPos = mix(uStartPos, uOrbitPos, lp);
    } else if (uProgress < p2End) {
      // Phase 2: float/orbit near the globe
      float lp = (uProgress - p1End) / (p2End - p1End);

      // Gentle circular drift around the orbit point
      float angle = lp * PI * 1.5 + uSeed * TAU;
      float driftR = 0.6 + uSeed * 0.3;
      vec3 drift = vec3(
        cos(angle) * driftR,
        sin(angle * 1.3) * 0.3,
        sin(angle) * driftR
      ) * (1.0 - lp * 0.6);

      // Slowly drift toward landing spot
      worldPos = mix(uOrbitPos, uLandPos, lp * 0.35) + drift;
    } else {
      // Phase 3: descend to landing position
      float lp = easeInOutCubic((uProgress - p2End) / (1.0 - p2End));

      // Continue from where phase 2 ended (~35% toward land)
      vec3 phase2End = mix(uOrbitPos, uLandPos, 0.35);
      worldPos = mix(phase2End, uLandPos, lp);
    }

    // --- Wind turbulence (reduced near landing) ---
    float turbulenceStrength = 1.0 - smoothstep(0.55, 1.0, uProgress);

    vec3 noiseCoord = vec3(t * 0.4 + uSeed, t * 0.3, t * 0.5);
    float windX = fbm(noiseCoord) * 0.6 * turbulenceStrength;
    float windY = fbm(noiseCoord + vec3(31.7, 0.0, 0.0)) * 0.3 * turbulenceStrength;
    float windZ = fbm(noiseCoord + vec3(0.0, 47.3, 0.0)) * 0.5 * turbulenceStrength;
    worldPos += vec3(windX, windY, windZ);

    // --- Tumble rotation (chaotic spin that calms near landing) ---
    float tumble = 1.0 - smoothstep(0.55, 1.0, uProgress);

    // Primary spin axes — noise-driven for organic randomness
    float yRot = snoise(vec3(t * 0.8, uSeed, 0.0)) * PI * 2.0 * tumble
               + uProgress * PI * 4.0;  // base spin
    float xTilt = snoise(vec3(t * 0.6, 0.0, uSeed)) * 0.8 * tumble
               + sin(uProgress * PI) * 0.3;
    float zFlutter = snoise(vec3(0.0, t * 1.2, uSeed)) * 0.5 * tumble;

    // Near landing, orient card to face outward from globe
    float landBlend = smoothstep(0.75, 1.0, uProgress);

    mat3 tumbleRot = rotateY(yRot) * rotateX(xTilt) * rotateZ(zFlutter);

    // Landing orientation: card faces outward from globe center
    vec3 outward = normalize(uLandPos);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, outward));
    vec3 correctedUp = cross(outward, right);
    mat3 landRot = mat3(right, correctedUp, outward);

    mat3 rot = tumbleRot;
    for (int i = 0; i < 3; i++) {
      rot[i] = mix(rot[i], landRot[i], landBlend);
    }

    // --- Paper curl deformation ---
    float curlAmount = snoise(vec3(t * 0.5, uSeed * 3.0, 0.0)) * 0.15 * tumble;
    vec3 localPos = position;
    float curlDisp = curlAmount * sin(localPos.x * PI);
    localPos.z += curlDisp;

    // Flutter ripple along the card surface
    float ripple = snoise(vec3(localPos.x * 3.0, localPos.y * 3.0, t * 2.0))
                 * 0.03 * tumble;
    localPos.z += ripple;

    vCurl = abs(curlDisp) + abs(ripple);

    // --- Compose final position ---
    vec3 transformed = rot * (localPos * uScale) + worldPos;

    vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const postcardFlightFragment = /* glsl */ `
  precision highp float;

  uniform sampler2D uFrontTexture;
  uniform sampler2D uBackTexture;
  uniform float     uOpacity;
  uniform float     uProgress;
  uniform float     uTime;
  uniform float     uSeed;

  varying vec2  vUv;
  varying float vCurl;

  void main() {
    vec4 color;

    if (gl_FrontFacing) {
      color = texture2D(uFrontTexture, vUv);
    } else {
      // Back face: mirrored UVs
      color = texture2D(uBackTexture, vec2(1.0 - vUv.x, vUv.y));
    }

    // Subtle paper grain noise
    float grain = fract(sin(dot(vUv * 400.0 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    color.rgb += (grain - 0.5) * 0.03;

    // Vignette for depth
    vec2 center = vUv - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.6;
    color.rgb *= vignette;

    // Curl shadow — darker where the paper bends
    color.rgb *= 1.0 - vCurl * 2.0;

    // Specular highlight on curled edges (simulates paper catching light)
    float spec = smoothstep(0.02, 0.08, vCurl) * 0.15;
    color.rgb += vec3(1.0, 0.95, 0.9) * spec;

    // Fully opaque card
    color.a = 1.0;

    gl_FragColor = color;
  }
`;
