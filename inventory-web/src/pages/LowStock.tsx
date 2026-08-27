import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { RawMaterial, UserRole } from '../types';
import { AlertTriangle, RefreshCw, Sliders, CheckCircle2 } from 'lucide-react';

interface LowStockProps {
  userRole: UserRole;
}

export const LowStock: React.FC<LowStockProps> = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdType, setThresholdType] = useState<'packets' | 'units'>('packets');
  const [thresholdValue, setThresholdValue] = useState<number>(5);

  const fetchLowStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/low-stock', {
        params: {
          threshold_type: thresholdType,
          threshold_value: thresholdValue
        }
      });
      setMaterials(res.data);
    } catch (err) {
      console.error('Failed to load low stock:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, [thresholdType, thresholdValue]);

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="pj-header-title" style={{ color: '#9B5757', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle style={{ width: 24, height: 24 }} /> Low Stock Alerts
        </h1>
        <p className="pj-header-subtitle">
          Inventory monitoring · Raw materials falling below defined stock thresholds for immediate restock
        </p>
      </div>

      {/* ── Threshold Filter Bar ── */}
      <div className="pj-search-box">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sliders style={{ width: 18, height: 18, color: '#A88A52' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#171817' }}>Filter Threshold:</span>
            <select
              value={thresholdType}
              onChange={(e) => setThresholdType(e.target.value as 'packets' | 'units')}
              className="pj-input"
              style={{ width: '130px', paddingLeft: '0.75rem', height: '38px', fontSize: '0.8125rem' }}
            >
              <option value="packets">Packets</option>
              <option value="units">Total Units</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#52504B' }}>Below or Equal to:</span>
            <input
              type="number"
              min="0"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(parseInt(e.target.value) || 0)}
              className="pj-input"
              style={{ width: '90px', paddingLeft: '0.5rem', textAlign: 'center', height: '38px', fontWeight: 700, fontSize: '0.875rem' }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#806B3F' }}>
              {thresholdType}
            </span>
          </div>
        </div>
      </div>

      {/* ── Low Stock Grid ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Checking stock thresholds…</span>
        </div>
      ) : materials.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #CCC5B6',
          borderRadius: '14px',
          padding: '3rem 1rem',
          textAlign: 'center',
        }}>
          <CheckCircle2 style={{ width: 44, height: 44, color: '#496B58', margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontWeight: 600, fontSize: '1.125rem', color: '#496B58' }}>All Stock Levels Healthy!</p>
          <p style={{ fontSize: '0.875rem', color: '#52504B', marginTop: '0.25rem' }}>
            No raw materials fall below {thresholdValue} {thresholdType}.
          </p>
        </div>
      ) : (
        <div className="material-grid">
          {materials.map((mat) => (
            <article key={mat.id} className="pj-material-card" style={{ borderTop: '3px solid #9B5757' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="pj-material-name">{mat.name}</h3>
                  <div className="pj-color-indicator">
                    <span className="pj-color-dot" style={{ backgroundColor: getGemColor(mat.color).bg }} />
                    <span>{mat.color}</span>
                  </div>
                </div>
                <span style={{ backgroundColor: '#F5E3E3', color: '#9B5757', border: '1px solid #9B5757', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                  Low Stock
                </span>
              </div>

              <hr className="pj-divider" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className="pj-ledger-row">
                  <span className="pj-ledger-label">Current Packets</span>
                  <span className="pj-ledger-value" style={{ color: '#9B5757' }}>{mat.packets} pkts</span>
                </div>
                <div className="pj-ledger-row">
                  <span className="pj-ledger-label">Loose Units</span>
                  <span className="pj-ledger-value">{mat.loose_units}</span>
                </div>
                <div className="pj-ledger-row" style={{ borderTop: '1px solid #CCC5B6', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                  <span className="pj-ledger-label" style={{ fontWeight: 700, color: '#171817' }}>Total Available</span>
                  <span className="pj-ledger-value" style={{ fontSize: '1rem', color: '#171817' }}>{mat.total_units} units</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

/* Color Dot Helper */
function getGemColor(colorName: string): { bg: string; border?: string } {
  const c = colorName.toLowerCase();
  if (c.includes('green') || c.includes('emerald') || c.includes('jade')) return { bg: '#496B58' };
  if (c.includes('red') || c.includes('ruby') || c.includes('garnet') || c.includes('rose')) return { bg: '#9B5757' };
  if (c.includes('gold') || c.includes('yellow') || c.includes('amber')) return { bg: '#A88A52' };
  if (c.includes('silver') || c.includes('platinum') || c.includes('steel') || c.includes('gray')) return { bg: '#94A3B8' };
  if (c.includes('pearl') || c.includes('white') || c.includes('ivory')) return { bg: '#FFFFFF', border: '#CBD5E1' };
  if (c.includes('black') || c.includes('onyx') || c.includes('dark')) return { bg: '#171817' };
  if (c.includes('blue') || c.includes('sapphire')) return { bg: '#3B82F6' };
  return { bg: '#A88A52' };
}
