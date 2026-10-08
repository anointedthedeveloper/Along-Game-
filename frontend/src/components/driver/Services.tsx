import { useMemo, useState } from 'react';
import { Droplets, Fuel, Hammer, Sparkles } from 'lucide-react';
import { Button, Meter } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { vehicleApi } from '@/services';
import { applyVehicle } from '@/store/actions';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import type { Vehicle } from '@/types';

const run = async (fn: () => Promise<{ vehicle: Vehicle }>, okMsg: (r: any) => string, setBusy: (b: boolean) => void) => {
  setBusy(true);
  try {
    const r = await fn();
    applyVehicle(r.vehicle);
    toast.success(okMsg(r));
    void useGame.getState().refresh();
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
  } finally {
    setBusy(false);
  }
};

export function FuelPanel({ vehicle }: { vehicle: Vehicle }) {
  const price = useGame((s) => s.world?.fuelPrice ?? 900);
  const cash = useGame((s) => s.me?.cash ?? 0);
  const [target, setTarget] = useState(100);
  const [busy, setBusy] = useState(false);
  const min = Math.min(100, vehicle.fuelPercent + 1);
  const t = Math.max(target, min);
  const liters = Math.max(0, (vehicle.stats.tankLiters * t) / 100 - vehicle.fuel);
  const cost = Math.ceil(liters * price);
  const full = vehicle.fuelPercent >= 99;
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-lg font-bold uppercase"><Fuel className="h-5 w-5 text-taxi" /> Fuel pump</p>
        <p className="text-sm text-asphalt-300">₦{price}/litre</p>
      </div>
      <Meter label={`Tank ${vehicle.fuel.toFixed(1)} / ${vehicle.stats.tankLiters} L`} value={vehicle.fuelPercent} right={`${vehicle.fuelPercent}%`} />
      {!full && (
        <>
          <input aria-label="Fill to percent" type="range" min={min} max={100} value={t} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-[#f2b705]" />
          <div className="flex items-center justify-between text-sm">
            <span>Fill to <b>{t}%</b> · {liters.toFixed(1)} L</span>
            <span className="font-display text-2xl font-extrabold text-taxi tabular">{naira(cost)}</span>
          </div>
          <Button className="w-full" disabled={cost > cash} loading={busy} onClick={() => run(() => vehicleApi.refuel(vehicle.id, t), (r) => `Bought ${r.liters.toFixed(1)} L for ${naira(r.cost)}`, setBusy)}>
            <Fuel className="h-4 w-4" /> {cost > cash ? 'Not enough cash' : 'Buy fuel'}
          </Button>
        </>
      )}
      {full && <p className="text-sm text-abuja">Tank is full.</p>}
    </div>
  );
}

export function GaragePanel({ vehicle }: { vehicle: Vehicle }) {
  const cash = useGame((s) => s.me?.cash ?? 0);
  const [busy, setBusy] = useState('');
  const points = Math.ceil(100 - vehicle.condition);
  const repairCost = useMemo(() => points * vehicle.repairCostPerPoint, [points, vehicle.repairCostPerPoint]);
  const wrap = (k: string) => (b: boolean) => setBusy(b ? k : '');
  return (
    <div className="space-y-2">
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="flex items-center gap-2 font-display text-lg font-bold uppercase"><Hammer className="h-5 w-5 text-taxi" /> Mechanic</p>
        <Meter label="Vehicle condition" value={vehicle.condition} right={`${Math.round(vehicle.condition)}%`} />
        <Button className="w-full" disabled={points <= 0 || repairCost > cash} loading={busy === 'repair'} onClick={() => run(() => vehicleApi.repair(vehicle.id, 100), (r) => `Repaired for ${naira(r.cost)}`, wrap('repair'))}>
          {points <= 0 ? 'No repairs needed' : repairCost > cash ? `Need ${naira(repairCost)}` : `Repair to 100% · ${naira(repairCost)}`}
        </Button>
      </div>
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="flex items-center gap-2 font-display text-lg font-bold uppercase"><Sparkles className="h-5 w-5 text-taxi" /> Car wash</p>
        <Meter label="Cleanliness" value={vehicle.cleanliness} right={`${vehicle.cleanliness}%`} />
        <Button variant="dark" className="w-full" disabled={vehicle.cleanliness >= 95 || cash < 1500} loading={busy === 'wash'} onClick={() => run(() => vehicleApi.wash(vehicle.id), (r) => `Sparkling clean for ${naira(r.cost)}`, wrap('wash'))}>
          <Droplets className="h-4 w-4" /> {vehicle.cleanliness >= 95 ? 'Already spotless' : 'Wash & detail · ₦1,500'}
        </Button>
      </div>
    </div>
  );
}
