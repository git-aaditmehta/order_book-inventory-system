import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { OrderBook } from './pages/OrderBook';
import { RawMaterials } from './pages/RawMaterials';
import { JewelryCatalog } from './pages/JewelryCatalog';
import { OrderHistory } from './pages/OrderHistory';
import { LowStock } from './pages/LowStock';
import { Insights } from './pages/Insights';
import { Backup } from './pages/Backup';
import { SecurityDashboard } from './pages/SecurityDashboard';
import { api } from './api/client';
import type { UserRole } from './types';

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
    </BrowserRouter>
  );
}

export default App;
