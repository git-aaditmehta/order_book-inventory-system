import React, { useState } from 'react';
import { supabase, api } from '../api/client';
import type { UserRole } from '../types';
import { Gem, Lock, Mail, Shield, User, ArrowRight, RefreshCw } from 'lucide-react';

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
          setErrorMsg('Registration successful! Please check your email to confirm, or log in.');
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
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center p-4">
      <div className="auth-card-container space-y-6 shadow-2xl">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#0b0f19] border border-[var(--color-border)] flex items-center justify-center mx-auto">
            <Gem className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Luxe Craft Inventory</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            BOM Accounting & Order Calculation System
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger)] text-red-300 p-3 rounded-lg text-xs">
            {errorMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3 text-[var(--color-text-muted)] pointer-events-none z-10" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field input-field-icon"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3 text-[var(--color-text-muted)] pointer-events-none z-10" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field input-field-icon"
                required
              />
            </div>
          </div>

          {/* Role Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('MANAGER')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  role === 'MANAGER'
                    ? 'border-[var(--color-accent)] bg-[#0b0f19] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[#131b2e] text-[var(--color-text-muted)] hover:bg-[#1c2742]'
                }`}
              >
                <User className="w-4 h-4" /> Manager
              </button>

              <button
                type="button"
                onClick={() => setRole('OWNER')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  role === 'OWNER'
                    ? 'border-[var(--color-accent)] bg-[#0b0f19] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[#131b2e] text-[var(--color-text-muted)] hover:bg-[#1c2742]'
                }`}
              >
                <Shield className="w-4 h-4" /> Owner
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center pt-2 border-t border-[var(--color-border)]">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); }}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
