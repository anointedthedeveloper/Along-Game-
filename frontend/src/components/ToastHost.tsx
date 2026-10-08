import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { useToasts } from '@/store/toast';
import { cn } from './ui';

const ICON = { info: Info, success: CheckCircle2, error: XCircle, warn: TriangleAlert };
const TONE = { info: 'border-sky/60', success: 'border-abuja/70', error: 'border-brake/70', warn: 'border-taxi/70' };

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[1200] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <button key={t.id} onClick={() => dismiss(t.id)} className={cn('anim-pop pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border bg-asphalt-800/95 px-4 py-3 text-left text-sm shadow-xl backdrop-blur', TONE[t.kind])}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.text}</span>
          </button>
        );
      })}
    </div>
  );
}
