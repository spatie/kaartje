import { useRef, useEffect, useCallback, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  InstancedMesh,
  InstancedBufferAttribute,
  PlaneGeometry,
  ShaderMaterial,
  Quaternion,
  Vector3,
  DoubleSide,
  Object3D,
} from "three";
import { instancedStampVertex, instancedStampFragment } from "./instanced-stamp-shaders";
import { StampTextureAtlas } from "./StampTextureAtlas";
import { latLngToVec3 } from "./geo";
import type { LiveCard } from "./types";
import type { StampHoverData } from "./PostcardFlightLayer";

const MAX_INSTANCES = 512;
const STAMP_W = 0.12;
const STAMP_H = STAMP_W * 0.67;
const HOVER_SCALE = 2.4;
const SCALE_LERP = 0.12;
const PERSIST_DURATION = 30;
const FADE_DURATION = 3;

// Module-level scratch objects (reused every frame, no GC pressure)
const _quat = new Quaternion();
const _prevQuat = new Quaternion();
const _pos = new Vector3();
const _scale = new Vector3();
const _dummy = new Object3D();

const FADE_IN_SPEED = 0.04;
const QUAT_EPSILON = 0.0001;

interface InstanceSlot {
  card: LiveCard;
  index: number;
  layerIndex: number;
  landedAt?: number;
  targetScale: number;
  currentScale: number;
  currentOpacity: number; // fades 0→1 as texture loads
  position: [number, number, number]; // cached lat/lng → xyz
}

interface InstancedStampsProps {
  persistentCards: LiveCard[];
  landedCards: Array<LiveCard & { landedAt: number }>;
  radius: number;
  onHover?: (data: StampHoverData | null) => void;
  onSelect?: (data: StampHoverData | null) => void;
  onLandedExpired?: (id: string) => void;
}

export const InstancedStamps = memo(function InstancedStamps({
  persistentCards,
  landedCards,
  radius,
  onHover,
  onSelect,
  onLandedExpired,
}: InstancedStampsProps) {
  const meshRef = useRef<InstancedMesh>(null!);
  const camera = useThree((s) => s.camera);

  // Refs for mutable data (avoid re-renders)
  const atlasRef = useRef<StampTextureAtlas | null>(null);
  const slotsRef = useRef<Map<string, InstanceSlot>>(new Map());
  const indexToSlot = useRef<InstanceSlot[]>([]);
  const activeCount = useRef(0);
  const parentInvQuat = useRef(new Quaternion());
  const hoveredId = useRef<string | null>(null);

  // Instanced attributes
  const layerAttr = useRef<InstancedBufferAttribute | null>(null);
  const opacityAttr = useRef<InstancedBufferAttribute | null>(null);

  // Initialize atlas once
  if (!atlasRef.current) {
    atlasRef.current = new StampTextureAtlas();
  }
  const atlas = atlasRef.current;

  // Build the material once
  const materialRef = useRef<ShaderMaterial | null>(null);
  if (!materialRef.current) {
    materialRef.current = new ShaderMaterial({
      vertexShader: instancedStampVertex,
      fragmentShader: instancedStampFragment,
      uniforms: {
        uTextureArray: { value: atlas.texture },
        uCameraPosition: { value: new Vector3() },
      },
      transparent: true,
      depthWrite: true,
      side: DoubleSide,
    });
  }

  // Cleanup GPU resources and cursor style on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") document.body.style.cursor = "";
      atlasRef.current?.dispose();
      atlasRef.current = null;
      materialRef.current?.dispose();
      materialRef.current = null;
    };
  }, []);

  // Sync cards → instance slots incrementally (only add/remove changed cards)
  useEffect(() => {
    const mesh = meshRef.current;
    const slots = slotsRef.current;
    const allCards = [
      ...persistentCards.map((c) => ({ card: c, landedAt: undefined as number | undefined })),
      ...landedCards.map((c) => ({ card: c, landedAt: c.landedAt })),
    ];
    const currentIds = new Set(allCards.map((c) => c.card.id));

    let needsReindex = false;

    // Remove slots for cards that no longer exist
    for (const [id, slot] of slots) {
      if (!currentIds.has(id)) {
        atlas.releaseLayer(slot.layerIndex);
        slots.delete(id);
        needsReindex = true;
      }
    }

    // Add slots for new cards (append at end, only init new ones)
    // Guard: never exceed MAX_INSTANCES to avoid buffer overflow
    const newSlots: InstanceSlot[] = [];
    for (const { card, landedAt } of allCards) {
      if (!slots.has(card.id)) {
        if (slots.size >= MAX_INSTANCES) break;
        const layerIndex = atlas.allocateLayer(card.frontImageUrl);
        if (layerIndex < 0) continue; // atlas at capacity
        const slot: InstanceSlot = {
          card,
          index: -1,
          layerIndex,
          landedAt,
          targetScale: 1,
          currentScale: 1,
          currentOpacity: 0,
          position: latLngToVec3(card.latitude, card.longitude, radius * 1.01),
        };
        slots.set(card.id, slot);
        newSlots.push(slot);
        needsReindex = true;
      }
    }

    if (!needsReindex) return;

    // Only re-index when slots were added or removed
    let idx = 0;
    for (const slot of slots.values()) {
      slot.index = idx;
      idx++;
    }
    activeCount.current = idx;

    // Only initialize matrices for newly added slots
    if (mesh && newSlots.length > 0) {
      for (const slot of newSlots) {
        _dummy.position.set(slot.position[0], slot.position[1], slot.position[2]);
        _dummy.scale.set(STAMP_W, STAMP_H, 1);
        _dummy.updateMatrix();
        mesh.setMatrixAt(slot.index, _dummy.matrix);
      }
    }

    // Build reverse lookup for O(1) raycasting
    const lookup: InstanceSlot[] = Array.from({ length: idx });
    for (const slot of slots.values()) {
      lookup[slot.index] = slot;
    }
    indexToSlot.current = lookup;

    if (mesh) {
      mesh.count = idx;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.boundingSphere) {
        mesh.boundingSphere.center.set(0, 0, 0);
        mesh.boundingSphere.radius = radius * 1.5;
      }
    }
  }, [persistentCards, landedCards, atlas, radius]);

  // Per-frame update: billboard matrices, opacity, scale, expiry
  // Track whether any instance data actually changed to skip needless GPU uploads
  const onLandedExpiredRef = useRef(onLandedExpired);
  onLandedExpiredRef.current = onLandedExpired;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const slots = slotsRef.current;
    if (slots.size === 0) return;

    const clock = state.clock.elapsedTime;

    // Get parent world quaternion (one call for all instances)
    const parent = mesh.parent;
    if (parent) {
      parent.getWorldQuaternion(parentInvQuat.current).invert();
    }

    // Billboard quaternion: camera quat in local space
    _quat.copy(camera.quaternion).premultiply(parentInvQuat.current);

    // Check if billboard orientation actually changed (avoids GPU upload when paused/idle)
    const quatChanged = Math.abs(_quat.x - _prevQuat.x) > QUAT_EPSILON
      || Math.abs(_quat.y - _prevQuat.y) > QUAT_EPSILON
      || Math.abs(_quat.z - _prevQuat.z) > QUAT_EPSILON
      || Math.abs(_quat.w - _prevQuat.w) > QUAT_EPSILON;
    _prevQuat.copy(_quat);

    // Guard against null after unmount cleanup
    const mat = materialRef.current;
    if (!mat) return;

    // Update camera position uniform
    mat.uniforms.uCameraPosition.value.copy(camera.position);

    const layerData = layerAttr.current;
    const opacityData = opacityAttr.current;

    const expiredIds: string[] = [];
    let attrDirty = false;
    let anyMatrixDirty = false;

    for (const slot of slots.values()) {
      const i = slot.index;

      // Lerp scale for hover — per-slot matrix dirty
      const scaleDelta = (slot.targetScale - slot.currentScale) * SCALE_LERP;
      let slotScaleChanged = false;
      if (Math.abs(scaleDelta) > 0.001) {
        slot.currentScale += scaleDelta;
        slotScaleChanged = true;
      }

      // Fade in when texture is loaded
      const loaded = atlas.isLoaded(slot.layerIndex);
      const targetOpacity = loaded ? 1 : 0;
      const opacityDelta = (targetOpacity - slot.currentOpacity) * FADE_IN_SPEED;
      if (Math.abs(opacityDelta) > 0.001) {
        slot.currentOpacity += opacityDelta;
        attrDirty = true;
      }

      // Landed card expiry fade
      let opacity = slot.currentOpacity;
      if (slot.landedAt != null) {
        const age = clock - slot.landedAt;
        if (age > PERSIST_DURATION + FADE_DURATION) {
          expiredIds.push(slot.card.id);
          slot.landedAt = undefined; // prevent re-firing every frame
          opacity = 0;
          attrDirty = true;
        } else if (age > PERSIST_DURATION) {
          opacity *= 1.0 - (age - PERSIST_DURATION) / FADE_DURATION;
          attrDirty = true;
        }
      }

      // Write per-instance attributes
      if (layerData) layerData.setX(i, slot.layerIndex);
      if (opacityData) opacityData.setX(i, opacity);

      // Only recompute matrix when billboard orientation changed OR this slot's scale changed
      if (quatChanged || slotScaleChanged) {
        _pos.set(slot.position[0], slot.position[1], slot.position[2]);
        const s = STAMP_W * slot.currentScale;
        _scale.set(s, STAMP_H * slot.currentScale, 1);
        _dummy.position.copy(_pos);
        _dummy.quaternion.copy(_quat);
        _dummy.scale.copy(_scale);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
        anyMatrixDirty = true;
      }
    }

    mesh.count = activeCount.current;
    if (anyMatrixDirty) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (attrDirty) {
      if (layerData) layerData.needsUpdate = true;
      if (opacityData) opacityData.needsUpdate = true;
    }

    // Batch expiry callbacks — fire after the loop so React can batch the state updates
    if (expiredIds.length > 0) {
      const cb = onLandedExpiredRef.current;
      if (cb) {
        for (const id of expiredIds) {
          cb(id);
        }
      }
    }
  });

  // O(1) lookup by instance index
  const getSlotByIndex = useCallback((instanceId: number): InstanceSlot | undefined => {
    return indexToSlot.current[instanceId];
  }, []);

  const makeHoverData = useCallback((slot: InstanceSlot, worldPos?: Vector3): StampHoverData => ({
    frontImageUrl: slot.card.frontImageUrl,
    latitude: slot.card.latitude,
    longitude: slot.card.longitude,
    senderName: slot.card.senderName,
    message: slot.card.message,
    country: slot.card.country,
    worldPosition: worldPos ? [worldPos.x, worldPos.y, worldPos.z] : undefined,
  }), []);

  // Create instanced buffer attributes
  const layerArray = useRef(new Float32Array(MAX_INSTANCES));
  const opacityArray = useRef(new Float32Array(MAX_INSTANCES).fill(1));

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_INSTANCES]}
      frustumCulled={false}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (e.instanceId == null) return;
        const slot = getSlotByIndex(e.instanceId);
        if (!slot) return;
        hoveredId.current = slot.card.id;
        slot.targetScale = HOVER_SCALE;
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        onHover?.(makeHoverData(slot));
      }}
      onPointerOut={(_e) => {
        if (hoveredId.current) {
          const slot = slotsRef.current.get(hoveredId.current);
          if (slot) slot.targetScale = 1;
          hoveredId.current = null;
        }
        if (typeof document !== "undefined") document.body.style.cursor = "";
        onHover?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId == null) return;
        const slot = getSlotByIndex(e.instanceId);
        if (!slot) return;
        onSelect?.(makeHoverData(slot, e.point ?? undefined));
      }}
    >
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute
          ref={(attr) => { layerAttr.current = attr; }}
          attach="attributes-aTextureLayer"
          args={[layerArray.current, 1]}
        />
        <instancedBufferAttribute
          ref={(attr) => { opacityAttr.current = attr; }}
          attach="attributes-aOpacityMul"
          args={[opacityArray.current, 1]}
        />
      </planeGeometry>
      <primitive object={materialRef.current} attach="material" />
    </instancedMesh>
  );
});
