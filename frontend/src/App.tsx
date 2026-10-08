import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { ToastHost } from '@/components/ToastHost';
import { useAuth } from '@/store/auth';
import Landing from '@/pages/Landing';
import Credits from '@/pages/Credits';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const Play = lazy(() => import('@/pages/Play'));
const Garage = lazy(() => import('@/pages/Garage'));
const Wallet = lazy(() => import('@/pages/Wallet'));
const Profile = lazy(() => import('@/pages/Profile'));
const Fleet = lazy(() => import('@/pages/Fleet'));

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner label="Starting your engine…" />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const loc = useLocation();
  if (status === 'booting') return <Splash />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  if (status === 'booting') return <Splash />;
  if (status === 'authenticated') return <Navigate to="/play" replace />;
  return <>{children}</>;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/play" element={<Protected><Play /></Protected>} />
          <Route path="/garage" element={<Protected><Garage /></Protected>} />
          <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
          <Route path="/fleet" element={<Protected><Fleet /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastHost />
    </BrowserRouter>
  );
}
