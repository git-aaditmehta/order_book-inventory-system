import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { api } from './api/client';
import { queryClient } from './api/queryClient';
import type { UserRole } from './types';


// Code-split pages for instant initial bundle loading
const OrderBook = lazy(() => import('./pages/OrderBook').then(m => ({ default: m.OrderBook })));
const RawMaterials = lazy(() => import('./pages/RawMaterials').then(m => ({ default: m.RawMaterials })));
const JewelryCatalog = lazy(() => import('./pages/JewelryCatalog').then(m => ({ default: m.JewelryCatalog })));
const OrderHistory = lazy(() => import('./pages/OrderHistory').then(m => ({ default: m.OrderHistory })));
const LowStock = lazy(() => import('./pages/LowStock').then(m => ({ default: m.LowStock })));
const Insights = lazy(() => import('./pages/Insights').then(m => ({ default: m.Insights })));
const Backup = lazy(() => import('./pages/Backup').then(m => ({ default: m.Backup })));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard').then(m => ({ default: m.SecurityDashboard })));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-12 min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-widest text-[#71717A]">Loading screen...</span>
      </div>
    </div>
  );
}

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('supabase_token'));
  const [userRole, setUserRole] = useState<UserRole>((localStorage.getItem('user_role') as UserRole) || 'MANAGER');
  const [userEmail, setUserEmail] = useState<string>(localStorage.getItem('user_email') || 'user@example.com');

  useEffect(() => {
    const handleAuthLogout = () => {
      setToken(null);
    };

    window.addEventListener('auth_logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth_logout', handleAuthLogout);
    };
  }, []);

  // Sync role with Supabase database profiles table on load
  useEffect(() => {
    if (token) {
      // 1. Sync role with Supabase database profiles table
      api.get('/auth/me')
        .then(res => {
          if (res.data?.role) {
            const dbRole = res.data.role as UserRole;
            setUserRole(dbRole);
            localStorage.setItem('user_role', dbRole);
          }
          if (res.data?.email) {
            setUserEmail(res.data.email);
            localStorage.setItem('user_email', res.data.email);
          }
        })
        .catch(() => {
          // Handled by client interceptor
        });

      // 2. Prefetch core inventory datasets on app boot for instant 0-second loading
      queryClient.prefetchQuery({
        queryKey: ['jewelry'],
        queryFn: async () => (await api.get('/jewelry')).data || []
      });
      queryClient.prefetchQuery({
        queryKey: ['raw-materials', '', ''],
        queryFn: async () => (await api.get('/raw-materials')).data || []
      });
    }
  }, [token]);


  const handleLoginSuccess = (role: UserRole, email: string, authToken: string) => {
    setToken(authToken);
    setUserRole(role);
    setUserEmail(email);
    localStorage.setItem('supabase_token', authToken);
    localStorage.setItem('user_role', role);
    localStorage.setItem('user_email', email);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Layout userRole={userRole} userEmail={userEmail} onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/order-book" replace />} />
            <Route path="order-book" element={<OrderBook userRole={userRole} />} />
            <Route path="raw-materials" element={<RawMaterials userRole={userRole} />} />
            <Route path="jewelry" element={<JewelryCatalog userRole={userRole} />} />
            <Route path="history" element={<OrderHistory userRole={userRole} />} />
            <Route path="low-stock" element={<LowStock userRole={userRole} />} />
            
            {/* Owner Only Protected Routes */}
            <Route 
              path="insights" 
              element={userRole === 'OWNER' ? <Insights userRole={userRole} /> : <Navigate to="/order-book" replace />} 
            />
            <Route 
              path="backup" 
              element={userRole === 'OWNER' ? <Backup userRole={userRole} /> : <Navigate to="/order-book" replace />} 
            />
            <Route 
              path="security" 
              element={userRole === 'OWNER' ? <SecurityDashboard userRole={userRole} /> : <Navigate to="/order-book" replace />} 
            />
            <Route path="*" element={<Navigate to="/order-book" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

