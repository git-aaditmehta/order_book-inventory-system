import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { OrderTransaction, UserRole } from '../types';
import { History, Search, RefreshCw, Layers, ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="pj-header-title">Order Transaction History</h1>
        <p className="pj-header-subtitle">
          Audit log · Complete history of placed orders, user roles, and raw material deductions
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div className="pj-search-box">
        <div style={{ position: 'relative', maxWidth: '28rem' }}>
          <Search style={{
            position: 'absolute',
            left: '0.875rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 16,
            color: '#52504B',
            pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Filter by SKU ID (e.g. J-101)…"
            value={searchSku}
            onChange={(e) => setSearchSku(e.target.value)}
            className="pj-input"
          />
        </div>
      </div>

      {/* ── Transactions List ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Loading audit history…</span>
        </div>
      ) : transactions.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #CCC5B6',
          borderRadius: '14px',
          padding: '3rem 1rem',
          textAlign: 'center',
        }}>
          <History style={{ width: 40, height: 40, color: '#CCC5B6', margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', color: '#171817' }}>No Order Transactions Found</p>
          <p style={{ fontSize: '0.875rem', color: '#52504B', marginTop: '0.25rem' }}>
            Placed orders will automatically be recorded here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {transactions.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} userRole={userRole} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Compact Expandable Transaction Card ─── */

interface TransactionCardProps {
  tx: OrderTransaction;
  userRole: UserRole;
}

const TransactionCard: React.FC<TransactionCardProps> = ({ tx, userRole }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="pj-material-card"
      style={{ cursor: 'pointer', padding: '1rem 1.25rem' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#171817', margin: 0 }}>
              {tx.sku_id}
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', color: '#171817', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
              {tx.color}
            </span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: '#52504B', display: 'block', marginTop: '0.25rem' }}>
            Order Qty: <strong>{tx.order_quantity} units</strong> · Placed by: <strong style={{ textTransform: 'uppercase', color: '#7A6438' }}>{tx.placed_by_role}</strong>
          </span>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#52504B', display: 'block' }}>
              {new Date(tx.created_at).toLocaleString()}
            </span>
            {userRole === 'OWNER' && tx.total_order_cost !== null && (
              <span className="pj-unit-cost" style={{ fontSize: '1.125rem' }}>
                {tx.total_order_cost?.toFixed(2)}
              </span>
            )}
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52504B', padding: '0.25rem' }}
          >
            {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="animate-fadeIn" style={{ marginTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
          <hr className="pj-divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#806B3F', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Layers style={{ width: 13, height: 13 }} /> Materials Deducted:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {tx.materials_summary.map((mat, idx) => (
                <div key={idx} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.625rem 0.75rem', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ fontWeight: 700, color: '#171817' }}>{mat.name} ({mat.color})</div>
                  <div style={{ color: '#496B58', fontWeight: 700 }}>Deducted: {mat.units_used} units</div>
                  <div style={{ fontSize: '0.75rem', color: '#52504B', borderTop: '1px solid #CCC5B6', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                    Before: {mat.stock_before.packets} pkts ({mat.stock_before.loose} loose) <br />
                    After: <strong>{mat.stock_after.packets} pkts ({mat.stock_after.loose} loose)</strong>
                  </div>
                  {userRole === 'OWNER' && mat.line_cost !== null && (
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#7A6438' }}>
                      Cost: {mat.line_cost?.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
