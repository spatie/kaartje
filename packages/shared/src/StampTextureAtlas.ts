import {
  DataArrayTexture,
  LinearFilter,
  ClampToEdgeWrapping,
  RGBAFormat,
  UnsignedByteType,
} from "three";

const LAYER_W = 128;
const LAYER_H = 86; // ~0.67 aspect ratio
const FALLBACK_COLOR = [0xc4, 0x5a, 0x3c, 0xff]; // stamp red

/**
 * Manages a DataArrayTexture where each layer is one stamp's front image.
 * Supports async loading, slot reuse, and per-layer updates.
 */
export class StampTextureAtlas {
  readonly texture: DataArrayTexture;
  /** Set of layer indices whose images have finished loading */
  readonly loadedLayers = new Set<number>();
  private data: Uint8Array;
  private capacity: number;
  private freeSlots: number[] = [];
  private usedCount = 0;
  private pendingImages: Array<{ img: HTMLImageElement; index: number; gen: number }> = [];
  private processingScheduled = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private slotGeneration = new Map<number, number>();
  private activeTimers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;

  private static readonly MAX_CAPACITY = 1024;

  constructor(initialCapacity = 256) {
    this.capacity = initialCapacity;
    this.data = new Uint8Array(LAYER_W * LAYER_H * 4 * initialCapacity);

    // Fill all layers with fallback color
    for (let layer = 0; layer < initialCapacity; layer++) {
      this.fillLayer(layer, FALLBACK_COLOR);
    }

    this.texture = new DataArrayTexture(this.data, LAYER_W, LAYER_H, initialCapacity);
    this.texture.format = RGBAFormat;
    this.texture.type = UnsignedByteType;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  /** Allocate a layer and start async image loading. Returns the layer index, or -1 if at capacity. */
  allocateLayer(url: string): number {
    let index: number;
    let recycled = false;
    if (this.freeSlots.length > 0) {
      index = this.freeSlots.pop()!;
      recycled = true;
    } else {
      index = this.usedCount;
      this.usedCount++;
      if (index >= this.capacity) {
        if (!this.grow()) {
          this.usedCount--;
          return -1;
        }
      }
    }

    // Recycled slots may have stale image data — fill with fallback
    if (recycled) {
      this.fillLayer(index, FALLBACK_COLOR);
    }

    // Increment generation so stale loads for this slot are ignored
    const gen = (this.slotGeneration.get(index) ?? 0) + 1;
    this.slotGeneration.set(index, gen);

    // Load image async with retry
    if (typeof document !== "undefined") {
      this.loadImage(url, index, 0, gen);
    }

    return index;
  }

  /** Load an image into a layer with retry on failure */
  private loadImage(url: string, index: number, attempt: number, gen: number): void {
    if (this.disposed) return;

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000 + attempt * 1500; // 1s, 2.5s, 4s

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.disposed || this.slotGeneration.get(index) !== gen) return;
      this.pendingImages.push({ img, index, gen });
      this.scheduleProcessing();
    };
    img.onerror = () => {
      if (this.disposed || this.slotGeneration.get(index) !== gen) return;
      if (attempt < MAX_RETRIES) {
        const timer = setTimeout(() => {
          this.activeTimers.delete(timer);
          this.loadImage(url, index, attempt + 1, gen);
        }, RETRY_DELAY);
        this.activeTimers.add(timer);
      }
    };
    // Stagger initial loads to avoid rate limiting
    const delay = attempt === 0 ? Math.min(index * 30, 3000) : 0;
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        if (!this.disposed) img.src = url;
      }, delay);
      this.activeTimers.add(timer);
    } else {
      img.src = url;
    }
  }

  /** Get or create a reusable canvas for pixel readback */
  private getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = LAYER_W;
      this.canvas.height = LAYER_H;
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!this.ctx) {
        console.warn("[StampTextureAtlas] Failed to acquire 2D canvas context");
      }
    }
    return { canvas: this.canvas, ctx: this.ctx };
  }

  /** Write decoded pixels from a bitmap/image into the atlas layer */
  private blitToLayer(source: ImageBitmap | HTMLImageElement, index: number): boolean {
    const { ctx } = this.getCanvas();
    if (!ctx) return false;
    ctx.clearRect(0, 0, LAYER_W, LAYER_H);
    ctx.drawImage(source, 0, 0, LAYER_W, LAYER_H);
    const pixels = ctx.getImageData(0, 0, LAYER_W, LAYER_H).data;
    const offset = index * LAYER_W * LAYER_H * 4;
    this.data.set(pixels, offset);
    this.loadedLayers.add(index);
    return true;
  }

  /** Process pending images one per frame to avoid jank */
  private scheduleProcessing(): void {
    if (this.processingScheduled || this.disposed) return;
    this.processingScheduled = true;

    const processNext = () => {
      if (this.disposed) {
        this.processingScheduled = false;
        return;
      }

      // Process only 1 image per frame to stay within frame budget
      const item = this.pendingImages.shift();
      if (!item) {
        this.processingScheduled = false;
        return;
      }

      const { img, index, gen } = item;

      // Skip if slot was freed/reallocated since this image was queued
      if (this.slotGeneration.get(index) !== gen) {
        if (this.pendingImages.length > 0) {
          requestAnimationFrame(processNext);
        } else {
          this.processingScheduled = false;
        }
        return;
      }

      const continueProcessing = () => {
        if (this.pendingImages.length > 0) {
          requestAnimationFrame(processNext);
        } else {
          this.processingScheduled = false;
        }
      };

      // Use createImageBitmap for off-thread decode + resize when available
      if (typeof createImageBitmap === "function") {
        createImageBitmap(img, { resizeWidth: LAYER_W, resizeHeight: LAYER_H })
          .then((bitmap) => {
            if (!this.disposed && this.slotGeneration.get(index) === gen) {
              if (this.blitToLayer(bitmap, index)) {
                this.texture.needsUpdate = true;
              }
            }
            bitmap.close();
          })
          .catch((err) => {
            console.warn("[StampTextureAtlas] Failed to decode image for layer", index, err);
          })
          .finally(continueProcessing);
      } else {
        // Fallback: draw directly on canvas (main thread)
        if (this.blitToLayer(img, index)) {
          this.texture.needsUpdate = true;
        }
        continueProcessing();
      }
    };

    requestAnimationFrame(processNext);
  }

  /** Check if a layer's image has finished loading */
  isLoaded(index: number): boolean {
    return this.loadedLayers.has(index);
  }

  /** Release a layer for reuse — skip fill/upload since the slot is hidden */
  releaseLayer(index: number): void {
    this.loadedLayers.delete(index);
    // Bump generation so any in-flight loads for this slot are ignored
    this.slotGeneration.set(index, (this.slotGeneration.get(index) ?? 0) + 1);
    this.freeSlots.push(index);
  }

  /** Fill a layer with a solid RGBA color */
  private fillLayer(index: number, color: number[]): void {
    const layerSize = LAYER_W * LAYER_H * 4;
    const offset = index * layerSize;
    // Build a single-row pattern then tile it across the layer
    const row = new Uint8Array(LAYER_W * 4);
    for (let i = 0; i < LAYER_W; i++) {
      row[i * 4] = color[0];
      row[i * 4 + 1] = color[1];
      row[i * 4 + 2] = color[2];
      row[i * 4 + 3] = color[3];
    }
    for (let y = 0; y < LAYER_H; y++) {
      this.data.set(row, offset + y * LAYER_W * 4);
    }
  }

  /** Double the capacity (up to MAX_CAPACITY). Returns false if already at max. */
  private grow(): boolean {
    const newCapacity = Math.min(this.capacity * 2, StampTextureAtlas.MAX_CAPACITY);
    if (newCapacity <= this.capacity) {
      console.warn("[StampTextureAtlas] Max capacity reached:", StampTextureAtlas.MAX_CAPACITY);
      return false;
    }
    const newData = new Uint8Array(LAYER_W * LAYER_H * 4 * newCapacity);
    newData.set(this.data);

    // Swap data so fillLayer writes to the new buffer
    this.data = newData;
    for (let i = this.capacity; i < newCapacity; i++) {
      this.fillLayer(i, FALLBACK_COLOR);
    }

    this.capacity = newCapacity;
    this.texture.image = { data: newData, width: LAYER_W, height: LAYER_H, depth: newCapacity };
    this.texture.needsUpdate = true;
    return true;
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.activeTimers) clearTimeout(t);
    this.activeTimers.clear();
    this.pendingImages.length = 0;
    this.texture.dispose();
    this.canvas = null;
    this.ctx = null;
  }
}
