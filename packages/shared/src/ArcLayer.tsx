import { memo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Arc } from './Arc'
import type { ArcTarget } from './types'

const BATCH_SIZE = 20
const BATCH_PAUSE = 2 // seconds between batches
const ARC_STAGGER = 0.15 // seconds between arcs within a batch
const ARC_DURATION = 2.5 // seconds for one arc to draw

interface ArcLayerProps {
  arcs: ArcTarget[]
  radius: number
}

export const ArcLayer = memo(function ArcLayer({ arcs, radius }: ArcLayerProps) {
  const [activeBatch, setActiveBatch] = useState(0)
  const batchTimer = useRef(0)
  const totalBatches = Math.ceil(arcs.length / BATCH_SIZE)

  useFrame((_, delta) => {
    if (totalBatches <= 1) return

    batchTimer.current += delta
    const batchDuration = BATCH_SIZE * ARC_STAGGER + ARC_DURATION + BATCH_PAUSE

    if (batchTimer.current > batchDuration) {
      batchTimer.current = 0
      setActiveBatch((prev) => (prev + 1) % totalBatches)
    }
  })

  return (
    <>
      {arcs.map((arc, i) => {
        const batch = Math.floor(i / BATCH_SIZE)
        const indexInBatch = i % BATCH_SIZE
        const isActive = batch === activeBatch
        const isPast = batch < activeBatch || (activeBatch === 0 && batch === totalBatches - 1 && totalBatches > 1)

        return (
          <Arc
            key={arc.id}
            latitude={arc.latitude}
            longitude={arc.longitude}
            radius={radius}
            delay={isActive ? indexInBatch * ARC_STAGGER : isPast ? 0 : 9999}
            dimmed={isPast}
          />
        )
      })}
    </>
  )
})
