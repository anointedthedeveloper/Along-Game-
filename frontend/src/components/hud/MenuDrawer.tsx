import { useState } from 'react';
import { Car, LogOut, Map as MapIcon, Truck, User as UserIcon, Wallet, Wrench, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { userApi } from '@/services';
import { useAuth } from '@/store/auth';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import { useUI } from '@/store/ui';

export function MenuDrawer() {
  const open = useUI((s) => s.menuOpen);
  const setMenu = useUI((s) => s.setMenu);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const progress = useGame((s) => s.progress);
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!open || !user) return null;
  const driver = user.mode === 'DRIVER';

  async function switchMode() {
    setBusy(true);
    try {
      const { user: u } = await userApi.update({ mode: driver ? 'PASSENGER' : 'DRIVER' });
      useAuth.getState().setUser(u);
      useGame.getState().reset();
      await useGame.getState().refresh();
      toast.success(`You are now a ${u.mode.toLowerCase()}.`);
      setMenu(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not switch mode');
    } finally {
      setBusy(false);
    }
  }

  const items = [
    { to: '/play', icon: MapIcon, label: 'City map' },
    ...(driver ? [{ to: '/garage', icon: Wrench, label: 'Garage & vehicles' }] : []),
    { to: '/wallet', icon: Wallet, label: 'Wallet & transactions' },
    ...(driver ? [{ to: '/fleet', icon: Truck, label: 'Fleet business' }] : []),
    { to: '/profile', icon: UserIcon, label: 'Profile & progress' },
  ];

  return (
    <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
      <aside className="anim-slide-up absolute left-0 top-0 flex h-full w-[min(86vw,22rem)] flex-col gap-1 border-r border-white/10 bg-asphalt-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <Logo size={22} />
          <button aria-label="Close menu" onClick={() => setMenu(false)} className="rounded-full bg-white/10 p-1.5"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="font-display text-xl font-bold uppercase">{user.name}</p>
          <p className="text-xs text-asphalt-300">{progress ? `Level ${progress.level} · ${progress.title}` : 'Welcome'}</p>
        </div>
        {items.map((i) => (
          <Link key={i.to} to={i.to} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold hover:bg-white/10">
            <i.icon className="h-5 w-5 text-taxi" /> {i.label}
          </Link>
        ))}
        <div className="mt-auto space-y-2">
          <Button variant="dark" className="w-full" onClick={switchMode} loading={busy}>
            <Car className="h-4 w-4" /> Switch to {driver ? 'Passenger' : 'Driver'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={async () => { await logout(); nav('/'); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
    </div>
  );
}
