import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { OrderTransaction, UserRole } from '../types';
import { History, Search, RefreshCw, Layers } from 'lucide-react';

interface OrderHistoryProps {
  userRole: UserRole;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ userRole }) => {
  const [transactions, setTransactions] = useState<OrderTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchSku, setSearchSku] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/history', { params: { sku_id: searchSku } });
      setTransactions(res.data);
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [searchSku]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-[var(--color-accent)]" />
          <span>Order Transaction History</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Complete audit trail of all placed orders and raw material stock deductions.
        </p>
      </div>

      <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Filter by SKU ID..."
            value={searchSku}
            onChange={(e) => setSearchSku(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl">
          <History className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-lg">No Order Transactions Found</p>
          <p className="text-sm text-[var(--color-text-muted)]">Placed orders will be recorded here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--color-border)] gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{tx.sku_id}</span>
                    <span className="badge-gold">{tx.color}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Order Quantity: <span className="text-white font-semibold">{tx.order_quantity}</span> | Placed by: <span className="uppercase text-[var(--color-accent)]">{tx.placed_by_role}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[var(--color-text-muted)] block">{new Date(tx.created_at).toLocaleString()}</span>
                  {userRole === 'OWNER' && tx.total_order_cost !== null && (
                    <span className="text-base font-bold text-[var(--color-accent)]">
                      Total Cost: ${tx.total_order_cost?.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Deducted Raw Materials Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Materials Deducted:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {tx.materials_summary.map((mat, idx) => (
                    <div key={idx} className="bg-[var(--color-paper)] p-3 rounded-lg border border-[var(--color-border)] text-xs space-y-1">
                      <div className="font-semibold text-white">{mat.name} ({mat.color})</div>
                      <div className="text-[var(--color-accent)] font-bold">Deducted: {mat.units_used} units</div>
                      <div className="text-[var(--color-text-muted)] text-[11px] pt-1 border-t border-[var(--color-border)]">
                        Before: {mat.stock_before.packets} pkts ({mat.stock_before.loose} loose) <br />
                        After: <span className="text-white font-medium">{mat.stock_after.packets} pkts ({mat.stock_after.loose} loose)</span>
                      </div>
                      {userRole === 'OWNER' && mat.line_cost !== null && (
                        <div className="text-right text-[11px] font-semibold text-green-400">
                          Cost: ${mat.line_cost?.toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
