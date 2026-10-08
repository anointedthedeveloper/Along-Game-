import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Coins, Lock, UserMinus, UserPlus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { VehicleImage } from '@/components/VehicleImage';
import { Badge, Button, EmptyState, ErrorState, cn } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { fleetApi } from '@/services';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import type { Vehicle } from '@/types';

export default function Fleet() {
  const progress = useGame((s) => s.progress);
  const [data, setData] = useState<{ canHire: boolean; hiringFee: number; vehicles: Vehicle[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fleetApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your fleet');
    }
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok: (r: any) => string) {
    setBusy(key);
    try {
      const r = await fn();
      toast.success(ok(r));
      await Promise.all([load(), useGame.getState().refresh()]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const pending = data?.vehicles.reduce((a, v) => a + (v.projection?.net ?? 0), 0) ?? 0;
  const hired = data?.vehicles.filter((v) => v.hiredDriver).length ?? 0;

  return (
    <AppShell
      title="Fleet business"
      subtitle="Hire drivers to work your spare vehicles while you are away."
      actions={<Button disabled={!hired} loading={busy === 'collect'} onClick={() => run('collect', () => fleetApi.collect(), (r) => `Collected ${naira(r.total)} from your drivers`)}><Coins className="h-4 w-4" /> Collect {naira(pending)}</Button>}
    >
      {error && <ErrorState message={error} onRetry={load} />}
      {data && !data.canHire && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-taxi/40 bg-taxi/10 p-4">
          <Lock className="h-6 w-6 text-taxi" />
          <div>
            <p className="font-display text-xl font-bold uppercase">Unlocks at Level 4 — Professional Driver</p>
            <p className="text-sm text-asphalt-300">You are Level {progress?.level ?? 1}. Earn XP and keep your rating above 4.4 to get there. Until then you can still own spare vehicles.</p>
          </div>
        </div>
      )}
      {data && data.vehicles.length <= 1 && (
        <EmptyState icon={<Briefcase className="h-8 w-8" />} title="Your fleet is just one car" hint="Buy another vehicle in the garage showroom, then hire a driver for it." action={<Link to="/garage"><Button size="sm">Open showroom</Button></Link>} />
      )}
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {data?.vehicles.map((v) => (
          <li key={v.id} className="overflow-hidden rounded-2xl border border-white/10 bg-asphalt-800">
            <div className="flex gap-3 p-3">
              <VehicleImage cls={v.cls} className="h-24 w-32 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-bold uppercase">{v.name}</p>
                <p className="font-mono text-xs text-asphalt-300">{v.plate}</p>
                <p className="text-xs text-asphalt-300">{Math.round(v.condition)}% condition</p>
                {v.active && <Badge tone="green">You drive this</Badge>}
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              {v.hiredDriver ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div><p className="font-semibold">{v.hiredDriver.name}</p><p className="text-xs text-asphalt-300">Skill {Math.round(v.hiredDriver.skill * 100)}% · keeps {v.hiredDriver.wagePercent}% of profit</p></div>
                    <Button size="sm" variant="ghost" loading={busy === `d${v.id}`} onClick={() => run(`d${v.id}`, () => fleetApi.dismiss(v.id), () => 'Driver dismissed and paid out')}><UserMinus className="h-4 w-4" /> Dismiss</Button>
                  </div>
                  {v.projection && (
                    <dl className={cn('grid grid-cols-4 gap-1.5 text-center text-xs', v.projection.blocked && 'opacity-50')}>
                      <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Trips</dt><dd className="font-bold">{v.projection.trips}</dd></div>
                      <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Takings</dt><dd className="font-bold">{naira(v.projection.gross)}</dd></div>
                      <div className="rounded bg-white/5 py-1"><dt className="text-asphalt-300">Fuel+wage</dt><dd className="font-bold">{naira(v.projection.fuelCost + v.projection.wage)}</dd></div>
                      <div className="rounded bg-abuja/15 py-1"><dt className="text-asphalt-300">You get</dt><dd className="font-bold text-abuja">{naira(v.projection.net)}</dd></div>
                    </dl>
                  )}
                  {v.projection?.blocked && <p className="text-xs text-[#ff8b80]">{v.projection.blocked}</p>}
                </div>
              ) : (
                <Button size="sm" variant="dark" className="w-full" disabled={!data.canHire || v.active} loading={busy === `h${v.id}`} onClick={() => run(`h${v.id}`, () => fleetApi.hire(v.id), () => 'Driver hired')}>
                  <UserPlus className="h-4 w-4" /> {v.active ? 'You are driving this one' : `Hire a driver · ${naira(data.hiringFee)}`}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
