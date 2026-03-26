import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { DottedGlobe } from "@kaartje/shared";
import type { LiveCard } from "@kaartje/shared";
import { ApiClient } from "@kaartje/shared/api";
import type { WsEvent } from "@kaartje/shared/api";

const API_BASE_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";

// Globe won't reveal until at least this many ms after mount,
// giving the text animation time to relocate first
const MIN_DELAY_MS = 2000;

export function NetworkSphereView() {
  const [revealed, setRevealed] = useState(false);
  const [liveCards, setLiveCards] = useState<LiveCard[]>([]);
  const canvasReady = useRef(false);
  const timerReady = useRef(false);
  const mountTime = useRef(Date.now());

  const tryReveal = useCallback(() => {
    if (canvasReady.current && timerReady.current && !revealed) {
      requestAnimationFrame(() => setRevealed(true));
    }
  }, [revealed]);

  // Minimum delay before globe can appear
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

  // WebSocket connection for live postcard events
  useEffect(() => {
    const client = new ApiClient({ baseUrl: API_BASE_URL });
    const connection = client.connectWebSocket({
      onEvent: (event: WsEvent) => {
        if (event.event === "card:scanned") {
          const { postcard } = event.data;
          if (postcard.latitude != null && postcard.longitude != null && postcard.frontImageUrl) {
            setLiveCards((prev) => [
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
            ]);
          }
        }
      },
    });

    return () => connection.close();
  }, []);

  const handleCanvasCreated = useCallback(() => {
    canvasReady.current = true;
    tryReveal();
  }, [tryReveal]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transition:
          "transform 4.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 1.8s cubic-bezier(0.22, 1, 0.36, 1)",
        transform: revealed ? "translateY(0)" : "translateY(60%)",
        opacity: revealed ? 1 : 0,
      }}
    >
      <Canvas camera={{ position: [0, 2, 8], fov: 45 }} onCreated={handleCanvasCreated}>
        <DottedGlobe arcDelay={10} liveCards={liveCards} />
      </Canvas>
    </div>
  );
}
