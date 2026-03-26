export const postcardFlightVertex = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uPosition;
  uniform float uScale;

  varying vec2 vUv;

  #define PI 3.14159265

  mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
  }

  mat3 rotateX(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
  }

  mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
  }

  void main() {
    vUv = uv;

    // Tumble: visible spin that calms down near landing
    float tumble = 1.0 - smoothstep(0.8, 1.0, uProgress);
    float yRot = uProgress * PI * 6.0 + sin(uTime * 1.5) * 0.4 * tumble;
    float xTilt = sin(uProgress * PI * 2.0) * 0.3 * tumble;
    float zFlutter = cos(uTime * 2.0) * 0.15 * tumble;

    mat3 rot = rotateY(yRot) * rotateX(xTilt) * rotateZ(zFlutter);

    // Scale and rotate the plane vertices, then translate to orbit position
    vec3 transformed = rot * (position * uScale) + uPosition;

    vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const postcardFlightFragment = /* glsl */ `
  precision highp float;

  uniform sampler2D uFrontTexture;
  uniform sampler2D uBackTexture;
  uniform float uOpacity;
  uniform float uProgress;

  varying vec2 vUv;

  void main() {
    vec4 color;

    if (gl_FrontFacing) {
      color = texture2D(uFrontTexture, vUv);
    } else {
      // Back face: sample back texture with mirrored UVs
      color = texture2D(uBackTexture, vec2(1.0 - vUv.x, vUv.y));
    }

    // Vignette for depth
    vec2 center = vUv - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.5;
    color.rgb *= vignette;

    // Edge darkening
    float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edge = smoothstep(0.0, 0.02, edgeDist);
    color.a *= edge;

    color.a *= uOpacity;

    gl_FragColor = color;
  }
`;
