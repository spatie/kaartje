export const arcVertex = /* glsl */ `
  varying float vT;
  varying vec3 vViewPos;
  varying vec3 vNormal;

  void main() {
    vT = uv.x;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`

export const arcFragment = /* glsl */ `
  precision highp float;

  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uColorStart;
  uniform vec3 uColorMid;
  uniform float uDimmed;

  varying float vT;
  varying vec3 vViewPos;
  varying vec3 vNormal;

  #define PI 3.14159265

  void main() {
    // Discard beyond revealed portion
    if (vT > uProgress + 0.005) discard;

    // Color gradient: terracotta at ends, beige/ink at peak
    float blend = sin(vT * PI);
    vec3 color = mix(uColorStart, uColorMid, blend);

    // Tail fade: bright near head, fading behind
    float tailLen = 0.35;
    float headPos = uProgress;
    float tailAlpha = smoothstep(headPos - tailLen, headPos, vT);

    // Head glow
    float headDist = abs(vT - headPos);
    float glow = exp(-headDist * 30.0);
    color += vec3(glow * 0.3);

    // Back-face fade (same convention as globe dots)
    vec3 viewDir = normalize(-vViewPos);
    float facing = dot(vNormal, viewDir);
    float backFade = facing > 0.0 ? 1.0 : max(0.0, 1.0 + facing * 1.5);

    // Dim completed arcs
    float alpha = tailAlpha * backFade * (1.0 - uDimmed * 0.6);

    // Once fully drawn, show full arc with slight gradient fade at ends
    if (uProgress >= 0.99) {
      float endFade = sin(vT * PI);
      alpha = max(endFade * 0.4, 0.15) * backFade * (1.0 - uDimmed * 0.6);
    }

    gl_FragColor = vec4(color, alpha);
  }
`
