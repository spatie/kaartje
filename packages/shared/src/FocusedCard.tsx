import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createBackTexture } from "./postcard-back";
import { latLngToVec3 } from "./geo";
import type { StampHoverData } from "./PostcardFlightLayer";

const CARD_ASPECT = 0.67;
const ANIM_DURATION = 2.0; // seconds for open/close

// ---------------------------------------------------------------------------
// Vertex shader — arc flight, paper curl/flutter, settle wobble
// ---------------------------------------------------------------------------
const focusVertex = /* glsl */ `
  uniform float uProgress;   // 0 = at stamp, 1 = in front of camera
  uniform float uTime;
  uniform vec3  uStartPos;
  uniform vec3  uTargetPos;
  uniform float uRotY;       // user-controlled Y rotation
  uniform float uScale;
  uniform float uZoom;       // scroll zoom multiplier (1 = default)
  uniform vec2  uOffset;     // pan offset in camera-plane units
  uniform vec3  uCamRight;   // camera right axis (world space)
  uniform vec3  uCamUp;      // camera up axis (world space)
  uniform vec3  uCamFwd;     // camera forward axis (world space)

  varying vec2  vUv;
  varying float vCurl;

  #define PI  3.14159265
  #define TAU 6.28318530

  // --- Simplex noise (compact) ---
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

  // --- Rotation ---
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

  // --- Easing ---
  float easeOutBack(float t) {
    float c1 = 1.70158;
    float c3 = c1 + 1.0;
    return 1.0 + c3 * pow(t - 1.0, 3.0) + c1 * pow(t - 1.0, 2.0);
  }
  float easeInOutCubic(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    vUv = uv;

    float p = clamp(uProgress, 0.0, 1.0);
    float ep = easeInOutCubic(p);

    // --- Arc path: straight line + upward arc in the middle ---
    vec3 worldPos = mix(uStartPos, uTargetPos, ep);
    float arc = sin(ep * PI) * 2.0;
    worldPos.y += arc;

    // --- Wind drift during flight (fades as card settles) ---
    float flightWeight = sin(p * PI); // peaks at 0.5, zero at 0 and 1
    float windX = snoise(vec3(uTime * 0.5, 0.0, 0.0)) * 0.4 * flightWeight;
    float windY = snoise(vec3(0.0, uTime * 0.4, 0.0)) * 0.2 * flightWeight;
    float windZ = snoise(vec3(0.0, 0.0, uTime * 0.6)) * 0.3 * flightWeight;
    worldPos += vec3(windX, windY, windZ);

    // --- Scale: stamp size → full size with slight overshoot ---
    float scaleP = easeOutBack(p);
    float s = mix(0.06, uScale, scaleP);

    // --- Rotation ---
    // Camera-facing orientation (card aligned to camera view plane)
    // Apply user Y rotation on top
    vec3 cr = uCamRight;
    vec3 cu = uCamUp;
    vec3 cf = uCamFwd;
    // Rotate the camera basis by user Y rotation
    float cosR = cos(uRotY), sinR = sin(uRotY);
    vec3 rotRight = cr * cosR + cf * sinR;
    vec3 rotFwd   = -cr * sinR + cf * cosR;
    mat3 cameraRot = mat3(rotRight, cu, rotFwd);

    // Flight tumble (active during transit, fades to zero at start/end)
    float tumble = flightWeight;
    float flyRotY = snoise(vec3(uTime * 0.6, 1.0, 0.0)) * PI * 0.8 * tumble;
    float flyRotX = snoise(vec3(0.0, uTime * 0.5, 1.0)) * 0.4 * tumble;
    float flyRotZ = sin(uTime * 1.5) * 0.15 * tumble;
    mat3 tumbleRot = rotateY(flyRotY) * rotateX(flyRotX) * rotateZ(flyRotZ);

    // Blend: tumble during flight → camera-facing when settled
    mat3 rot;
    for (int i = 0; i < 3; i++) {
      rot[i] = mix(tumbleRot[i], cameraRot[i], ep);
    }

    // Settle wobble
    float settleWeight = smoothstep(0.7, 1.0, p);
    float settleDecay = exp(-(p - 0.7) * 12.0) * settleWeight;
    rot = rot * rotateZ(sin(uTime * 3.0) * 0.03 * settleDecay)
              * rotateX(sin(uTime * 2.5 + 1.0) * 0.015 * settleDecay);

    // --- Paper curl/flutter during flight ---
    float curlAmount = snoise(vec3(uTime * 0.8, 2.0, 0.0)) * 0.12 * tumble;
    vec3 localPos = position;
    float curlDisp = curlAmount * sin(localPos.x * PI);
    localPos.z += curlDisp;

    // Surface ripple
    float ripple = snoise(vec3(localPos.x * 4.0, localPos.y * 4.0, uTime * 2.0))
                 * 0.025 * tumble;
    localPos.z += ripple;

    vCurl = abs(curlDisp) + abs(ripple);

    // --- Final composition ---
    // Apply zoom and pan offset (only when settled, blended by progress)
    float zoomedScale = s * mix(1.0, uZoom, ep);
    vec3 panOffset = (uCamRight * uOffset.x + uCamUp * uOffset.y) * ep;

    vec3 transformed = rot * (localPos * zoomedScale) + worldPos + panOffset;

    vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

// ---------------------------------------------------------------------------
// Fragment shader — front/back textures, paper effects
// ---------------------------------------------------------------------------
const focusFragment = /* glsl */ `
  precision highp float;

  uniform sampler2D uFrontTex;
  uniform sampler2D uBackTex;
  uniform float uProgress;
  uniform float uTime;

  varying vec2  vUv;
  varying float vCurl;

  void main() {
    vec4 color;

    if (gl_FrontFacing) {
      color = texture2D(uFrontTex, vUv);
    } else {
      color = texture2D(uBackTex, vec2(1.0 - vUv.x, vUv.y));
    }

    // Paper grain
    float grain = fract(sin(dot(vUv * 400.0 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    color.rgb += (grain - 0.5) * 0.02;

    // Curl shadow
    color.rgb *= 1.0 - vCurl * 1.5;

    // Specular on curled edges
    float spec = smoothstep(0.02, 0.06, vCurl) * 0.1;
    color.rgb += vec3(1.0, 0.95, 0.9) * spec;

    // Vignette
    vec2 center = vUv - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.3;
    color.rgb *= vignette;

    // Fade in
    float fadeIn = smoothstep(0.0, 0.15, uProgress);
    color.a *= fadeIn;

    gl_FragColor = color;
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FocusedCardProps {
  card: StampHoverData;
  globeRadius: number;
  onClose: () => void;
}

export function FocusedCard({ card, globeRadius, onClose }: FocusedCardProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const progress = useRef(0);         // 0→1 open, 1→0 close
  const animStart = useRef(-1);       // clock time when animation began
  const closing = useRef(false);
  const closeFromProgress = useRef(1); // progress value when close started
  const rotY = useRef(0);
  const zoom = useRef(1);
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const lastPointerX = useRef(0);
  const lastPointerY = useRef(0);

  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(card.frontImageUrl, (tex) => setFrontTex(tex));
  }, [card.frontImageUrl]);

  const backTex = useMemo(
    () =>
      createBackTexture({
        senderName: card.senderName,
        message: card.message,
        country: card.country,
      }),
    [card.senderName, card.message, card.country],
  );

  const startPos = useMemo(() => {
    if (card.worldPosition) {
      return new THREE.Vector3(...card.worldPosition);
    }
    return new THREE.Vector3(
      ...latLngToVec3(card.latitude, card.longitude, globeRadius * 1.01),
    );
  }, [card.worldPosition, card.latitude, card.longitude, globeRadius]);

  const targetPos = useMemo(() => {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return camera.position.clone().add(dir.multiplyScalar(3.5));
  }, [camera]);

  const displayScale = useMemo(() => {
    const vFov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const visibleHeight = 2 * Math.tan(vFov / 2) * 3.5;
    return visibleHeight * 0.45;
  }, [camera]);

  const uniforms = useRef({
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uStartPos: { value: startPos },
    uTargetPos: { value: targetPos },
    uRotY: { value: 0 },
    uScale: { value: displayScale },
    uZoom: { value: 1 },
    uOffset: { value: new THREE.Vector2(0, 0) },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
    uFrontTex: { value: frontTex },
    uBackTex: { value: backTex },
  }).current;

  useEffect(() => {
    uniforms.uFrontTex.value = frontTex;
    if (materialRef.current) materialRef.current.uniformsNeedUpdate = true;
  }, [frontTex, uniforms]);

  useEffect(() => {
    uniforms.uBackTex.value = backTex;
    if (materialRef.current) materialRef.current.uniformsNeedUpdate = true;
  }, [backTex, uniforms]);

  // Pointer interactions:
  // - Left drag: horizontal = rotate, swipe up = close
  // - Middle/right drag: pan the card
  // - Scroll: zoom
  const dragStartY = useRef(0);
  const totalDragY = useRef(0);
  const SWIPE_THRESHOLD = 80;

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      lastPointerX.current = e.clientX;
      lastPointerY.current = e.clientY;

      if (e.button === 1 || e.button === 2) {
        // Middle or right button → pan
        isPanning.current = true;
        e.preventDefault();
      } else {
        // Left button → rotate + swipe-up close
        isDragging.current = true;
        dragStartY.current = e.clientY;
        totalDragY.current = 0;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lastPointerX.current;
      const dy = e.clientY - lastPointerY.current;
      lastPointerX.current = e.clientX;
      lastPointerY.current = e.clientY;

      if (isPanning.current) {
        // Pan: move card in camera plane
        offsetX.current += dx * 0.005;
        offsetY.current -= dy * 0.005; // invert Y so dragging up moves card up
      } else if (isDragging.current) {
        // Left drag: rotate
        rotY.current += dx * 0.008;
        totalDragY.current = dragStartY.current - e.clientY;
      }
    };

    const onPointerUp = () => {
      if (isDragging.current && totalDragY.current > SWIPE_THRESHOLD) {
        startClose();
      }
      isDragging.current = false;
      isPanning.current = false;
      totalDragY.current = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      zoom.current = Math.max(0.3, Math.min(5, zoom.current + delta));
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl]);

  const startClose = () => {
    if (!closing.current) {
      closing.current = true;
      closeFromProgress.current = progress.current;
      animStart.current = -1; // reset clock so reverse takes full duration
    }
  };

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") startClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((state) => {
    const now = state.clock.elapsedTime;

    // Start the animation clock on first frame
    if (animStart.current < 0) animStart.current = now;

    const elapsed = now - animStart.current;
    const t = Math.min(elapsed / ANIM_DURATION, 1);

    if (closing.current) {
      // Reverse: animate from closeFromProgress back to 0
      progress.current = closeFromProgress.current * (1 - t);
      if (t >= 1) {
        onClose();
        return;
      }
    } else {
      progress.current = t;
    }

    uniforms.uProgress.value = progress.current;
    uniforms.uTime.value = now;
    uniforms.uRotY.value = rotY.current;
    uniforms.uZoom.value = zoom.current;
    uniforms.uOffset.value.set(offsetX.current, offsetY.current);

    // Update camera basis vectors
    const camMat = camera.matrixWorld;
    uniforms.uCamRight.value.set(camMat.elements[0], camMat.elements[1], camMat.elements[2]).normalize();
    uniforms.uCamUp.value.set(camMat.elements[4], camMat.elements[5], camMat.elements[6]).normalize();
    uniforms.uCamFwd.value.set(-camMat.elements[8], -camMat.elements[9], -camMat.elements[10]).normalize();
  });

  if (!frontTex) return null;

  return (
    <>
      {/* Card mesh — subdivided for vertex deformation */}
      <mesh ref={meshRef} renderOrder={999}>
        <planeGeometry args={[1, CARD_ASPECT, 12, 8]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={focusVertex}
          fragmentShader={focusFragment}
          uniforms={uniforms}
          transparent
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
