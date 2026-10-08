import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Users } from 'lucide-react';
import { Button, Input, cn } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { AuthLayout } from './AuthLayout';

export default function Register() {
  const register = useAuth((s) => s.register);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'DRIVER' | 'PASSENGER'>(params.get('mode') === 'passenger' ? 'PASSENGER' : 'DRIVER');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await register({ ...form, mode });
      nav('/play', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (Array.isArray(err.details)) {
          setFieldErrors(Object.fromEntries((err.details as Array<{ field: string; message: string }>).map((d) => [d.field, d.message])));
        }
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const choices = [
    { id: 'DRIVER' as const, icon: Car, title: 'Driver', text: 'Start with a tired sedan and ₦25,000. Earn your way to a fleet.' },
    { id: 'PASSENGER' as const, icon: Users, title: 'Passenger', text: 'Ride across the city. Compare fares, beat the traffic, tip well.' },
  ];

  return (
    <AuthLayout
      title="Join ALONG"
      subtitle="Choose how you start. You can switch any time."
      footer={
        <>
          Already have an account? <Link to="/login" className="font-semibold text-taxi hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Play as">
          {choices.map((c) => (
            <button
              type="button"
              key={c.id}
              role="radio"
              aria-checked={mode === c.id}
              onClick={() => setMode(c.id)}
              className={cn('rounded-xl border p-3 text-left transition-colors', mode === c.id ? 'border-taxi bg-taxi/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}
            >
              <c.icon className={cn('mb-2 h-6 w-6', mode === c.id ? 'text-taxi' : 'text-asphalt-300')} />
              <p className="font-display text-xl font-bold uppercase">{c.title}</p>
              <p className="mt-0.5 text-xs text-asphalt-300">{c.text}</p>
            </button>
          ))}
        </div>
        <Input label="Your name" name="name" required minLength={2} maxLength={40} autoComplete="name" value={form.name} error={fieldErrors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Email" name="email" type="email" required autoComplete="email" value={form.email} error={fieldErrors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} error={fieldErrors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && !Object.keys(fieldErrors).length && <p role="alert" className="rounded-lg border border-brake/40 bg-brake/10 px-3 py-2 text-sm text-[#ff8b80]">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Enter the city</Button>
      </form>
    </AuthLayout>
  );
}
