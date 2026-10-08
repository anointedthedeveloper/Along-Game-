import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { AuthLayout } from './AuthLayout';

export default function Login() {
  const login = useAuth((s) => s.login);
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      nav((loc.state as { from?: string } | null)?.from ?? '/play', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Your car is where you left it."
      footer={
        <>
          New to ALONG? <Link to="/register" className="font-semibold text-taxi hover:underline">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg border border-brake/40 bg-brake/10 px-3 py-2 text-sm text-[#ff8b80]">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
        <div className="text-right text-sm"><Link to="/forgot-password" className="text-asphalt-300 hover:text-cream">Forgot password?</Link></div>
      </form>
    </AuthLayout>
  );
}
