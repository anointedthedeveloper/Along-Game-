import { useEffect, useRef } from 'react';

/** Drifting dust motes and the occasional shaft of warm light over the hero photograph. */
export function Atmosphere() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);
    const motes = Array.from({ length: 46 }, () => ({ x: Math.random() * 1600, y: Math.random() * 900, r: 0.6 + Math.random() * 1.8, v: 8 + Math.random() * 22, d: Math.random() * 6 }));
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.v * dt;
        m.y += Math.sin(t * 0.6 + m.d) * 6 * dt;
        if (m.x > w + 10) {
          m.x = -10;
          m.y = Math.random() * h;
        }
        ctx.fillStyle = `rgba(255,236,190,${0.18 + 0.14 * Math.sin(t + m.d)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
