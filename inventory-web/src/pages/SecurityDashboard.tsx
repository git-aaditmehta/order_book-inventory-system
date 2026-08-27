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
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="pj-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield style={{ width: 24, height: 24, color: '#A88A52' }} /> Owner Security & Active Sessions
        </h1>
        <p className="pj-header-subtitle">
          Security audit · Monitor active user logins, IP addresses, and device connections
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Loading security telemetry…</span>
        </div>
      ) : sessionData && (
        <div className="space-y-6">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="pj-stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
              <Globe style={{ width: 32, height: 32, color: '#A88A52', flexShrink: 0 }} />
              <div>
                <span className="pj-stat-label">Current Request IP</span>
                <p className="pj-stat-number" style={{ fontSize: '1.35rem', marginTop: '0.1rem' }}>
                  {sessionData.current_request_ip}
                </p>
              </div>
            </div>

            <div className="pj-stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
              <Smartphone style={{ width: 32, height: 32, color: '#496B58', flexShrink: 0 }} />
              <div>
                <span className="pj-stat-label">Client Device Info</span>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#171817', marginTop: '0.2rem' }}>
                  {sessionData.current_device}
                </p>
              </div>
            </div>
          </div>

          {/* Active Sessions List */}
          <div className="pj-stat-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#171817', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key style={{ width: 18, height: 18, color: '#A88A52' }} /> Logged In User Sessions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sessionData.active_sessions.map((sess: any, idx: number) => (
                <div key={idx} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.875rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8125rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#171817', fontSize: '0.875rem' }}>{sess.email}</span>
                      <span style={{ backgroundColor: '#171817', color: '#FFFFFF', fontSize: '0.6875rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                        {sess.role}
                      </span>
                    </div>
                    <span style={{ color: '#52504B', fontSize: '0.75rem', display: 'block', marginTop: '0.2rem' }}>
                      IP Address: {sess.ip_address} | Device: {sess.device}
                    </span>
                  </div>

                  <span style={{ backgroundColor: '#DFE8E3', color: '#496B58', fontWeight: 700, padding: '0.25rem 0.625rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    ● Active Session
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
