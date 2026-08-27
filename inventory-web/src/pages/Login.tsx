import React, { useState } from 'react';
import { supabase, api } from '../api/client';
import type { UserRole } from '../types';
import { Gem, Lock, Mail, Shield, User, ArrowRight, RefreshCw, Zap } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (role: UserRole, email: string, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('MANAGER');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleQuickLogin = async (targetRole: UserRole) => {
    const targetEmail = targetRole === 'OWNER' ? 'owner_test@example.com' : 'manager_test@example.com';
    const targetPassword = 'TestPassword123!';
    
    setEmail(targetEmail);
    setPassword(targetPassword);
    setRole(targetRole);
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword
      });

      if (error) throw error;
      const token = data.session.access_token;
      localStorage.setItem('supabase_token', token);

      try {
        const profileRes = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userRole = profileRes.data.role as UserRole;
        onLoginSuccess(userRole, targetEmail, token);
      } catch {
        onLoginSuccess(targetRole, targetEmail, token);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: { role: role }
          }
        });

        if (error) throw error;
        if (!data.session) {
          setErrorMsg('Registration successful! Please check your email or use Quick Demo Login below.');
          setIsSignUp(false);
          setLoading(false);
          return;
        }

        const token = data.session.access_token;
        localStorage.setItem('supabase_token', token);
        onLoginSuccess(role, email, token);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        });

        if (error) throw error;

        const token = data.session.access_token;
        localStorage.setItem('supabase_token', token);

        try {
          const profileRes = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const userRole = profileRes.data.role as UserRole;
          onLoginSuccess(userRole, email, token);
        } catch {
          const userRole = (data.user.user_metadata?.role as UserRole) || role;
          onLoginSuccess(userRole, email, token);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials or use Quick Demo Login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#E0D9CB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #CCC5B6',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '26rem',
        width: '100%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#171817',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#A88A52'
          }}>
            <Gem style={{ width: 24, height: 24 }} />
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '1.75rem', fontWeight: 700, color: '#171817', margin: '0.25rem 0 0 0' }}>
            Luxe Craft Inventory
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#52504B' }}>
            BOM Accounting & Order Calculation System
          </p>
        </div>

        {/* Quick Demo Login Section */}
        <div style={{
          backgroundColor: '#E0D9CB',
          border: '1px solid #CCC5B6',
          borderRadius: '10px',
          padding: '0.875rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#7A6438', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Zap style={{ width: 12, height: 12 }} /> 1-Click Quick Demo Login
            </span>
            <span style={{ fontSize: '0.625rem', color: '#52504B' }}>Pre-seeded Data</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('OWNER')}
              disabled={loading}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#171817',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <Shield style={{ width: 12, height: 12 }} /> Owner Demo
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('MANAGER')}
              disabled={loading}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#FFFFFF',
                color: '#171817',
                border: '1px solid #CCC5B6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <User style={{ width: 12, height: 12 }} /> Manager Demo
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            backgroundColor: '#F5E3E3',
            border: '1px solid #9B5757',
            color: '#9B5757',
            padding: '0.625rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {errorMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="pj-form-label">Email Address</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail style={{ position: 'absolute', left: '0.75rem', width: 16, height: 16, color: '#52504B', pointerEvents: 'none' }} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pj-input"
                style={{ paddingLeft: '2.25rem' }}
                required
              />
            </div>
          </div>

          <div>
            <label className="pj-form-label">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock style={{ position: 'absolute', left: '0.75rem', width: 16, height: 16, color: '#52504B', pointerEvents: 'none' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pj-input"
                style={{ paddingLeft: '2.25rem' }}
                required
              />
            </div>
          </div>

          {/* Role Selector */}
          <div>
            <label className="pj-form-label">Select Role</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRole('MANAGER')}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: role === 'MANAGER' ? '2px solid #171817' : '1px solid #CCC5B6',
                  backgroundColor: role === 'MANAGER' ? '#E0D9CB' : '#FFFFFF',
                  color: '#171817',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <User style={{ width: 14, height: 14 }} /> Manager
              </button>

              <button
                type="button"
                onClick={() => setRole('OWNER')}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: role === 'OWNER' ? '2px solid #171817' : '1px solid #CCC5B6',
                  backgroundColor: role === 'OWNER' ? '#E0D9CB' : '#FFFFFF',
                  color: '#171817',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Shield style={{ width: 14, height: 14 }} /> Owner
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="pj-btn-add"
            style={{ width: '100%', justifyContent: 'center', height: '42px', marginTop: '0.35rem' }}
          >
            {loading ? (
              <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight style={{ width: 16, height: 16 }} />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', borderTop: '1px solid #CCC5B6', paddingTop: '0.75rem' }}>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#52504B', fontWeight: 600 }}
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
