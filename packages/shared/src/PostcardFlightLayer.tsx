import { useRef, useState, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PostcardFlight } from "./PostcardFlight";
import { latLngToVec3 } from "./geo";
import type { LiveCard } from "./types";

const PERSIST_DURATION = 30;
const FADE_DURATION = 3;
const HOVER_SCALE = 2.4;
const SCALE_LERP = 0.12;

// ---------------------------------------------------------------------------
// Stamp shader — samples texture, fades backfacing stamps like land dots
// ---------------------------------------------------------------------------

const stampVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const stampFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(uMap, vUv);
    color.a *= uOpacity;
    gl_FragColor = color;
  }
`;

export interface StampHoverData {
  frontImageUrl: string;
  latitude: number;
  longitude: number;
  senderName?: string;
  message?: string;
  country?: string;
  /** World-space position of the stamp at click time */
  worldPosition?: [number, number, number];
}

/** Shared stamp logic — billboard, fade, hover/click */
function useStamp(card: LiveCard, radius: number) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const currentScale = useRef(1);
  const targetScale = useRef(1);
  const pinned = useRef(false);
  const camera = useThree((s) => s.camera);
  const parentInvQuat = useRef(new THREE.Quaternion());
  const worldPos = useRef(new THREE.Vector3());

  const position = latLngToVec3(card.latitude, card.longitude, radius * 1.01);

  const cardData: StampHoverData = {
    frontImageUrl: card.frontImageUrl,
    latitude: card.latitude,
    longitude: card.longitude,
    senderName: card.senderName,
    message: card.message,
    country: card.country,
  };

  const uniforms = useRef({
    uMap: { value: null as THREE.Texture | null },
    uOpacity: { value: 1.0 },
  }).current;

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      card.frontImageUrl,
      (tex) => {
        setTexture(tex);
        uniforms.uMap.value = tex;
      },
      undefined,
      () => {
        if (typeof document === "undefined") return;
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 22;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#c45a3c";
        ctx.fillRect(0, 0, 32, 22);
        const fallback = new THREE.CanvasTexture(canvas);
        setTexture(fallback);
        uniforms.uMap.value = fallback;
      },
    );
  }, [card.frontImageUrl, uniforms]);

  const billboard = () => {
    if (!meshRef.current) return;
    meshRef.current.scale.setScalar(currentScale.current);
    const parent = meshRef.current.parent;
    if (parent) {
      parent.getWorldQuaternion(parentInvQuat.current).invert();
      meshRef.current.quaternion.copy(camera.quaternion).premultiply(parentInvQuat.current);
    }
    meshRef.current.getWorldPosition(worldPos.current);
    const toCamera = camera.position.clone().sub(worldPos.current).normalize();
    const outward = worldPos.current.clone().normalize();
    return toCamera.dot(outward);
  };

  return { meshRef, texture, currentScale, targetScale, pinned, position, cardData, uniforms, billboard };
}

/** Permanent stamp for postcards loaded from the database — never expires */
export function PersistentCardStamp({
  card,
  radius,
  onHover,
  onSelect,
}: {
  card: LiveCard;
  radius: number;
  onHover?: (data: StampHoverData | null) => void;
  onSelect?: (data: StampHoverData | null) => void;
}) {
  const { meshRef, texture, currentScale, targetScale, pinned, position, cardData, uniforms, billboard } =
    useStamp(card, radius);

  useFrame(() => {
    currentScale.current += (targetScale.current - currentScale.current) * SCALE_LERP;
    const facing = billboard();
    if (facing != null && meshRef.current) {
      uniforms.uOpacity.value = Math.max(0, Math.min(1, (facing + 0.05) / 0.2));
      meshRef.current.visible = uniforms.uOpacity.value > 0.001;
    }
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        targetScale.current = HOVER_SCALE;
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        onHover?.(cardData);
      }}
      onPointerOut={() => {
        targetScale.current = 1;
        if (typeof document !== "undefined") document.body.style.cursor = "";
        onHover?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        pinned.current = !pinned.current;
        if (pinned.current) {
          const wp = e.point;
          onSelect?.({ ...cardData, worldPosition: [wp.x, wp.y, wp.z] });
        } else {
          onSelect?.(null);
        }
      }}
    >
      <planeGeometry args={[0.12, 0.12 * 0.67]} />
      <shaderMaterial
        vertexShader={stampVertex}
        fragmentShader={stampFragment}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function LandedCardStamp({
  card,
  radius,
  landedAt,
  onExpired,
  onHover,
  onSelect,
}: {
  card: LiveCard;
  radius: number;
  landedAt: number;
  onExpired: () => void;
  onHover?: (data: StampHoverData | null) => void;
  onSelect?: (data: StampHoverData | null) => void;
}) {
  const { meshRef, texture, currentScale, targetScale, pinned, position, cardData, uniforms, billboard } =
    useStamp(card, radius);
  const expired = useRef(false);

  useFrame((state) => {
    if (expired.current) return;

    const age = state.clock.elapsedTime - landedAt;
    if (age > PERSIST_DURATION + FADE_DURATION) {
      expired.current = true;
      onExpired();
      return;
    }

    let opacity = 1.0;
    if (age > PERSIST_DURATION) {
      opacity = 1.0 - (age - PERSIST_DURATION) / FADE_DURATION;
    }

    currentScale.current += (targetScale.current - currentScale.current) * SCALE_LERP;
    const facing = billboard();
    if (facing != null && meshRef.current) {
      const globeFade = Math.max(0, Math.min(1, (facing + 0.05) / 0.2));
      uniforms.uOpacity.value = opacity * globeFade;
      meshRef.current.visible = uniforms.uOpacity.value > 0.001;
    }
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        targetScale.current = HOVER_SCALE;
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        onHover?.(cardData);
      }}
      onPointerOut={() => {
        targetScale.current = 1;
        if (typeof document !== "undefined") document.body.style.cursor = "";
        onHover?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        pinned.current = !pinned.current;
        if (pinned.current) {
          const wp = e.point;
          onSelect?.({ ...cardData, worldPosition: [wp.x, wp.y, wp.z] });
        } else {
          onSelect?.(null);
        }
      }}
    >
      <planeGeometry args={[0.12, 0.12 * 0.67]} />
      <shaderMaterial
        vertexShader={stampVertex}
        fragmentShader={stampFragment}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface PostcardFlightLayerProps {
  cards: LiveCard[];
  radius: number;
  onCardLanded: (card: LiveCard, clockTime: number) => void;
}

export function PostcardFlightLayer({ cards, radius, onCardLanded }: PostcardFlightLayerProps) {
  const landedIds = useRef<Set<string>>(new Set());

  const handleLanded = useCallback(
    (card: LiveCard, _worldPos: THREE.Vector3, clockTime: number) => {
      landedIds.current.add(card.id);
      onCardLanded(card, clockTime);
    },
    [onCardLanded],
  );

  const flyingCards = cards.filter((c) => !landedIds.current.has(c.id));

  return (
    <group>
      {flyingCards.map((card) => (
        <PostcardFlight
          key={card.id}
          id={card.id}
          frontImageUrl={card.frontImageUrl}
          latitude={card.latitude}
          longitude={card.longitude}
          radius={radius}
          senderName={card.senderName}
          message={card.message}
          country={card.country}
          onLanded={(pos, clockTime) => handleLanded(card, pos, clockTime)}
        />
      ))}
    </group>
  );
}
