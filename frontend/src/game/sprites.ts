import type { VehicleClass } from '@/types';

/**
 * Top-down vehicle sprites painted procedurally (body shading, glass, wheels,
 * lights, mirrors). Each faces +x and is cached per class and colour.
 */

export interface SpriteSpec { cls: VehicleClass | 'PRIVATE'; color: string }

const cache = new Map<string, HTMLCanvasElement>();

// logical size (px at scale 1) per class: [length, width]
export const SPRITE_SIZE: Record<string, [number, number]> = {
  MOTORCYCLE: [34, 14], KEKE: [42, 25], SEDAN_TAXI: [58, 27], COROLLA: [58, 27], CAMRY: [62, 28],
  PRIVATE_CAR: [60, 28], PRIVATE: [58, 27], MINIBUS: [72, 31], BUS: [108, 34],
};

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const S = 3; // oversampling

export function getSprite(cls: string, color: string): HTMLCanvasElement {
  const key = `${cls}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [L, W] = SPRITE_SIZE[cls] ?? SPRITE_SIZE.SEDAN_TAXI;
  const pad = 6;
  const c = document.createElement('canvas');
  c.width = (L + pad * 2) * S;
  c.height = (W + pad * 2) * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);
  ctx.translate(pad, pad);
  if (cls === 'MOTORCYCLE') motorcycle(ctx, L, W, color);
  else if (cls === 'KEKE') keke(ctx, L, W, color);
  else if (cls === 'BUS') bus(ctx, L, W, color, 3);
  else if (cls === 'MINIBUS') bus(ctx, L, W, color, 1);
  else car(ctx, L, W, color, cls);
  cache.set(key, c);
  return c;
}

function shadow(ctx: CanvasRenderingContext2D, L: number, W: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, 1.5, 2.2, L - 1, W, W * 0.28);
  ctx.fill();
}

function wheels(ctx: CanvasRenderingContext2D, W: number, xs: number[]) {
  ctx.fillStyle = '#16171a';
  for (const x of xs) {
    rr(ctx, x - 4.2, -1.1, 8.4, 3.4, 1.4);
    ctx.fill();
    rr(ctx, x - 4.2, W - 2.3, 8.4, 3.4, 1.4);
    ctx.fill();
  }
}

function lights(ctx: CanvasRenderingContext2D, L: number, W: number) {
  // headlights (front = +x) and tail lights
  ctx.fillStyle = '#fff6c9';
  rr(ctx, L - 3.4, 2.1, 3, 4.4, 1.2);
  ctx.fill();
  rr(ctx, L - 3.4, W - 6.5, 3, 4.4, 1.2);
  ctx.fill();
  ctx.fillStyle = '#c4161c';
  rr(ctx, 0.3, 2.1, 2.3, 4, 0.9);
  ctx.fill();
  rr(ctx, 0.3, W - 6.1, 2.3, 4, 0.9);
  ctx.fill();
}

function car(ctx: CanvasRenderingContext2D, L: number, W: number, color: string, cls: string) {
  shadow(ctx, L, W);
  wheels(ctx, W, [L * 0.22, L * 0.76]);
  // body with tapered nose and tail
  const body = ctx.createLinearGradient(0, 0, 0, W);
  body.addColorStop(0, shade(color, 0.16));
  body.addColorStop(0.5, color);
  body.addColorStop(1, shade(color, -0.2));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(L * 0.06, W * 0.12);
  ctx.quadraticCurveTo(0, W * 0.12, 0, W * 0.3);
  ctx.lineTo(0, W * 0.7);
  ctx.quadraticCurveTo(0, W * 0.88, L * 0.06, W * 0.88);
  ctx.lineTo(L * 0.8, W * 0.9);
  ctx.quadraticCurveTo(L, W * 0.86, L, W * 0.62);
  ctx.lineTo(L, W * 0.38);
  ctx.quadraticCurveTo(L, W * 0.14, L * 0.8, W * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // hood / trunk panel lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(L * 0.7, W * 0.14);
  ctx.lineTo(L * 0.7, W * 0.86);
  ctx.moveTo(L * 0.14, W * 0.16);
  ctx.lineTo(L * 0.14, W * 0.84);
  ctx.stroke();
  // glasshouse
  const glass = ctx.createLinearGradient(0, 0, L, 0);
  glass.addColorStop(0, '#1d2a35');
  glass.addColorStop(1, '#3b5163');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(L * 0.2, W * 0.2);
  ctx.lineTo(L * 0.64, W * 0.18);
  ctx.lineTo(L * 0.7, W * 0.3);
  ctx.lineTo(L * 0.7, W * 0.7);
  ctx.lineTo(L * 0.64, W * 0.82);
  ctx.lineTo(L * 0.2, W * 0.8);
  ctx.quadraticCurveTo(L * 0.16, W * 0.5, L * 0.2, W * 0.2);
  ctx.closePath();
  ctx.fill();
  // roof
  const roof = ctx.createLinearGradient(0, W * 0.2, 0, W * 0.8);
  roof.addColorStop(0, shade(color, 0.22));
  roof.addColorStop(1, shade(color, -0.1));
  ctx.fillStyle = roof;
  rr(ctx, L * 0.31, W * 0.2, L * 0.28, W * 0.6, W * 0.1);
  ctx.fill();
  // taxi markings: green stripes + roof sign
  if (cls === 'SEDAN_TAXI' || cls === 'COROLLA') {
    ctx.fillStyle = '#1f9d55';
    ctx.fillRect(L * 0.22, W * 0.1, L * 0.5, 1.1);
    ctx.fillRect(L * 0.22, W * 0.9 - 1.1, L * 0.5, 1.1);
    if (cls === 'SEDAN_TAXI') {
      ctx.fillStyle = '#f2b705';
      rr(ctx, L * 0.42, W * 0.4, L * 0.07, W * 0.2, 0.8);
      ctx.fill();
    }
  }
  if (cls === 'CAMRY' || cls === 'PRIVATE_CAR') {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(ctx, L * 0.33, W * 0.24, L * 0.24, W * 0.08, 2);
    ctx.fill();
  }
  // mirrors
  ctx.fillStyle = shade(color, -0.25);
  rr(ctx, L * 0.62, -0.6, 3, 2, 0.8);
  ctx.fill();
  rr(ctx, L * 0.62, W - 1.4, 3, 2, 0.8);
  ctx.fill();
  lights(ctx, L, W);
}

function bus(ctx: CanvasRenderingContext2D, L: number, W: number, color: string, stripes: number) {
  shadow(ctx, L, W);
  const axles = stripes === 3 ? [L * 0.2, L * 0.78] : [L * 0.2, L * 0.78];
  wheels(ctx, W, axles);
  const body = ctx.createLinearGradient(0, 0, 0, W);
  body.addColorStop(0, shade(color, 0.12));
  body.addColorStop(1, shade(color, -0.2));
  ctx.fillStyle = body;
  rr(ctx, 0, W * 0.06, L, W * 0.88, W * 0.16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // roof with ribs
  ctx.fillStyle = shade(color, 0.2);
  rr(ctx, L * 0.04, W * 0.14, L * 0.82, W * 0.72, W * 0.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  const n = stripes === 3 ? 9 : 5;
  for (let i = 1; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(L * 0.04 + (L * 0.82 * i) / n, W * 0.16);
    ctx.lineTo(L * 0.04 + (L * 0.82 * i) / n, W * 0.84);
    ctx.stroke();
  }
  // windshield
  ctx.fillStyle = '#26323d';
  ctx.beginPath();
  ctx.moveTo(L * 0.87, W * 0.2);
  ctx.lineTo(L * 0.97, W * 0.28);
  ctx.lineTo(L * 0.97, W * 0.72);
  ctx.lineTo(L * 0.87, W * 0.8);
  ctx.closePath();
  ctx.fill();
  // stripe along both sides (Abuja green / lagos yellow)
  ctx.fillStyle = color === '#f2b705' || color === '#1f6f43' ? '#111' : '#1f9d55';
  ctx.fillRect(L * 0.04, W * 0.07, L * 0.8, 1.2);
  ctx.fillRect(L * 0.04, W * 0.93 - 1.2, L * 0.8, 1.2);
  ctx.fillStyle = '#fff6c9';
  rr(ctx, L - 2.6, W * 0.14, 2.2, 4, 1);
  ctx.fill();
  rr(ctx, L - 2.6, W * 0.86 - 4, 2.2, 4, 1);
  ctx.fill();
  ctx.fillStyle = '#c4161c';
  rr(ctx, 0.2, W * 0.14, 2, 4, 0.8);
  ctx.fill();
  rr(ctx, 0.2, W * 0.86 - 4, 2, 4, 0.8);
  ctx.fill();
}

function keke(ctx: CanvasRenderingContext2D, L: number, W: number, color: string) {
  shadow(ctx, L, W);
  ctx.fillStyle = '#16171a';
  rr(ctx, L * 0.86, W / 2 - 1.8, 7.4, 3.6, 1.2); // front wheel
  ctx.fill();
  rr(ctx, L * 0.12, -1, 8, 3.4, 1.3);
  ctx.fill();
  rr(ctx, L * 0.12, W - 2.4, 8, 3.4, 1.3);
  ctx.fill();
  // lower body (yellow) tapering to the front
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, W * 0.1);
  ctx.lineTo(L * 0.72, W * 0.1);
  ctx.quadraticCurveTo(L * 0.98, W * 0.28, L * 0.98, W / 2);
  ctx.quadraticCurveTo(L * 0.98, W * 0.72, L * 0.72, W * 0.9);
  ctx.lineTo(0, W * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // tan canopy
  const can = ctx.createLinearGradient(0, 0, 0, W);
  can.addColorStop(0, '#c9ab86');
  can.addColorStop(1, '#977c5a');
  ctx.fillStyle = can;
  rr(ctx, L * 0.02, W * 0.12, L * 0.7, W * 0.76, W * 0.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(L * 0.37, W * 0.14);
  ctx.lineTo(L * 0.37, W * 0.86);
  ctx.stroke();
  // windshield
  ctx.fillStyle = '#2b3944';
  ctx.beginPath();
  ctx.moveTo(L * 0.74, W * 0.24);
  ctx.lineTo(L * 0.86, W * 0.36);
  ctx.lineTo(L * 0.86, W * 0.64);
  ctx.lineTo(L * 0.74, W * 0.76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  ctx.arc(L * 0.97, W / 2, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4161c';
  rr(ctx, 0.1, W * 0.18, 1.8, 3, 0.7);
  ctx.fill();
  rr(ctx, 0.1, W * 0.82 - 3, 1.8, 3, 0.7);
  ctx.fill();
}

function motorcycle(ctx: CanvasRenderingContext2D, L: number, W: number, color: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  rr(ctx, 2, W * 0.3, L - 2, W * 0.7, 4);
  ctx.fill();
  ctx.fillStyle = '#16171a';
  rr(ctx, L * 0.05, W / 2 - 1.2, 9, 2.4, 1.1);
  ctx.fill();
  rr(ctx, L * 0.78, W / 2 - 1.2, 9, 2.4, 1.1);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, L * 0.2, W * 0.32, L * 0.55, W * 0.36, 3);
  ctx.fill();
  // handlebar
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(L * 0.7, W * 0.12);
  ctx.lineTo(L * 0.7, W * 0.88);
  ctx.stroke();
  // rider
  ctx.fillStyle = '#2f4f7a';
  rr(ctx, L * 0.32, W * 0.18, L * 0.3, W * 0.64, 4);
  ctx.fill();
  ctx.fillStyle = '#d6b08a';
  ctx.beginPath();
  ctx.arc(L * 0.44, W / 2, W * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4161c';
  ctx.beginPath();
  ctx.arc(L * 0.44, W / 2, W * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  ctx.arc(L * 0.97, W / 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

export const AMBIENT_COLORS = ['#b9bcc2', '#2b3340', '#e8e6df', '#7c1d1d', '#1e3a5f', '#c9c6bd', '#3d4a3a', '#8a5a3a'];
