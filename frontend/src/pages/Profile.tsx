import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Check, Lock, MapPinned, Star } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, EmptyState, Input, Meter, cn } from '@/components/ui';
import { ApiError, tokenStore } from '@/lib/api';
import { km, naira, timeAgo } from '@/lib/format';
import { rideApi, userApi, worldApi } from '@/services';
import { useAuth } from '@/store/auth';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import type { AppNotification, Ride } from '@/types';

export default function Profile() {
  const user = useAuth((s) => s.user)!;
  const nav = useNavigate();
  const progress = useGame((s) => s.progress);
  const map = useGame((s) => s.map);
  const [rides, setRides] = useState<Ride[]>([]);
  const [ratings, setRatings] = useState<Array<{ id: string; stars: number; comment?: string; createdAt: string }>>([]);
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [leaders, setLeaders] = useState<Array<{ rank: number; name: string; level: number; rating: number; rides: number; totalEarnings: number }>>([]);
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    rideApi.list(8).then((r) => setRides(r.rides)).catch(() => undefined);
    userApi.ratings().then((r) => setRatings(r.ratings)).catch(() => undefined);
    userApi.notifications().then((r) => setNotes(r.notifications)).catch(() => undefined);
    worldApi.leaderboard().then((r) => setLeaders(r.leaders)).catch(() => undefined);
    void userApi.markRead();
  }, []);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy('name');
    try {
      const { user: u } = await userApi.update({ name });
      useAuth.getState().setUser(u);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update');
    } finally {
      setBusy(null);
    }
  }

  async function savePw(e: FormEvent) {
    e.preventDefault();
    setBusy('pw');
    try {
      const { token } = await userApi.changePassword(pw);
      tokenStore.set(token);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password');
    } finally {
      setBusy(null);
    }
  }

  const rep = progress?.reputation;
  const levels = map?.levels ?? [];

  return (
    <AppShell title={user.name} subtitle={`${user.mode === 'DRIVER' ? 'Driver' : 'Passenger'} · ${user.email}`}>
      {progress && (
        <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-asphalt-700 to-asphalt-800 p-5">
            <div className="flex items-center gap-3">
              <Award className="h-10 w-10 text-taxi" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-asphalt-300">Level {progress.level}</p>
                <p className="font-display text-4xl font-extrabold uppercase leading-none">{progress.title}</p>
              </div>
            </div>
            <div className="mt-4">
              <Meter label={progress.nextLevel ? `To ${progress.nextLevel.title}` : 'Maximum level'} value={progress.xpIntoLevel} max={progress.xpForNext || 1} color="#1f9d55" right={progress.nextLevel ? `${progress.xp} / ${progress.nextLevel.xp} XP` : `${progress.xp} XP`} />
              {progress.nextLevel && <p className="mt-1 text-xs text-asphalt-300">Also needs a {progress.nextLevel.minRating.toFixed(1)}★ average rating (you have {progress.rating.toFixed(2)}★).</p>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-4">
              <div><dt className="text-asphalt-300">Rides driven</dt><dd className="font-display text-2xl font-bold">{progress.ridesAsDriver}</dd></div>
              <div><dt className="text-asphalt-300">Rides taken</dt><dd className="font-display text-2xl font-bold">{progress.ridesAsPassenger}</dd></div>
              <div><dt className="text-asphalt-300">Distance</dt><dd className="font-display text-2xl font-bold">{km(progress.totalDistanceKm)}</dd></div>
              <div><dt className="text-asphalt-300">Lifetime earnings</dt><dd className="font-display text-2xl font-bold text-taxi">{naira(progress.totalEarnings)}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-display text-xl font-bold uppercase">Reputation</p>
            <p className="mt-1 flex items-center gap-2 font-display text-5xl font-extrabold text-taxi"><Star className="h-8 w-8 fill-current" />{progress.rating.toFixed(2)}<span className="text-lg text-asphalt-300">/ 5.0</span></p>
            {rep && (
              <div className="mt-3 space-y-2">
                <Meter label="Completion rate" value={rep.completionRate * 100} right={`${Math.round(rep.completionRate * 100)}%`} />
                <Meter label="On time" value={rep.punctuality * 100} right={`${Math.round(rep.punctuality * 100)}%`} />
                <Meter label="Reputation score" value={rep.score} color="#2f7fd1" right={`${rep.score}/100`} />
              </div>
            )}
            <p className="mt-2 text-xs text-asphalt-300">{progress.cancellations} cancellations · {progress.lateArrivals} late arrivals</p>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 font-display text-2xl font-bold uppercase">Career ladder</h2>
        <ol className="grid gap-2 md:grid-cols-5">
          {levels.map((l) => {
            const done = (progress?.level ?? 1) >= l.level;
            return (
              <li key={l.level} className={cn('rounded-xl border p-3', done ? 'border-abuja/50 bg-abuja/10' : 'border-white/10 bg-white/5')}>
                <div className="flex items-center justify-between"><Badge tone={done ? 'green' : 'neutral'}>Level {l.level}</Badge>{done ? <Check className="h-4 w-4 text-abuja" /> : <Lock className="h-4 w-4 text-asphalt-300" />}</div>
                <p className="mt-1 font-display text-lg font-bold uppercase leading-tight">{l.title}</p>
                <p className="mt-1 text-xs text-asphalt-300">{l.perk}</p>
                <p className="mt-1 text-[11px] text-asphalt-500">{l.xp} XP · {l.minRating ? `${l.minRating}★` : 'any rating'}</p>
              </li>
            );
          })}
        </ol>
        {progress && (
          <p className="mt-2 flex items-center gap-2 text-sm text-asphalt-300"><MapPinned className="h-4 w-4" /> Unlocked districts: {map?.districts.filter((d) => progress.unlockedDistricts.includes(d.id)).map((d) => d.name).join(', ')}</p>
        )}
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-display text-2xl font-bold uppercase">Recent rides</h2>
          {rides.length === 0 ? <EmptyState title="No rides yet" hint="Your trips will appear here." /> : (
            <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {rides.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.origin.name} → {r.destination.name}</p>
                    <p className="text-xs text-asphalt-300">{r.role === 'DRIVER' ? 'Drove' : 'Rode'} · {r.status.toLowerCase()} · {timeAgo(r.requestedAt)}{r.rating ? ` · ${r.rating}★` : ''}</p>
                  </div>
                  <span className="font-display text-lg font-bold tabular">{naira(r.fare.final)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-display text-2xl font-bold uppercase">What passengers said</h2>
          {ratings.length === 0 ? <EmptyState title="No reviews yet" hint="Complete rides as a driver to get rated." /> : (
            <ul className="space-y-2">
              {ratings.slice(0, 6).map((r) => (
                <li key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="flex items-center gap-1 text-taxi"><Star className="h-4 w-4 fill-current" />{r.stars}<span className="ml-2 text-xs text-asphalt-300">{timeAgo(r.createdAt)}</span></p>
                  {r.comment && <p className="text-sm italic">“{r.comment}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {progress && progress.dayHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-2xl font-bold uppercase">Work days</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-asphalt-300"><tr><th className="p-2">Day</th><th>Rides</th><th>Earned</th><th>Spent</th><th>Net</th></tr></thead>
              <tbody>{progress.dayHistory.slice().reverse().map((d) => (<tr key={d.day} className="border-t border-white/10 tabular"><td className="p-2">Day {d.day}</td><td>{d.rides}</td><td className="text-abuja">{naira(d.earnings)}</td><td className="text-[#ff8b80]">{naira(d.expenses)}</td><td className="font-semibold">{naira(d.earnings - d.expenses)}</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      {leaders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-2xl font-bold uppercase">Top drivers in the city</h2>
          <ol className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {leaders.map((l) => (<li key={l.rank} className="flex items-center gap-3 px-4 py-2"><span className="w-6 font-display text-xl font-bold text-taxi">{l.rank}</span><span className="flex-1 font-semibold">{l.name}</span><span className="text-xs text-asphalt-300">Lv {l.level} · {l.rating.toFixed(1)}★ · {l.rides} rides</span><span className="font-display text-lg font-bold tabular">{naira(l.totalEarnings)}</span></li>))}
          </ol>
        </section>
      )}

      {notes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-2xl font-bold uppercase">Notifications</h2>
          <ul className="space-y-1.5">{notes.slice(0, 8).map((n) => (<li key={n.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm"><b>{n.title}</b> <span className="text-asphalt-300">{n.body}</span> <span className="text-xs text-asphalt-500">· {timeAgo(n.createdAt)}</span></li>))}</ul>
        </section>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <form onSubmit={saveName} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-display text-xl font-bold uppercase">Account</p>
          <Input label="Display name" value={name} minLength={2} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="sm" loading={busy === 'name'} disabled={name === user.name}>Save</Button>
        </form>
        <form onSubmit={savePw} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-display text-xl font-bold uppercase">Password</p>
          <Input label="Current password" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          <Button type="submit" size="sm" variant="dark" loading={busy === 'pw'}>Change password</Button>
        </form>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={async () => { await useAuth.getState().logout(); nav('/'); }}>Sign out</Button>
      </div>
    </AppShell>
  );
}
