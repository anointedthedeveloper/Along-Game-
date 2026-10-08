import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Landmark } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Button, EmptyState, ErrorState, Input, cn } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { naira, TX_LABEL, timeAgo } from '@/lib/format';
import { walletApi } from '@/services';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import type { Transaction } from '@/types';

const FILTERS = ['', 'RIDE_EARNING', 'RIDE_PAYMENT', 'FUEL_PURCHASE', 'MAINTENANCE', 'FINE', 'TIP', 'VEHICLE_PURCHASE'];

export default function Wallet() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof walletApi.get>> | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (reset = true) => {
    try {
      const [s, t] = await Promise.all([walletApi.get(), walletApi.transactions(filter || undefined, 30, reset ? 0 : txs.length)]);
      setSummary(s);
      setTotal(t.total);
      setTxs(reset ? t.transactions : (prev) => [...prev, ...t.transactions] as never);
      setError(null);
      useGame.getState().setBalances(s.cash, s.bank);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your wallet');
    } finally {
      setLoading(false);
    }
  }, [filter, txs.length]);

  useEffect(() => {
    setLoading(true);
    void load(true);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function move(kind: 'deposit' | 'withdraw') {
    const n = Math.floor(Number(amount.replace(/,/g, '')));
    if (!n || n <= 0) return toast.warn('Enter an amount in Naira');
    setBusy(kind);
    try {
      const b = await (kind === 'deposit' ? walletApi.deposit(n) : walletApi.withdraw(n));
      useGame.getState().setBalances(b.cash, b.bank);
      toast.success(kind === 'deposit' ? `Deposited ${naira(n)} to your bank` : `Withdrew ${naira(n)} to cash`);
      setAmount('');
      await load(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Transfer failed');
    } finally {
      setBusy(null);
    }
  }

  const income = summary?.byType.filter((b) => b.total > 0 && !b.type.startsWith('BANK') && b.type !== 'STARTER_GRANT').reduce((a, b) => a + b.total, 0) ?? 0;
  const spend = -(summary?.byType.filter((b) => b.total < 0 && !b.type.startsWith('BANK')).reduce((a, b) => a + b.total, 0) ?? 0);

  return (
    <AppShell title="Wallet" subtitle="Every Naira in and out is recorded by the server.">
      {error && <ErrorState message={error} onRetry={() => load(true)} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-asphalt-700 to-asphalt-800 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-asphalt-300"><Banknote className="h-4 w-4" /> Cash on hand</p>
          <p className="mt-1 font-display text-5xl font-extrabold tabular text-cream">{summary ? naira(summary.cash) : '—'}</p>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-asphalt-300"><Landmark className="h-4 w-4" /> Bank balance</p>
          <p className="font-display text-3xl font-extrabold tabular text-taxi">{summary ? naira(summary.bank) : '—'}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-sm">
            <div><p className="text-asphalt-300">Money in</p><p className="font-display text-xl font-bold text-abuja tabular">{naira(income)}</p></div>
            <div><p className="text-asphalt-300">Money out</p><p className="font-display text-xl font-bold text-[#ff8b80] tabular">{naira(spend)}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="font-display text-xl font-bold uppercase">Move money</p>
          <p className="mb-3 text-sm text-asphalt-300">Keep cash for fuel and fares. Bank money is safe from road incidents.</p>
          <Input label="Amount (₦)" inputMode="numeric" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1000, 5000, 10000, 50000].map((n) => (
              <button key={n} onClick={() => setAmount(String(n))} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20">{naira(n)}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="dark" loading={busy === 'deposit'} onClick={() => move('deposit')}><ArrowDownToLine className="h-4 w-4" /> To bank</Button>
            <Button variant="dark" loading={busy === 'withdraw'} onClick={() => move('withdraw')}><ArrowUpFromLine className="h-4 w-4" /> To cash</Button>
          </div>
        </div>
      </div>

      <h2 className="mb-2 mt-8 font-display text-2xl font-bold uppercase">Transactions</h2>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('rounded-full px-3 py-1 text-xs font-semibold', filter === f ? 'bg-taxi text-asphalt-950' : 'bg-white/10 hover:bg-white/20')}>
            {f ? TX_LABEL[f] : 'All'}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : txs.length === 0 ? (
        <EmptyState title="No transactions yet" hint="Complete a ride or buy some fuel and it will show up here." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {txs.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', t.amount > 0 ? 'bg-abuja/20 text-abuja' : 'bg-brake/20 text-[#ff8b80]')}>{t.amount > 0 ? '+' : '−'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{TX_LABEL[t.type] ?? t.type}</p>
                <p className="truncate text-xs text-asphalt-300">{t.description} · {t.account.toLowerCase()} · {timeAgo(t.createdAt)}</p>
              </div>
              <p className={cn('font-display text-xl font-bold tabular', t.amount > 0 ? 'text-abuja' : 'text-[#ff8b80]')}>{t.amount > 0 ? '+' : '−'}{naira(Math.abs(t.amount))}</p>
            </li>
          ))}
        </ul>
      )}
      {txs.length < total && !loading && <Button variant="ghost" className="mt-3 w-full" onClick={() => load(false)}>Load more</Button>}
    </AppShell>
  );
}
