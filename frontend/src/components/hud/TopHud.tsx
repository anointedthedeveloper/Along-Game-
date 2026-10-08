import { Cloud, CloudRain, CloudRainWind, Menu, Moon, Star, Sun, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Meter, cn } from '@/components/ui';
import { useClock } from '@/hooks/useClock';
import { naira } from '@/lib/format';
import { daylightAt, useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import type { WeatherKind } from '@/types';

function WeatherIcon({ kind, night }: { kind: WeatherKind; night: boolean }) {
  const c = 'h-5 w-5';
  if (kind === 'HEAVY_RAIN') return <CloudRainWind className={cn(c, 'text-sky')} />;
  if (kind === 'RAIN') return <CloudRain className={cn(c, 'text-sky')} />;
  if (kind === 'CLOUDY') return <Cloud className={cn(c, 'text-asphalt-300')} />;
  return night ? <Moon className={cn(c, 'text-[#c9d6ff]')} /> : <Sun className={cn(c, 'text-taxi')} />;
}

const TRAFFIC = (t: number) => (t > 0.7 ? { l: 'Gridlock', c: 'text-[#ff8b80]' } : t > 0.45 ? { l: 'Heavy', c: 'text-taxi' } : t > 0.25 ? { l: 'Moderate', c: 'text-cream' } : { l: 'Light', c: 'text-abuja' });

export function TopHud() {
  const me = useGame((s) => s.me);
  const vehicle = useGame((s) => s.vehicle);
  const progress = useGame((s) => s.progress);
  const world = useGame((s) => s.world);
  const setMenu = useUI((s) => s.setMenu);
  const clock = useClock();
  const night = daylightAt(clock.minute) < 0.4;
  const driver = me?.mode === 'DRIVER';
  const traffic = TRAFFIC(world?.traffic ?? 0.3);
  const phase = clock.minute < 5 * 60 || clock.minute >= 20 * 60 ? 'Night' : clock.minute < 12 * 60 ? 'Morning' : clock.minute < 17 * 60 ? 'Afternoon' : 'Evening';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex flex-col gap-2 p-2.5 sm:p-3">
      <div className="flex items-stretch gap-2">
        <button aria-label="Menu" onClick={() => setMenu(true)} className="pointer-events-auto flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-asphalt-900/90 px-3 backdrop-blur hover:bg-asphalt-800">
          <Menu className="h-5 w-5" />
        </button>

        <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-x-5 overflow-x-auto rounded-xl border border-white/10 bg-asphalt-900/90 px-4 py-2 backdrop-blur scroll-thin">
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">{driver ? 'Cash' : 'Cash · Bank'}</p>
            <p className="font-display text-2xl font-extrabold leading-none text-cream tabular">{naira(me?.cash)}</p>
            {!driver && <p className="text-[11px] text-asphalt-300 tabular">Bank {naira(me?.bank)}</p>}
          </div>
          {driver && vehicle && (
            <>
              <div className="hidden w-px self-stretch bg-white/10 sm:block" />
              <div className="w-24 shrink-0 sm:w-32">
                <Meter label="Fuel" value={vehicle.fuelPercent} right={`${vehicle.fuelPercent}%`} />
              </div>
              <div className="w-24 shrink-0 sm:w-32">
                <Meter label="Vehicle" value={vehicle.condition} right={`${Math.round(vehicle.condition)}%`} />
              </div>
              <div className="shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">Rating</p>
                <p className="flex items-center gap-1 font-display text-2xl font-extrabold leading-none text-taxi tabular">
                  <Star className="h-4 w-4 fill-current" />
                  {(progress?.rating ?? 4.5).toFixed(1)}
                </p>
              </div>
            </>
          )}
          {progress && (
            <Link to="/profile" className="hidden shrink-0 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">Lv {progress.level} · {progress.title}</p>
              <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-abuja" style={{ width: `${progress.xpForNext ? Math.min(100, (progress.xpIntoLevel / progress.xpForNext) * 100) : 100}%` }} />
              </div>
            </Link>
          )}
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-asphalt-900/90 px-3.5 py-2 backdrop-blur">
          <WeatherIcon kind={world?.weather.kind ?? 'SUNNY'} night={night} />
          <div className="text-right leading-tight">
            <p className="font-display text-2xl font-extrabold tabular">{clock.label}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-asphalt-300">{phase} · {world?.weather.label ?? 'Sunny'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
        <span className={cn('pointer-events-auto rounded-full border border-white/10 bg-asphalt-900/85 px-2.5 py-1 backdrop-blur', traffic.c)}>Traffic: {traffic.l}</span>
        {world && world.demand > 1.2 && (
          <span className="pointer-events-auto flex items-center gap-1 rounded-full border border-taxi/40 bg-asphalt-900/85 px-2.5 py-1 text-taxi backdrop-blur">
            <TrendingUp className="h-3 w-3" /> High demand
          </span>
        )}
        {world && world.fuelShortage && (
          <span className="pointer-events-auto rounded-full border border-brake/50 bg-asphalt-900/85 px-2.5 py-1 text-[#ff8b80] backdrop-blur">Fuel scarcity · ₦{world.fuelPrice}/L</span>
        )}
        {driver && progress?.day.active && (
          <span className="pointer-events-auto flex items-center gap-1 rounded-full border border-abuja/50 bg-asphalt-900/85 px-2.5 py-1 text-abuja backdrop-blur">
            <Wallet className="h-3 w-3" /> Day {progress.day.number} · {naira(progress.day.earnings)} · {progress.day.rides} rides
          </span>
        )}
      </div>
    </div>
  );
}
