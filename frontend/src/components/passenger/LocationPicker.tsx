import { useMemo, useState } from 'react';
import { Check, ChevronDown, Crosshair, Search } from 'lucide-react';
import { cn } from '@/components/ui';
import { LOCATION_LABEL } from '@/lib/format';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';

export function LocationPicker({ label, value, onChange, tone, target, exclude }: { label: string; value: string | null; onChange: (key: string) => void; tone: 'from' | 'to'; target: 'from' | 'to'; exclude?: string | null }) {
  const map = useGame((s) => s.map);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const pickTarget = useUI((s) => s.pickTarget);
  const setPickTarget = useUI((s) => s.setPickTarget);
  const current = map?.locations.find((l) => l.key === value);

  const groups = useMemo(() => {
    if (!map) return [];
    const needle = q.trim().toLowerCase();
    return map.districts
      .map((d) => ({
        d,
        items: map.locations.filter((l) => l.district === d.id && l.key !== exclude && (!needle || l.name.toLowerCase().includes(needle) || d.name.toLowerCase().includes(needle))),
      }))
      .filter((g) => g.items.length);
  }, [map, q, exclude]);

  return (
    <div className="relative">
      <div className="flex items-stretch gap-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-asphalt-950/70 px-3.5 py-2.5 text-left hover:border-white/25">
          <span className={cn('h-3 w-3 shrink-0 rounded-full', tone === 'from' ? 'bg-abuja' : 'bg-taxi')} />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">{label}</span>
            <span className="block truncate font-display text-xl font-bold uppercase leading-tight">{current?.name ?? 'Choose a place'}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-asphalt-300" />
        </button>
        <button type="button" aria-label={`Pick ${label} on the map`} title="Pick on the map" onClick={() => { setPickTarget(pickTarget === target ? null : target); setOpen(false); }} className={cn('rounded-xl border px-3', pickTarget === target ? 'border-taxi bg-taxi/20 text-taxi' : 'border-white/10 bg-asphalt-950/70 hover:border-white/25')}>
          <Crosshair className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div role="listbox" className="anim-pop absolute inset-x-0 bottom-full z-10 mb-2 max-h-[46vh] overflow-hidden rounded-xl border border-white/10 bg-asphalt-800 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <Search className="h-4 w-4 text-asphalt-300" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wuse, Jabi Lake Mall, Airport…" className="w-full bg-transparent text-sm outline-none placeholder:text-asphalt-500" />
          </div>
          <div className="max-h-[38vh] overflow-y-auto scroll-thin">
            {groups.map(({ d, items }) => (
              <div key={d.id}>
                <p className="sticky top-0 bg-asphalt-800/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-taxi">{d.name}</p>
                {items.map((l) => (
                  <button key={l.key} role="option" aria-selected={l.key === value} onClick={() => { onChange(l.key); setOpen(false); setQ(''); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/10">
                    <span>{l.name}<span className="ml-2 text-xs text-asphalt-300">{LOCATION_LABEL[l.type]}</span></span>
                    {l.key === value && <Check className="h-4 w-4 text-abuja" />}
                  </button>
                ))}
              </div>
            ))}
            {!groups.length && <p className="p-4 text-sm text-asphalt-300">No places match “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
