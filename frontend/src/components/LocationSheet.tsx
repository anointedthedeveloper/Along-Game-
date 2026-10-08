import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Navigation, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button } from '@/components/ui';
import { FuelPanel, GaragePanel } from '@/components/driver/Services';
import { km, LOCATION_LABEL } from '@/lib/format';
import { worldApi } from '@/services';
import { travelTo } from '@/store/actions';
import { useGame } from '@/store/game';
import { usePlan } from '@/store/plan';
import { useUI } from '@/store/ui';
import { POI_COLOR } from '@/game/poi';

interface RouteInfo { distanceKm: number; durationMin: number; roads: string[] }

export function LocationSheet() {
  const key = useUI((s) => s.selectedKey);
  const select = useUI((s) => s.select);
  const map = useGame((s) => s.map);
  const me = useGame((s) => s.me);
  const vehicle = useGame((s) => s.vehicle);
  const ride = useGame((s) => s.ride);
  const [info, setInfo] = useState<RouteInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const loc = map?.locations.find((l) => l.key === key) ?? null;
  const here = me?.locationKey === key && !me?.travel;
  const driver = me?.mode === 'DRIVER';
  const progress = useGame((s) => s.progress);
  const district = map?.districts.find((d) => d.id === loc?.district);
  const locked = driver && !!district && !!progress && district.unlockLevel > progress.level;

  useEffect(() => {
    setInfo(null);
    if (!loc || !me || here || !driver) return;
    let dead = false;
    worldApi.route(me.locationKey, loc.key, vehicle?.specId ?? 'sedan_taxi').then((r) => !dead && setInfo(r.route)).catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [loc, me?.locationKey, here, driver, vehicle?.specId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loc || !me) return null;
  const busyRide = !!ride || !!me.travel;
  const fuelNeeded = info && vehicle ? (info.distanceKm * vehicle.stats.fuelPer100km) / 100 : 0;
  const tooFar = vehicle ? fuelNeeded > vehicle.fuel : false;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[650] flex justify-center p-3 pb-4">
      <div className="anim-slide-up pointer-events-auto max-h-[70vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-asphalt-900/97 p-4 shadow-2xl backdrop-blur scroll-thin">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: POI_COLOR[loc.type] }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{LOCATION_LABEL[loc.type]}</Badge>
              <span className="text-xs uppercase tracking-wider text-asphalt-300">{map?.districts.find((d) => d.id === loc.district)?.name}</span>
            </div>
            <p className="font-display text-3xl font-extrabold uppercase leading-none">{loc.name}</p>
            <p className="mt-1 text-sm text-asphalt-300">{loc.description}</p>
            {locked && <p className="mt-1 text-xs font-semibold text-taxi">Ride requests from {district?.name} unlock at driver level {district?.unlockLevel}.</p>}
          </div>
          <button aria-label="Close" onClick={() => select(null)} className="rounded-full bg-white/10 p-1.5"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-3 space-y-2">
          {driver && here && loc.type === 'PETROL_STATION' && vehicle && <FuelPanel vehicle={vehicle} />}
          {driver && here && loc.type === 'GARAGE' && vehicle && (
            <>
              <GaragePanel vehicle={vehicle} />
              <Link to="/garage"><Button variant="dark" className="w-full">Upgrades &amp; vehicle showroom</Button></Link>
            </>
          )}
          {driver && here && loc.type !== 'PETROL_STATION' && loc.type !== 'GARAGE' && <p className="rounded-lg bg-white/5 p-3 text-sm text-asphalt-300">You are parked here.</p>}
          {driver && !here && (
            <div className="space-y-2">
              {info && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-asphalt-300">
                  <span>{km(info.distanceKm)}</span><span>about {info.durationMin} min</span><span>{fuelNeeded.toFixed(1)} L of fuel</span>{info.roads[0] && <span>via {info.roads[0]}</span>}
                </div>
              )}
              {tooFar && <p className="text-sm text-[#ff8b80]">You do not have enough fuel to get there.</p>}
              <Button className="w-full" size="lg" disabled={busyRide || tooFar} loading={busy} onClick={async () => {
                setBusy(true);
                const r = await travelTo(loc.key);
                setBusy(false);
                if (r) select(null);
              }}>
                <Navigation className="h-5 w-5" /> {busyRide ? 'Finish your current trip first' : 'Drive here'}
              </Button>
            </div>
          )}
          {!driver && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="green" disabled={!!ride} onClick={() => { usePlan.getState().set('from', loc.key); select(null); }}>
                <ArrowUpFromLine className="h-4 w-4" /> Pick-up here
              </Button>
              <Button disabled={!!ride} onClick={() => { usePlan.getState().set('to', loc.key); select(null); }}>
                <ArrowDownToLine className="h-4 w-4" /> Go here
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
