import * as THREE from "three";
import stampUrl from "./assets/spatie-stamp.png";

const CARD_W = 600;
const CARD_H = 400;
const HALF = CARD_W / 2;
const PAD = 20;
const LINE_COLOR = "#9b9489";
const TEXT_COLOR = "#3a3630";
const FADED_COLOR = "#9b9489";
const BG_COLOR = "#f5f0e8";

// Spatie's details
const SPATIE_LINES = ["Spatie", "Kruikstraat 22, Box 12", "2018 Antwerp", "Belgium"];

let stampImage: HTMLImageElement | null = null;
const stampLoaded = new Promise<HTMLImageElement>((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    stampImage = img;
    resolve(img);
  };
  img.onerror = () => resolve(img); // proceed without stamp if it fails
  img.src = stampUrl;
});

function drawAddressLines(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1;
  const lineSpacing = 32;
  for (let i = 0; i < 4; i++) {
    const ly = y + i * lineSpacing;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + width, ly);
    ctx.stroke();
  }
}

export function createBackTexture(opts?: {
  senderName?: string;
  message?: string;
  country?: string;
}): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  // Paper background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle paper grain
  for (let i = 0; i < 2000; i++) {
    const gx = Math.random() * CARD_W;
    const gy = Math.random() * CARD_H;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
    ctx.fillRect(gx, gy, 1, 1);
  }

  // Center divider line
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(HALF, PAD + 10);
  ctx.lineTo(HALF, CARD_H - PAD);
  ctx.stroke();

  // === LEFT SIDE: Sender's data ===
  const leftX = PAD;
  const leftW = HALF - PAD * 2;

  // Message area
  if (opts?.message) {
    ctx.font = '15px "DM Sans", sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = "left";

    // Word-wrap the message
    const words = opts.message.split(" ");
    let line = "";
    let ly = PAD + 30;
    const maxWidth = leftW;
    for (const word of words) {
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, leftX, ly);
        line = word;
        ly += 22;
        if (ly > CARD_H - 80) break; // don't overflow
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, leftX, ly);
  }

  // Sender name at bottom left
  if (opts?.senderName) {
    ctx.font = 'italic 14px "DM Sans", sans-serif';
    ctx.fillStyle = FADED_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(`— ${opts.senderName}`, leftX, CARD_H - PAD - 10);
  }

  // Country label
  if (opts?.country) {
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.fillStyle = FADED_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(opts.country, leftX, CARD_H - PAD - 30);
  }

  // === RIGHT SIDE: Spatie details + stamp ===
  const rightX = HALF + PAD;
  const rightW = HALF - PAD * 2;

  // Stamp in top-right corner
  if (stampImage && stampImage.complete && stampImage.naturalWidth > 0) {
    const stampSize = 100;
    const sx = CARD_W - PAD - stampSize;
    const sy = PAD;
    ctx.drawImage(stampImage, sx, sy, stampSize, stampSize);
  }

  // Address lines on right side
  drawAddressLines(ctx, rightX, CARD_H - PAD - 130, rightW);

  // Spatie details on the address lines
  ctx.font = '15px "DM Sans", sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = "left";
  const startY = CARD_H - PAD - 127;
  for (let i = 0; i < SPATIE_LINES.length; i++) {
    ctx.fillText(SPATIE_LINES[i], rightX + 2, startY + i * 32);
  }

  // "POSTCARDWARE" label at top of right side
  ctx.font = 'bold 10px "DM Sans", sans-serif';
  ctx.fillStyle = FADED_COLOR;
  ctx.textAlign = "left";
  ctx.letterSpacing = "3px";
  ctx.fillText("POSTCARDWARE", rightX, PAD + 20);
  ctx.letterSpacing = "0px";

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Pre-warm the stamp image load
stampLoaded.catch(() => {});
