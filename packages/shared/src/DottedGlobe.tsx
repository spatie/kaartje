import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import landDotsRaw from "./land-dots.json";

export interface DottedGlobeProps {
  /** Globe radius (default: 2.5) */
  radius?: number;
  /** Dot color (default: '#ede6db') */
  dotColor?: string;
  /** Dot size multiplier (default: 0.55) */
  dotSize?: number;
  /** Atmosphere glow color (default: '#1a3a5c') */
  glowColor?: string;
  /** Auto-rotation speed in rad/s (default: 0.1) */
  rotationSpeed?: number;
}

// Pre-computed unit-sphere positions — scaled to radius at render time
const UNIT_POSITIONS = new Float32Array(landDotsRaw as number[]);

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const dotVertex = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixelRatio * (150.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const dotFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.4) discard;
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vViewPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vec3 viewDir = normalize(-vViewPos);
    float fresnel = 1.0 - dot(viewDir, vNormal);
    fresnel = pow(fresnel, 3.5) * 0.55;
    gl_FragColor = vec4(uColor, fresnel);
  }
`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LandDots({
  positions,
  color,
  size,
}: {
  positions: Float32Array;
  color: string;
  size: number;
}) {
  const { gl } = useThree();

  const { geometry, uniforms } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    return {
      geometry: geo,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uPixelRatio: { value: gl.getPixelRatio() },
        uSize: { value: size },
      },
    };
  }, [positions, color, size, gl]);

  return (
    <points geometry={geometry}>
      <shaderMaterial vertexShader={dotVertex} fragmentShader={dotFragment} uniforms={uniforms} />
    </points>
  );
}

function Atmosphere({ radius, color }: { radius: number; color: string }) {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) } }), [color]);

  return (
    <mesh>
      <sphereGeometry args={[radius * 1.15, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

function scalePositions(unit: Float32Array, radius: number): Float32Array {
  if (radius === 1) return unit;
  const scaled = new Float32Array(unit.length);
  for (let i = 0; i < unit.length; i++) scaled[i] = unit[i] * radius;
  return scaled;
}

export function DottedGlobe({
  radius = 2.5,
  dotColor = "#ede6db",
  dotSize = 0.55,
  glowColor = "#1a3a5c",
  rotationSpeed = 0.1,
}: DottedGlobeProps = {}) {
  const groupRef = useRef<THREE.Group>(null!);
  const positions = useMemo(() => scalePositions(UNIT_POSITIONS, radius), [radius]);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * rotationSpeed;
  });

  return (
    <group ref={groupRef}>
      <LandDots positions={positions} color={dotColor} size={dotSize} />
      <Atmosphere radius={radius} color={glowColor} />
    </group>
  );
}
