import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { postcardFlightVertex, postcardFlightFragment } from "./postcard-flight-shaders";
import { latLngToVec3 } from "./geo";
import { createBackTexture } from "./postcard-back";

const DURATION = 14.0;
const CARD_ASPECT = 0.67;
const START_SCALE = 0.8;
const END_SCALE = 0.06;

// Fallback texture (web only — document is not available in React Native)
let FALLBACK_TEXTURE: THREE.Texture | null = null;
function getFallbackTexture(): THREE.Texture {
  if (FALLBACK_TEXTURE) return FALLBACK_TEXTURE;
  if (typeof document === "undefined") {
    FALLBACK_TEXTURE = new THREE.Texture();
    return FALLBACK_TEXTURE;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 86;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ede6db";
  ctx.fillRect(0, 0, 128, 86);
  ctx.strokeStyle = "#c45a3c";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 78);
  ctx.fillStyle = "#9b9489";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("\u2709", 64, 52);
  FALLBACK_TEXTURE = new THREE.CanvasTexture(canvas);
  return FALLBACK_TEXTURE;
}

function useTextureSafe(url: string): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => getFallbackTexture());

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (tex) => setTexture(tex),
      undefined,
      () => {},
    );
  }, [url]);

  return texture;
}

/** Seeded pseudo-random — deterministic per card ID */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return (h & 0x7fffffff) / 0x7fffffff; // 0..1
}

interface PostcardFlightProps {
  id: string;
  frontImageUrl: string;
  latitude: number;
  longitude: number;
  radius: number;
  senderName?: string;
  message?: string;
  country?: string;
  onLanded: (worldPosition: THREE.Vector3, clockTime: number) => void;
}

export function PostcardFlight({
  id,
  frontImageUrl,
  latitude,
  longitude,
  radius,
  senderName,
  message,
  country,
  onLanded,
}: PostcardFlightProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const startTime = useRef(-1);
  const landed = useRef(false);

  const camera = useThree((s) => s.camera);

  const texture = useTextureSafe(frontImageUrl);

  const backTexture = useMemo(
    () => createBackTexture({ senderName, message, country }),
    [senderName, message, country],
  );

  const seed = useMemo(() => hashSeed(id), [id]);

  const landingPos = useMemo(
    () => new THREE.Vector3(...latLngToVec3(latitude, longitude, radius)),
    [latitude, longitude, radius],
  );

  // Start from camera position — card appears to fly "from the viewer"
  const startPos = useMemo(() => {
    return camera.position.clone();
  }, []);

  // Orbit waypoint: a point near the globe surface offset from the landing spot
  // Seed varies the approach angle and height so cards spread vertically
  const orbitPos = useMemo(() => {
    const landDir = landingPos.clone().normalize();
    // Rotate around Y by a seed-varied angle for horizontal spread
    const offsetAngle = (0.3 + seed * 0.5) * Math.PI * 0.5;
    const cos = Math.cos(offsetAngle);
    const sin = Math.sin(offsetAngle);
    // Vary Y offset: spread from -0.4 to +0.4 based on seed
    const yOffset = (seed - 0.5) * 0.8;
    const offsetDir = new THREE.Vector3(
      landDir.x * cos + landDir.z * sin,
      landDir.y + yOffset,
      -landDir.x * sin + landDir.z * cos,
    ).normalize();
    return offsetDir.multiplyScalar(radius * 1.4);
  }, [landingPos, radius, seed]);

  const uniforms = useRef({
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uStartPos: { value: startPos },
    uOrbitPos: { value: orbitPos },
    uLandPos: { value: landingPos },
    uScale: { value: START_SCALE },
    uSeed: { value: seed },
    uFrontTexture: { value: texture },
    uBackTexture: { value: backTexture },
    uOpacity: { value: 1.0 },
  }).current;

  // Update texture uniforms when they load
  useEffect(() => {
    uniforms.uFrontTexture.value = texture;
    if (materialRef.current) materialRef.current.uniformsNeedUpdate = true;
  }, [texture, uniforms]);

  useEffect(() => {
    uniforms.uBackTexture.value = backTexture;
    if (materialRef.current) materialRef.current.uniformsNeedUpdate = true;
  }, [backTexture, uniforms]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (startTime.current < 0) startTime.current = elapsed;

    const dt = elapsed - startTime.current;
    const p = Math.min(dt / DURATION, 1);

    // Scale: large at start → shrink during approach → tiny at landing
    const approachEnd = 0.25;
    const floatScale = 0.3;
    let scale: number;
    if (p < approachEnd) {
      // Shrink from full to float size during approach
      scale = START_SCALE + (floatScale - START_SCALE) * (p / approachEnd);
    } else {
      // Shrink from float size to final stamp size
      const t = (p - approachEnd) / (1 - approachEnd);
      scale = floatScale + (END_SCALE - floatScale) * t;
    }

    // Update shader uniforms
    uniforms.uProgress.value = p;
    uniforms.uTime.value = elapsed;
    uniforms.uScale.value = scale;

    if (p >= 1.0 && !landed.current) {
      landed.current = true;
      onLanded(landingPos.clone(), elapsed);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, CARD_ASPECT, 8, 6]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={postcardFlightVertex}
        fragmentShader={postcardFlightFragment}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
