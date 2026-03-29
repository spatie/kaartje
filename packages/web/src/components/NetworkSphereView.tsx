import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { DottedGlobe, FocusedCard } from "@kaartje/shared";
import type { LiveCard, StampHoverData } from "@kaartje/shared";
import { ApiClient } from "@kaartje/shared/api";
import type { WsEvent } from "@kaartje/shared/api";

const API_BASE_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";

const MIN_DELAY_MS = 800;

/** Animates the globe group from below into its resting position in 3D space */
function GlobeReveal({ revealed, children }: { revealed: boolean; children: ReactNode }) {
  const groupRef = useRef<Group>(null!);
  const currentY = useRef(-14); // start well below camera view

  useFrame(() => {
    const target = revealed ? -0.8 : -14;
    currentY.current += (target - currentY.current) * 0.025;
    groupRef.current.position.y = currentY.current;
  });

  return <group ref={groupRef}>{children}</group>;
}

export function NetworkSphereView() {
  const [revealed, setRevealed] = useState(false);
  const [liveCards, setLiveCards] = useState<LiveCard[]>([]);
  const [persistentCards, setPersistentCards] = useState<LiveCard[]>([]);
  const [hoveredCard, setHoveredCard] = useState<StampHoverData | null>(null);
  const [pinnedCard, setPinnedCard] = useState<StampHoverData | null>(null);
  const canvasReady = useRef(false);
  const timerReady = useRef(false);
  const revealedRef = useRef(false);
  const mountTime = useRef(Date.now());

  // Stable tryReveal — uses refs, never recreated
  const tryReveal = useCallback(() => {
    if (canvasReady.current && timerReady.current && !revealedRef.current) {
      revealedRef.current = true;
      requestAnimationFrame(() => setRevealed(true));
    }
  }, []);

  useEffect(() => {
    const remaining = MIN_DELAY_MS - (Date.now() - mountTime.current);
    const timer = setTimeout(
      () => {
        timerReady.current = true;
        tryReveal();
      },
      Math.max(0, remaining),
    );
    return () => clearTimeout(timer);
  }, [tryReveal]);

  // Single API client instance
  const client = useMemo(() => new ApiClient({ baseUrl: API_BASE_URL }), []);

  // Fetch postcards in batches, preload each image before adding to globe
  useEffect(() => {
    let cancelled = false;
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 300; // ms between batches

    function preloadImage(url: string): Promise<void> {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve();
        img.onerror = () => resolve(); // skip failed images, don't block
        img.src = url;
      });
    }

    async function fetchBatches() {
      let cursor: string | null = null;

      while (!cancelled) {
        try {
          const { postcards, nextCursor } = await client.listPostcards({ limit: BATCH_SIZE, cursor: cursor ?? undefined });

          if (cancelled) break;

          const cards: LiveCard[] = postcards
            .filter((p) => p.latitude != null && p.longitude != null && p.frontImageUrl)
            .map((p) => ({
              id: p.id,
              frontImageUrl: p.frontImageUrl,
              latitude: p.latitude as number,
              longitude: p.longitude as number,
              senderName: p.senderName ?? undefined,
              message: p.message ?? undefined,
              country: p.country ?? undefined,
            }));

          if (cards.length > 0) {
            // Preload all images in this batch before adding cards to the globe
            await Promise.all(cards.map((c) => preloadImage(c.frontImageUrl)));
            if (!cancelled) {
              setPersistentCards((prev) => [...prev, ...cards]);
            }
          }

          if (!nextCursor) break;
          cursor = nextCursor;

          // Brief pause between batches
          await new Promise((r) => setTimeout(r, BATCH_DELAY));
        } catch (err) {
          console.warn("[API] Failed to fetch postcards:", err);
          break;
        }
      }
    }

    fetchBatches();
    return () => { cancelled = true; };
  }, [client]);

  // WebSocket connection for live postcard events
  useEffect(() => {
    const connection = client.connectWebSocket({
      onEvent: (event: WsEvent) => {
        if (event.event === "card:scanned") {
          const { postcard } = event.data;
          if (postcard.latitude != null && postcard.longitude != null && postcard.frontImageUrl) {
            setLiveCards((prev) => {
              if (prev.length >= 50) return prev; // cap to prevent resource exhaustion
              return [
                ...prev,
                {
                  id: postcard.id,
                  frontImageUrl: postcard.frontImageUrl,
                  latitude: postcard.latitude as number,
                  longitude: postcard.longitude as number,
                  senderName: postcard.senderName ?? undefined,
                  message: postcard.message ?? undefined,
                  country: postcard.country ?? undefined,
                },
              ];
            });
          }
        }
      },
    });

    return () => connection.close();
  }, [client]);

  // Remove live cards once they land to prevent unbounded growth
  const handleCardLanded = useCallback((card: LiveCard, _clockTime: number) => {
    setLiveCards((prev) => prev.filter((c) => c.id !== card.id));
  }, []);

  const handleCanvasCreated = useCallback(() => {
    canvasReady.current = true;
    tryReveal();
  }, [tryReveal]);

  return (
    <>
      <div style={{ width: "100%", height: "100%" }}>
        <Canvas camera={{ position: [0, 3.5, 8], fov: 45 }} onCreated={handleCanvasCreated}>
          <GlobeReveal revealed={revealed}>
            <DottedGlobe
              arcDelay={10}
              liveCards={liveCards}
              persistentCards={persistentCards}
              onCardHover={setHoveredCard}
              onCardSelect={setPinnedCard}
              onCardLanded={handleCardLanded}
              paused={pinnedCard !== null}
            />
          </GlobeReveal>

          {/* Focused card — flies from globe to camera on click */}
          {pinnedCard && (
            <FocusedCard
              card={pinnedCard}
              globeRadius={1.6}
              onClose={() => setPinnedCard(null)}
            />
          )}
        </Canvas>
      </div>
    </>
  );
}
