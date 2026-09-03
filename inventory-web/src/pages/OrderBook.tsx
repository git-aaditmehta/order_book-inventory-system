import React, { useState } from 'react';
import { api } from '../api/client';
import type { OrderPreviewResponse, OrderProcessResponse, UserRole } from '../types';
import { CheckCircle, AlertOctagon, ArrowRight, RefreshCw } from 'lucide-react';

interface OrderBookProps {
  userRole: UserRole;
}

export const OrderBook: React.FC<OrderBookProps> = ({ userRole }) => {
  const [skuId, setSkuId] = useState('');
  const [color, setColor] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number | ''>(1);
  
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingProcess, setLoadingProcess] = useState(false);
  
  const [previewData, setPreviewData] = useState<OrderPreviewResponse | null>(null);
  const [successResult, setSuccessResult] = useState<OrderProcessResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuId || !color || !orderQuantity || Number(orderQuantity) <= 0) {
      setErrorMessage('Please enter valid SKU ID, Color, and Quantity.');
      return;
    }

    setLoadingPreview(true);
    setErrorMessage(null);
    setSuccessResult(null);

    try {
      const res = await api.post('/orders/preview', {
        sku_id: skuId.trim(),
        color: color.trim(),
        order_quantity: Number(orderQuantity)
      });
      setPreviewData(res.data);
    } catch (err: any) {
      setPreviewData(null);
      setErrorMessage(err.response?.data?.detail || 'Jewelry item not found or failed to preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProcessOrder = async () => {
    if (!previewData || !previewData.is_executable) return;

    setLoadingProcess(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/orders/process', {
        sku_id: skuId.trim(),
        color: color.trim(),
        order_quantity: Number(orderQuantity)
      });

      setSuccessResult(res.data);
      setPreviewData(null);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to process order.');
    } finally {
      setLoadingProcess(false);
    }
  };

  const handleReset = () => {
    setSkuId('');
    setColor('');
    setOrderQuantity(1);
    setPreviewData(null);
    setSuccessResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="pj-header-title">Order Book Ledger</h1>
        <p className="pj-header-subtitle">
          Daily accounting entry · Enter Jewelry SKU & Color to calculate raw material deductions
        </p>
      </div>

      {/* ── Input Form Card ── */}
      <div className="pj-stat-card" style={{ padding: '1.25rem' }}>
        <form onSubmit={handlePreview} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label className="pj-form-label">SKU ID *</label>
            <input
              type="text"
              placeholder="e.g. J-101"
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="pj-input"
              style={{ paddingLeft: '0.875rem' }}
              required
            />
          </div>

          <div>
            <label className="pj-form-label">Color *</label>
            <input
              type="text"
              placeholder="e.g. Rose Gold"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="pj-input"
              style={{ paddingLeft: '0.875rem' }}
              required
            />
          </div>

          <div>
            <label className="pj-form-label">Order Quantity *</label>
            <input
              type="number"
              min="1"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(e.target.value ? parseInt(e.target.value) : '')}
              className="pj-input"
              style={{ paddingLeft: '0.875rem', fontWeight: 700 }}
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loadingPreview}
              className="pj-btn-add"
              style={{ width: '100%', justifyContent: 'center', height: '44px' }}
            >
              {loadingPreview ? <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" /> : 'Check Stock & Preview'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Error / Warning Alert ── */}
      {errorMessage && (
        <div style={{
          backgroundColor: '#F5E3E3',
          border: '1px solid #9B5757',
          color: '#9B5757',
          padding: '1rem',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          <AlertOctagon style={{ width: 20, height: 20, flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Stock Deduction Preview Card ── */}
      {previewData && (
        <div className="pj-stat-card animate-fadeIn" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #CCC5B6', paddingBottom: '0.75rem', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A88A52' }}>
                Jewelry Selected
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#171817', margin: '0.1rem 0' }}>
                {previewData.jewelry.sku_id} — {previewData.jewelry.color}
              </h2>
              <span style={{ fontSize: '0.8125rem', color: '#52504B' }}>
                Order Qty: <strong>{previewData.order_quantity} units</strong> · Weights: {previewData.jewelry.weight_before}g / {previewData.jewelry.weight_after}g
              </span>
            </div>

            {userRole === 'OWNER' && previewData.total_order_cost !== null && previewData.total_order_cost !== undefined && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.6875rem', color: '#52504B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Calculated Order Cost
                </span>
                <span className="pj-unit-cost" style={{ fontSize: '1.35rem' }}>
                  {previewData.total_order_cost?.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Insufficient Alert */}
          {!previewData.is_executable && (
            <div style={{
              backgroundColor: '#F5E3E3',
              border: '1px solid #9B5757',
              color: '#9B5757',
              padding: '1rem',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.8125rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.875rem' }}>
                <AlertOctagon style={{ width: 18, height: 18 }} />
                <span>ORDER BLOCKED: Insufficient Raw Material Stock</span>
              </div>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
                {previewData.shortages.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
              <span style={{ fontStyle: 'italic', marginTop: '0.25rem' }}>
                Please restock the required raw materials in the Raw Materials section before placing this order.
              </span>
            </div>
          )}

          {/* Raw Materials Required Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #CCC5B6', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B' }}>
                  <th style={{ padding: '0.625rem 0.5rem' }}>Raw Material</th>
                  <th style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>Required Units</th>
                  <th style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>Packets Needed</th>
                  <th style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>Current Stock</th>
                  <th style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>Stock Status</th>
                  {userRole === 'OWNER' && <th style={{ padding: '0.625rem 0.5rem', textAlign: 'right' }}>Line Cost</th>}
                </tr>
              </thead>
              <tbody>
                {previewData.materials_required.map((mat) => {
                  const pktsNeeded = Math.floor(mat.units_required / mat.quantity_per_packet);
                  const looseNeeded = mat.units_required % mat.quantity_per_packet;
                  const pktDisplay = pktsNeeded > 0
                    ? `${pktsNeeded} pkts${looseNeeded > 0 ? ` (${looseNeeded} loose)` : ''}`
                    : `${looseNeeded} loose`;

                  return (
                    <tr key={mat.raw_material_id} style={{ borderBottom: '1px solid #CCC5B6' }}>
                      <td style={{ padding: '0.625rem 0.5rem', fontWeight: 600, color: '#171817' }}>
                        {mat.name} <span style={{ fontWeight: 400, color: '#52504B' }}>({mat.color})</span>
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center', fontFamily: 'var(--pj-font-mono)', fontWeight: 700, color: '#496B58' }}>
                        {mat.units_required} units
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center', fontFamily: 'var(--pj-font-mono)', fontWeight: 600, color: '#806B3F' }}>
                        {pktDisplay}
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center', fontFamily: 'var(--pj-font-mono)', color: '#52504B' }}>
                        {Math.floor(mat.total_available / mat.quantity_per_packet)} pkts ({mat.total_available % mat.quantity_per_packet} loose)
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                        {mat.is_sufficient ? (
                          <span style={{ backgroundColor: '#DFE8E3', color: '#496B58', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle style={{ width: 12, height: 12 }} /> Sufficient
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#F5E3E3', color: '#9B5757', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertOctagon style={{ width: 12, height: 12 }} /> Shortage
                          </span>
                        )}
                      </td>
                      {userRole === 'OWNER' && (
                        <td style={{ padding: '0.625rem 0.5rem', textAlign: 'right', fontFamily: 'var(--pj-font-mono)', fontWeight: 700, color: '#7A6438' }}>
                          {mat.line_cost?.toFixed(2)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #CCC5B6', paddingTop: '0.75rem' }}>
            <button onClick={handleReset} className="pj-action-btn-ghost" style={{ border: '1px solid #CCC5B6', padding: '0.5rem 1rem' }}>
              Cancel
            </button>
            <button
              onClick={handleProcessOrder}
              disabled={!previewData.is_executable || loadingProcess}
              className="pj-action-btn-restock"
              style={{ opacity: !previewData.is_executable ? 0.5 : 1, cursor: !previewData.is_executable ? 'not-allowed' : 'pointer', padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              {loadingProcess ? <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" /> : 'Confirm & Deduct Stock'}
            </button>
          </div>
        </div>
      )}

      {/* ── Success Result View ── */}
      {successResult && (() => {
        const materials = successResult.materials_used || successResult.materials_summary || [];
        const txId = successResult.order_transaction_id || successResult.id || 'N/A';
        return (
          <div className="pj-stat-card animate-fadeIn" style={{ padding: '1.5rem', borderLeft: '4px solid #496B58', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle style={{ width: 28, height: 28, color: '#496B58' }} />
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#496B58' }}>Order Executed Successfully!</h3>
                <span style={{ fontSize: '0.8125rem', color: '#52504B' }}>
                  Transaction ID: <strong>{txId}</strong> | SKU: <strong>{successResult.sku_id} ({successResult.color})</strong> | Qty: <strong>{successResult.order_quantity}</strong>
                </span>
              </div>
            </div>

            {userRole === 'OWNER' && successResult.total_order_cost !== null && successResult.total_order_cost !== undefined && (
              <div style={{ backgroundColor: '#E0D9CB', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', border: '1px solid #CCC5B6' }}>
                <span style={{ fontWeight: 600, color: '#52504B' }}>Recorded Order Cost:</span>
                <span className="pj-unit-cost" style={{ fontSize: '1.125rem' }}>{successResult.total_order_cost?.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B' }}>
                Raw Material Deductions:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {materials.map((mat, i) => (
                  <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ fontWeight: 700, color: '#171817' }}>{mat.name} ({mat.color})</div>
                    <div style={{ color: '#496B58', fontWeight: 700 }}>Deducted: {mat.units_used} units</div>
                    {mat.stock_before && mat.stock_after && (
                      <div style={{ fontSize: '0.75rem', color: '#52504B', borderTop: '1px solid #CCC5B6', paddingTop: '0.25rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Before: {mat.stock_before.packets} pkts</span>
                        <ArrowRight style={{ width: 12, height: 12 }} />
                        <span style={{ fontWeight: 700, color: '#171817' }}>After: {mat.stock_after.packets} pkts</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: '0.5rem' }}>
              <button onClick={handleReset} className="pj-btn-add">
                Place Next Order
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
