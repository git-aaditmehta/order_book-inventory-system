import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { RawMaterial, UserRole } from '../types';
import { AlertTriangle, RefreshCw, Sliders } from 'lucide-react';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-6 h-6" />
          <span>Low Stock Alerts</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Raw materials falling below the threshold for immediate restocking.
        </p>
      </div>

      {/* Threshold Filter Bar */}
      <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Sliders className="w-5 h-5 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Filter Threshold:</span>
          <select
            value={thresholdType}
            onChange={(e) => setThresholdType(e.target.value as 'packets' | 'units')}
            className="input-field w-32 py-1.5 text-xs"
          >
            <option value="packets">Packets</option>
            <option value="units">Total Units</option>
          </select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs text-[var(--color-text-muted)]">Below or Equal to:</span>
          <input
            type="number"
            min="0"
            value={thresholdValue}
            onChange={(e) => setThresholdValue(parseInt(e.target.value) || 0)}
            className="input-field w-24 text-center py-1.5 font-bold text-amber-400"
          />
          <span className="text-xs font-semibold uppercase">{thresholdType}</span>
        </div>
      </div>

      {/* Low Stock Items List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl space-y-2">
          <div className="w-12 h-12 rounded-full bg-green-950/40 text-green-400 flex items-center justify-center mx-auto">
            ✓
          </div>
          <p className="font-semibold text-lg text-white">All Stock Levels Healthy!</p>
          <p className="text-sm text-[var(--color-text-muted)]">No raw materials fall below {thresholdValue} {thresholdType}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((mat) => (
            <div
              key={mat.id}
              className="bg-[var(--color-paper-card)] border border-amber-900/60 rounded-xl p-5 space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{mat.name}</h3>
                  <span className="badge-gold mt-1 inline-block">{mat.color}</span>
                </div>
                <span className="bg-amber-950/80 text-amber-300 border border-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  Low Stock
                </span>
              </div>

              <div className="bg-[var(--color-paper)] p-3 rounded-lg border border-[var(--color-border)] space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Current Packets:</span>
                  <span className="font-bold text-amber-400">{mat.packets} pkts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Loose Units:</span>
                  <span>{mat.loose_units}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[var(--color-border)] font-semibold">
                  <span className="text-[var(--color-text-muted)]">Total Units Available:</span>
                  <span className="text-white">{mat.total_units} units</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
