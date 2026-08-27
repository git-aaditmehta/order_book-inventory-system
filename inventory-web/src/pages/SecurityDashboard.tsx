import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../types';
import { Shield, Smartphone, Globe, RefreshCw, Key } from 'lucide-react';

interface SecurityProps {
  userRole: UserRole;
}

export const SecurityDashboard: React.FC<SecurityProps> = () => {
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/security/sessions');
      setSessionData(res.data);
    } catch (err) {
      console.error('Failed to load security sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-[var(--color-accent)]" />
          <span>Owner Security & Active Sessions</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Monitor active user logins, IP addresses, and device connections.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      ) : sessionData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-5 rounded-xl flex items-center gap-4">
              <Globe className="w-8 h-8 text-[var(--color-accent)]" />
              <div>
                <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase">Current Request IP</span>
                <p className="text-xl font-bold text-white mt-0.5">{sessionData.current_request_ip}</p>
              </div>
            </div>

            <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-5 rounded-xl flex items-center gap-4">
              <Smartphone className="w-8 h-8 text-green-400" />
              <div>
                <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase">Client Device Info</span>
                <p className="text-xs text-gray-300 mt-0.5 truncate max-w-xs">{sessionData.current_device}</p>
              </div>
            </div>
          </div>

          {/* Active Sessions List */}
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--color-accent)]" /> Logged In User Sessions
            </h3>

            <div className="space-y-3">
              {sessionData.active_sessions.map((sess: any, idx: number) => (
                <div key={idx} className="bg-[var(--color-paper)] p-4 rounded-lg border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{sess.email}</span>
                      <span className="badge-gold">{sess.role}</span>
                    </div>
                    <p className="text-[var(--color-text-muted)] mt-1">IP Address: {sess.ip_address} | Device: {sess.device}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-green-400 font-semibold bg-green-950/40 px-2.5 py-1 rounded">
                      ● Active Now
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
