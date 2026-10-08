import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef, useEffect } from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'green' | 'ghost' | 'danger' | 'dark';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-taxi text-asphalt-950 hover:bg-[#ffc81f] active:bg-taxi-dark shadow-[0_2px_0_#9a7300]',
  green: 'bg-abuja text-white hover:bg-[#23b061] active:bg-abuja-dark shadow-[0_2px_0_#0f5a2f]',
  ghost: 'bg-white/5 text-cream hover:bg-white/10 border border-white/10',
  danger: 'bg-brake text-white hover:bg-[#ea4a3d] shadow-[0_2px_0_#8f241b]',
  dark: 'bg-asphalt-700 text-cream hover:bg-asphalt-600 border border-white/10',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', loading, size = 'md', className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-display font-bold uppercase tracking-wide transition-colors select-none',
        'disabled:opacity-50 disabled:shadow-none',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-base',
        size === 'lg' && 'px-6 py-3.5 text-lg',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(function Input(
  { label, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-asphalt-300">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full rounded-lg border bg-asphalt-950/70 px-3.5 py-2.5 text-cream placeholder:text-asphalt-500 outline-none transition-colors',
          error ? 'border-brake' : 'border-white/10 focus:border-taxi',
          className,
        )}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-[#ff8b80]">{error}</span>}
    </label>
  );
});

export function Meter({ value, max = 100, color, label, right }: { value: number; max?: number; color?: string; label?: string; right?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const auto = pct < 20 ? '#d83a2e' : pct < 45 ? '#f2b705' : '#1f9d55';
  return (
    <div className="w-full">
      {(label || right) && (
        <div className="mb-1 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-asphalt-300">
          <span>{label}</span>
          <span className="text-cream tabular">{right}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color ?? auto }} />
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue' }) {
  const t = {
    neutral: 'bg-white/10 text-cream',
    gold: 'bg-taxi text-asphalt-950',
    green: 'bg-abuja/90 text-white',
    red: 'bg-brake text-white',
    blue: 'bg-sky/90 text-white',
  }[tone];
  return <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider', t)}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-asphalt-300">
      <Loader2 className="h-8 w-8 animate-spin text-taxi" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-brake/40 bg-brake/10 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-[#ff8b80]" />
      <p className="max-w-sm text-sm text-cream">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-6 text-center">
      {icon && <div className="text-asphalt-300">{icon}</div>}
      <p className="font-display text-lg font-bold uppercase tracking-wide">{title}</p>
      {hint && <p className="max-w-xs text-sm text-asphalt-300">{hint}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, children, wide, closable = true }: { open: boolean; onClose?: () => void; children: ReactNode; wide?: boolean; closable?: boolean }) {
  useEffect(() => {
    if (!open || !closable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closable]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && closable && onClose?.()}>
      <div role="dialog" aria-modal="true" className={cn('anim-pop relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-asphalt-800 shadow-2xl sm:rounded-2xl scroll-thin', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        {closable && onClose && (
          <button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-taxi tabular" style={{ fontSize: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 18l-6.4 3.6L7 14.5 1.7 9.5l7.2-.9z" />
      </svg>
      {value.toFixed(1)}
    </span>
  );
}
