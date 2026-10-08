import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { authApi } from '@/services';
import { toast } from '@/store/toast';
import { AuthLayout } from './AuthLayout';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.reset(token, password);
      toast.success('Password updated. Please sign in.');
      nav('/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="New password" footer={<Link to="/login" className="text-taxi hover:underline">Back to sign in</Link>}>
      {!token ? (
        <p className="text-[#ff8b80]">This reset link is missing its token. Request a new one.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-[#ff8b80]">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
