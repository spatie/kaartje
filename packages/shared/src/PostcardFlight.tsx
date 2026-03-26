import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { postcardFlightVertex, postcardFlightFragment } from "./postcard-flight-shaders";
import { latLngToVec3 } from "./geo";
import { createBackTexture } from "./postcard-back";

const DURATION = 10.0;
const CARD_ASPECT = 0.67;
const NUM_ORBITS = 2.5;
const START_SCALE = 1.0;
const END_SCALE = 0.06;

// Fallback texture
const FALLBACK_TEXTURE: THREE.Texture = (() => {
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
  return new THREE.CanvasTexture(canvas);
})();

function useTextureSafe(url: string): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(FALLBACK_TEXTURE);

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

interface PostcardFlightProps {
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

  const texture = useTextureSafe(frontImageUrl);

  const backTexture = useMemo(
    () => createBackTexture({ senderName, message, country }),
    [senderName, message, country],
  );

  const landingPos = useMemo(
    () => new THREE.Vector3(...latLngToVec3(latitude, longitude, radius)),
    [latitude, longitude, radius],
  );

  const uniforms = useRef({
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uPosition: { value: new THREE.Vector3() },
    uScale: { value: START_SCALE },
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

    // Simple orbit: rotate around Y axis, spiral inward, descend
    // Angle: 2.5 full orbits = 5π radians
    const angle = p * NUM_ORBITS * Math.PI * 2;

    // Distance from center: start at 6 (far, visible from camera at z=8), end at globe radius
    const startDist = 6;
    const endDist = radius; // 2.5
    const dist = startDist + (endDist - startDist) * p;

    // Height: start at y=2 (camera height), end at landing y
    const startY = 2;
    const endY = landingPos.y;
    const y = startY + (endY - startY) * p;

    // Position: orbit in XZ plane
    const x = Math.sin(angle) * dist;
    const z = Math.cos(angle) * dist;

    // Scale: large → tiny
    const scale = START_SCALE + (END_SCALE - START_SCALE) * p;

    // Update shader uniforms
    uniforms.uProgress.value = p;
    uniforms.uTime.value = elapsed;
    uniforms.uPosition.value.set(x, y, z);
    uniforms.uScale.value = scale;

    if (p >= 1.0 && !landed.current) {
      landed.current = true;
      onLanded(landingPos.clone(), elapsed);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, CARD_ASPECT]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={postcardFlightVertex}
        fragmentShader={postcardFlightFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
