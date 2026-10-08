import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Fuel, Lock, MapPin, Navigation } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { FuelPanel, GaragePanel } from '@/components/driver/Services';
import { VehicleImage } from '@/components/VehicleImage';
import { Badge, Button, ErrorState, Meter, cn } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { haversine } from '@/lib/geo';
import { naira } from '@/lib/format';
import { vehicleApi } from '@/services';
import { travelTo } from '@/store/actions';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import type { Vehicle, VehicleSpec } from '@/types';

type Catalog = Awaited<ReturnType<typeof vehicleApi.catalog>>;

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/5 px-2.5 py-1.5"><p className="text-[10px] font-semibold uppercase tracking-wider text-asphalt-300">{label}</p><p className="font-display text-lg font-bold">{value}</p></div>;
}

export default function Garage() {
  const nav = useNavigate();
  const { me, map, vehicle } = useGame();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<'CASH' | 'BANK'>('CASH');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, c] = await Promise.all([vehicleApi.list(), vehicleApi.catalog()]);
      setVehicles(v.vehicles);
      setCatalog(c);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your garage');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, vehicle?.condition, vehicle?.fuel, vehicle?.upgrades.engine, vehicle?.upgrades.interior, vehicle?.upgrades.tyres]);

  const loc = me?.location;
  const atGarage = loc?.type === 'GARAGE' && !me?.travel;
  const atPetrol = loc?.type === 'PETROL_STATION' && !me?.travel;
  const nearest = useMemo(() => {
    if (!map || !loc) return null;
    return map.locations.filter((l) => l.type === 'GARAGE').sort((a, b) => haversine(loc.pos, a.pos) - haversine(loc.pos, b.pos))[0] ?? null;
  }, [map, loc]);

  const active = vehicles.find((v) => v.active) ?? vehicle;

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await Promise.all([load(), useGame.getState().refresh()]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Garage" subtitle="Maintain, upgrade and grow your fleet.">
      {error && <ErrorState message={error} onRetry={load} />}

      <div className={cn('mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4', atGarage ? 'border-abuja/50 bg-abuja/10' : 'border-taxi/40 bg-taxi/10')}>
        <div className="flex items-center gap-3">
          <MapPin className={cn('h-5 w-5', atGarage ? 'text-abuja' : 'text-taxi')} />
          <p className="text-sm">
            {atGarage ? <>You are at <b>{loc?.name}</b> — repairs, upgrades and purchases are open.</> : me?.travel ? 'You are on the road.' : <>You are at <b>{loc?.name ?? '…'}</b>. Repairs, upgrades and vehicle purchases need a garage.</>}
          </p>
        </div>
        {!atGarage && nearest && !me?.travel && (
          <Button size="sm" onClick={async () => { const r = await travelTo(nearest.key); if (r) { toast.info(`Driving to ${nearest.name}`); nav('/play'); } }}>
            <Navigation className="h-4 w-4" /> Drive to {nearest.name}
          </Button>
        )}
      </div>

      {active && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-asphalt-800">
            <VehicleImage cls={active.cls} className="h-56 w-full" />
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-3xl font-extrabold uppercase leading-none">{active.name}</h2>
                  <p className="mt-1 font-mono text-xs tracking-widest text-asphalt-300">{active.plate} · {active.odometerKm.toLocaleString()} km</p>
                </div>
                <Badge tone="green">Active</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Meter label="Condition" value={active.condition} right={`${Math.round(active.condition)}%`} />
                <Meter label="Fuel" value={active.fuelPercent} right={`${active.fuel} / ${active.stats.tankLiters} L`} />
                <Meter label="Cleanliness" value={active.cleanliness} right={`${active.cleanliness}%`} />
                <Meter label="Range" value={Math.min(active.range, 600)} max={600} color="#2f7fd1" right={`${active.range} km`} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="Top speed" value={`${Math.round(active.stats.speedKph)} km/h`} />
                <Stat label="Fuel use" value={`${active.stats.fuelPer100km.toFixed(1)} L/100km`} />
                <Stat label="Seats" value={String(active.stats.capacity)} />
                <Stat label="Comfort" value={`${active.stats.comfort}/10`} />
                <Stat label="Reliability" value={`${active.stats.reliability.toFixed(1)}/10`} />
                <Stat label="Upkeep" value={`₦${active.stats.maintenancePerKm}/km`} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {atGarage && <GaragePanel vehicle={active} />}
            {atPetrol && <FuelPanel vehicle={active} />}
            {!atGarage && !atPetrol && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-asphalt-300">
                <p className="flex items-center gap-2 font-display text-lg font-bold uppercase text-cream"><Fuel className="h-5 w-5 text-taxi" /> Servicing</p>
                <p className="mt-1">Fuel is sold at petrol stations; repairs, washes and upgrades at garages. Select one on the city map and drive there.</p>
              </div>
            )}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 font-display text-lg font-bold uppercase">Upgrades</p>
              <ul className="space-y-2">
                {(['engine', 'tyres', 'interior'] as const).map((k) => {
                  const lvl = active.upgrades[k];
                  const info = catalog?.upgrades[k];
                  const max = info?.maxLevel ?? 3;
                  return (
                    <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2.5">
                      <div>
                        <p className="font-semibold">{info?.label ?? k}</p>
                        <p className="text-xs text-asphalt-300">{info?.description}</p>
                        <div className="mt-1 flex gap-1">{Array.from({ length: max }).map((_, i) => <span key={i} className={cn('h-1.5 w-6 rounded-full', i < lvl ? 'bg-abuja' : 'bg-white/15')} />)}</div>
                      </div>
                      <Button size="sm" variant="dark" disabled={!atGarage || lvl >= max} loading={busy === k} onClick={() => act(k, () => vehicleApi.upgrade(active.id, k), `${info?.label} upgraded`)}>
                        {lvl >= max ? <Check className="h-4 w-4" /> : 'Upgrade'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {vehicles.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-2xl font-bold uppercase">Your vehicles</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {vehicles.map((v) => (
              <li key={v.id} className={cn('flex gap-3 rounded-xl border p-3', v.active ? 'border-abuja/60 bg-abuja/10' : 'border-white/10 bg-white/5')}>
                <VehicleImage cls={v.cls} className="h-20 w-28 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-bold uppercase">{v.name}</p>
                  <p className="font-mono text-xs text-asphalt-300">{v.plate}</p>
                  <p className="text-xs text-asphalt-300">{Math.round(v.condition)}% condition · {v.fuelPercent}% fuel</p>
                  {v.hiredDriver && <p className="text-xs text-taxi">Driven by {v.hiredDriver.name}</p>}
                </div>
                {v.active ? <Badge tone="green">Active</Badge> : !v.hiredDriver && <Button size="sm" variant="dark" loading={busy === v.id} onClick={() => act(v.id, () => vehicleApi.activate(v.id), `Now driving ${v.name}`)}>Drive</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">Showroom</h2>
            <p className="text-sm text-asphalt-300">You own {catalog?.owned ?? '…'} of {catalog?.maxVehicles ?? '…'} vehicles your level allows.</p>
          </div>
          <div className="flex gap-1.5">
            {(['CASH', 'BANK'] as const).map((m) => (
              <button key={m} onClick={() => setPay(m)} className={cn('rounded-full px-3 py-1 text-xs font-semibold', pay === m ? 'bg-taxi text-asphalt-950' : 'bg-white/10')}>Pay {m.toLowerCase()} · {naira(m === 'CASH' ? me?.cash : me?.bank)}</button>
            ))}
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog?.items.map((s) => <ShowroomCard key={s.id} spec={s} atGarage={atGarage} pay={pay} full={(catalog.owned >= catalog.maxVehicles)} busy={busy === s.id} onBuy={() => act(s.id, () => vehicleApi.buy(s.id, pay), `${s.name} is yours!`)} />)}
        </ul>
      </section>
    </AppShell>
  );
}

function ShowroomCard({ spec, atGarage, pay, full, busy, onBuy }: { spec: VehicleSpec; atGarage: boolean; pay: 'CASH' | 'BANK'; full: boolean; busy: boolean; onBuy: () => void }) {
  const me = useGame((s) => s.me);
  const funds = pay === 'CASH' ? me?.cash ?? 0 : me?.bank ?? 0;
  const reason = spec.locked ? `Level ${spec.minLevel} required` : full ? 'Fleet limit reached' : !atGarage ? 'Visit a garage to buy' : funds < spec.price ? 'Not enough funds' : '';
  return (
    <li className={cn('flex flex-col overflow-hidden rounded-2xl border bg-asphalt-800', spec.locked ? 'border-white/5 opacity-80' : 'border-white/10')}>
      <div className="relative">
        <VehicleImage cls={spec.cls} className={cn('h-36 w-full', spec.locked && 'grayscale')} />
        {spec.locked && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold"><Lock className="h-3 w-3" /> Lv {spec.minLevel}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="font-display text-xl font-bold uppercase leading-tight">{spec.name}</p>
          <p className="text-xs text-asphalt-300">{spec.tagline}</p>
        </div>
        <dl className="grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Seats</dt><dd className="font-bold">{spec.capacity}</dd></div>
          <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Speed</dt><dd className="font-bold">{spec.speedKph}</dd></div>
          <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">L/100km</dt><dd className="font-bold">{spec.fuelPer100km}</dd></div>
          <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Comfort</dt><dd className="font-bold">{spec.comfort}/10</dd></div>
          <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Reliab.</dt><dd className="font-bold">{spec.reliability}/10</dd></div>
          <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Demand</dt><dd className="font-bold">{Math.round(spec.demand * 100)}%</dd></div>
        </dl>
        {spec.restrictedDistricts.length > 0 && <p className="text-[11px] text-[#ffb59c]">Banned in {spec.restrictedDistricts.join(', ')}</p>}
        {spec.onlyDistricts && <p className="text-[11px] text-[#ffb59c]">Only allowed in {spec.onlyDistricts.join(', ')}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="font-display text-2xl font-extrabold text-taxi tabular">{naira(spec.price)}</p>
          <Button size="sm" disabled={!!reason} loading={busy} onClick={onBuy}>{reason || 'Buy'}</Button>
        </div>
      </div>
    </li>
  );
}
