import { useEffect, useRef } from 'react';
import { getSprite, SPRITE_SIZE } from '@/game/sprites';

interface Car { cls: string; color: string; x: number; lane: number; speed: number; scale: number }

const FLEET: Array<Pick<Car, 'cls' | 'color'>> = [
  { cls: 'SEDAN_TAXI', color: '#f4f4f0' }, { cls: 'KEKE', color: '#f2b705' }, { cls: 'MINIBUS', color: '#f2b705' },
  { cls: 'COROLLA', color: '#b9bcc2' }, { cls: 'BUS', color: '#f4f4f0' }, { cls: 'SEDAN_TAXI', color: '#f4f4f0' },
  { cls: 'CAMRY', color: '#14181f' }, { cls: 'MOTORCYCLE', color: '#7a1d1d' }, { cls: 'KEKE', color: '#f2b705' },
];

/** A decorative top-down road using the very same procedural sprites as the game. Day fades to night on a loop. */
export function RoadStrip({ height = 150 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    const resize = () => {
      w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    const lanes = [height * 0.3, height * 0.5, height * 0.7];
    const cars: Car[] = FLEET.map((f, i) => ({ ...f, x: (i / FLEET.length) * 1400, lane: i % 3, speed: (i % 3 === 1 ? 90 : i % 3 === 0 ? 55 : 120) + (i * 13) % 30, scale: 1.25 }));
    let raf = 0;
    let last = performance.now();
    let dash = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (now: number) => {
      const dt = reduce ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      dash = (dash + dt * 70) % 70;
      const night = 0.5 - 0.5 * Math.cos((now / 1000 / 42) * Math.PI * 2); // 0 → 1 → 0 over 42 s
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      // asphalt
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, '#4a4d50');
      g.addColorStop(1, '#2f3234');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, height);
      ctx.fillStyle = '#c9c5b6';
      ctx.fillRect(0, 0, w, 5);
      ctx.fillRect(0, height - 5, w, 5);
      // lane markings
      ctx.strokeStyle = 'rgba(245,242,230,0.75)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([34, 36]);
      ctx.lineDashOffset = -dash;
      for (const y of [height * 0.4, height * 0.6]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const c of cars) {
        c.x += c.speed * dt;
        const [L] = SPRITE_SIZE[c.cls] ?? [58];
        if (c.x > w + L * 2) c.x = -L * 3;
        const spr = getSprite(c.cls, c.color);
        const sw = spr.width / 3;
        const sh = spr.height / 3;
        const y = lanes[c.lane];
        ctx.save();
        ctx.translate(c.x, y);
        ctx.scale(c.scale, c.scale);
        // headlight beam at night
        if (night > 0.25) {
          const beam = ctx.createLinearGradient(L / 2, 0, L / 2 + 120, 0);
          beam.addColorStop(0, `rgba(255,244,200,${0.5 * night})`);
          beam.addColorStop(1, 'rgba(255,244,200,0)');
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(L / 2, -5);
          ctx.lineTo(L / 2 + 120, -26);
          ctx.lineTo(L / 2 + 120, 26);
          ctx.lineTo(L / 2, 5);
          ctx.fill();
        }
        ctx.drawImage(spr, -sw / 2, -sh / 2, sw, sh);
        ctx.restore();
      }
      // night tint
      ctx.fillStyle = `rgba(6,10,30,${0.6 * night})`;
      ctx.fillRect(0, 0, w, height);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [height]);
  return <canvas ref={ref} aria-hidden style={{ width: '100%', height }} className="block" />;
}
