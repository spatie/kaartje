import { useRef, useState, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PostcardFlight } from "./PostcardFlight";
import { latLngToVec3 } from "./geo";
import type { LiveCard } from "./types";

const PERSIST_DURATION = 30;
const FADE_DURATION = 3;

export function LandedCardStamp({
  latitude,
  longitude,
  radius,
  frontImageUrl,
  landedAt,
  onExpired,
}: {
  latitude: number;
  longitude: number;
  radius: number;
  frontImageUrl: string;
  landedAt: number;
  onExpired: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const expired = useRef(false);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  const position = latLngToVec3(latitude, longitude, radius * 1.01);
  const normal = new THREE.Vector3(...position).normalize();

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      frontImageUrl,
      (tex) => setTexture(tex),
      undefined,
      () => {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 22;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#c45a3c";
        ctx.fillRect(0, 0, 32, 22);
        setTexture(new THREE.CanvasTexture(canvas));
      },
    );
  }, [frontImageUrl]);

  useFrame((state) => {
    if (expired.current) return;

    const age = state.clock.elapsedTime - landedAt;
    if (age > PERSIST_DURATION + FADE_DURATION) {
      expired.current = true;
      onExpired();
      return;
    }

    if (age > PERSIST_DURATION && materialRef.current) {
      materialRef.current.opacity = 1.0 - (age - PERSIST_DURATION) / FADE_DURATION;
    }
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onUpdate={(self) => {
        const lookTarget = new THREE.Vector3(...position).add(normal);
        self.lookAt(lookTarget);
      }}
    >
      <planeGeometry args={[0.08, 0.08 * 0.67]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        depthWrite={false}
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
  // Track which cards have landed so we stop rendering their flight
  const landedIds = useRef<Set<string>>(new Set());

  const handleLanded = useCallback(
    (card: LiveCard, _worldPos: THREE.Vector3, clockTime: number) => {
      landedIds.current.add(card.id);
      onCardLanded(card, clockTime);
    },
    [onCardLanded],
  );

  // Only render flights for cards that haven't landed
  const flyingCards = cards.filter((c) => !landedIds.current.has(c.id));

  return (
    <group>
      {flyingCards.map((card) => (
        <PostcardFlight
          key={card.id}
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
