import { memo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Arc } from "./Arc";
import type { ArcTarget } from "./types";

const BATCH_SIZE = 20;
const BATCH_PAUSE = 2; // seconds between batches
const ARC_STAGGER = 0.15; // seconds between arcs within a batch
const ARC_DURATION = 2.5; // seconds for one arc to draw

interface ArcLayerProps {
  arcs: ArcTarget[];
  radius: number;
  /** Global delay in seconds before any arcs start */
  delay?: number;
}

export const ArcLayer = memo(function ArcLayer({ arcs, radius, delay = 0 }: ArcLayerProps) {
  const [activeBatch, setActiveBatch] = useState(0);
  const batchTimer = useRef(0);
  const started = useRef(false);
  const startTime = useRef(-1);
  const totalBatches = Math.ceil(arcs.length / BATCH_SIZE);

  useFrame((state, delta) => {
    // Wait for global delay
    if (!started.current) {
      if (startTime.current < 0) startTime.current = state.clock.elapsedTime;
      if (state.clock.elapsedTime - startTime.current < delay) return;
      started.current = true;
    }

    if (totalBatches <= 1) return;

    batchTimer.current += delta;
    const batchDuration = BATCH_SIZE * ARC_STAGGER + ARC_DURATION + BATCH_PAUSE;

    if (batchTimer.current > batchDuration) {
      batchTimer.current = 0;
      setActiveBatch((prev) => (prev + 1) % totalBatches);
    }
  });

  return (
    <>
      {started.current &&
        arcs.map((arc, i) => {
          const batch = Math.floor(i / BATCH_SIZE);
          const indexInBatch = i % BATCH_SIZE;
          const isActive = batch === activeBatch;
          const isPast =
            batch < activeBatch ||
            (activeBatch === 0 && batch === totalBatches - 1 && totalBatches > 1);

          return (
            <Arc
              key={arc.id}
              latitude={arc.latitude}
              longitude={arc.longitude}
              radius={radius}
              delay={isActive ? indexInBatch * ARC_STAGGER : isPast ? 0 : 9999}
              dimmed={isPast}
            />
          );
        })}
    </>
  );
});
