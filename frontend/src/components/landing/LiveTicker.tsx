import { useEffect, useState } from 'react';
import { CloudRain, Cloud, Moon, Sun } from 'lucide-react';
import { worldApi } from '@/services';
import type { World } from '@/types';

const fmt = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.floor(m % 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Real numbers from the live game server — the clock the city is running on right now. */
export function LiveTicker() {
  const [w, setW] = useState<{ world: World; at: number } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let dead = false;
    const load = () => worldApi.world().then((r) => !dead && setW({ world: r.world, at: Date.now() })).catch(() => undefined);
    void load();
    const a = setInterval(load, 20000);
    const b = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      dead = true;
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  if (!w) return null;
  const minute = (w.world.clock.minuteOfDay + ((Date.now() - w.at) / 1000) * w.world.clock.speed) % 1440;
  const night = minute < 5.6 * 60 || minute > 19.4 * 60;
  const k = w.world.weather.kind;
  const Icon = k.includes('RAIN') ? CloudRain : k === 'CLOUDY' ? Cloud : night ? Moon : Sun;
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-sm backdrop-blur" aria-live="off">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-abuja opacity-75" style={{ animation: 'pulse-ring 1.6s infinite' }} /><span className="relative inline-flex h-2 w-2 rounded-full bg-abuja" /></span>
      <span className="font-semibold uppercase tracking-wider text-abuja">Live</span>
      <span className="font-display text-lg font-bold tabular">{fmt(minute)}</span>
      <span className="flex items-center gap-1 text-cream/80"><Icon className="h-4 w-4" />{w.world.weather.label}</span>
      <span className="hidden text-cream/70 sm:inline">Petrol ₦{w.world.fuelPrice}/L</span>
    </div>
  );
}
