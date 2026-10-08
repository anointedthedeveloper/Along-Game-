import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon, Truck, User, Wallet, Wrench } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/components/ui';
import { naira } from '@/lib/format';
import { useGame } from '@/store/game';
import { useAuth } from '@/store/auth';
import { useEffect } from 'react';

/** Chrome for the secondary screens (garage, wallet, profile, fleet). The city map has its own HUD. */
export function AppShell({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  const user = useAuth((s) => s.user);
  const me = useGame((s) => s.me);
  const driver = (me?.mode ?? user?.mode) === 'DRIVER';
  useEffect(() => {
    void useGame.getState().refresh();
    void useGame.getState().loadMap();
  }, []);
  const nav = [
    { to: '/play', icon: MapIcon, label: 'City' },
    ...(driver ? [{ to: '/garage', icon: Wrench, label: 'Garage' }, { to: '/fleet', icon: Truck, label: 'Fleet' }] : []),
    { to: '/wallet', icon: Wallet, label: 'Wallet' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];
  return (
    <div className="min-h-full bg-asphalt-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-asphalt-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link to="/play" aria-label="Back to the city" className="rounded-lg bg-white/5 p-2 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
          <Logo size={20} className="hidden sm:inline-flex" />
          <nav className="ml-auto flex items-center gap-1" aria-label="Sections">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold', isActive ? 'bg-taxi text-asphalt-950' : 'text-asphalt-300 hover:bg-white/10 hover:text-cream')}>
                <n.icon className="h-4 w-4" /><span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <span className="hidden font-display text-lg font-bold tabular md:block">{naira(me?.cash ?? user?.cash)}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{title}</h1>
            {subtitle && <p className="mt-1 text-asphalt-300">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
