import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/images/taxis-painted.jpg" alt="Painted taxis at a roundabout in Abuja" className="absolute inset-0 h-full w-full object-cover" style={{ animation: 'ken-burns 40s ease-in-out infinite alternate' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-asphalt-950 via-asphalt-950/30 to-asphalt-950/40" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/"><Logo className="text-cream" size={30} /></Link>
          <div>
            <p className="font-display text-5xl font-extrabold uppercase leading-[0.95] text-cream drop-shadow">Every road<br />has a story.</p>
            <p className="mt-3 max-w-md text-cream/80">Drive the green-and-white cabs of the capital, or ride them. Fuel is scarce, the rain is coming, and the checkpoint is ahead.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md anim-slide-up">
          <Link to="/" className="mb-8 block lg:hidden"><Logo size={26} /></Link>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">{title}</h1>
          {subtitle && <p className="mt-1 text-asphalt-300">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-asphalt-300">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
