import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { authApi } from '@/services';
import { AuthLayout } from './AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { message: string; devToken?: string }>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone(await authApi.forgot(email));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We will send a reset link if the account exists." footer={<Link to="/login" className="text-taxi hover:underline">Back to sign in</Link>}>
      {done ? (
        <div className="space-y-3 rounded-xl border border-abuja/40 bg-abuja/10 p-4 text-sm">
          <p>{done.message}</p>
          {done.devToken && (
            <p className="text-asphalt-300">
              Development mode: no email provider is configured, so use <Link className="font-semibold text-taxi underline" to={`/reset-password?token=${done.devToken}`}>this reset link</Link>.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="text-sm text-[#ff8b80]">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
