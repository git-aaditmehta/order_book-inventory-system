import React, { useState } from 'react';
import { api } from '../api/client';
import type { OrderPreviewResponse, OrderProcessResponse, UserRole } from '../types';
import { BookOpen, CheckCircle, AlertOctagon, ArrowRight, RefreshCw } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Title & Description */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
          <span>Order Book Ledger</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Daily accounting entry. Enter Jewelry SKU & Color to calculate raw material deductions.
        </p>
      </div>

      {/* Input Form Card */}
      <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl p-5 md:p-6 shadow-sm">
        <form onSubmit={handlePreview} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              SKU ID *
            </label>
            <input
              type="text"
              placeholder="e.g. J-101"
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Color *
            </label>
            <input
              type="text"
              placeholder="e.g. Rose Gold"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Order Quantity *
            </label>
            <input
              type="number"
              min="1"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(e.target.value ? parseInt(e.target.value) : '')}
              className="input-field"
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loadingPreview}
              className="btn-primary flex-1"
            >
              {loadingPreview ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Check Stock & Preview'}
            </button>
          </div>
        </form>
      </div>

      {/* Error / Warning Alert */}
      {errorMessage && (
        <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger)] text-red-300 p-4 rounded-xl flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Stock Deduction Preview Card */}
      {previewData && (
        <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--color-border)] gap-4">
            <div>
              <span className="text-xs text-[var(--color-accent)] font-semibold uppercase tracking-wider">Jewelry Selected</span>
              <h2 className="text-xl font-bold">{previewData.jewelry.sku_id} — {previewData.jewelry.color}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Order Quantity: {previewData.order_quantity} units | Weights: {previewData.jewelry.weight_before}g / {previewData.jewelry.weight_after}g
              </p>
            </div>

            {userRole === 'OWNER' && previewData.total_order_cost !== null && previewData.total_order_cost !== undefined && (
              <div className="text-right">
                <span className="text-xs text-[var(--color-text-muted)] block">Calculated Total Cost</span>
                <span className="text-xl font-bold text-[var(--color-accent)]">
                  ${previewData.total_order_cost?.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Insufficient Alert */}
          {!previewData.is_executable && (
            <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger)] text-red-200 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-red-400">
                <AlertOctagon className="w-5 h-5" />
                <span>ORDER BLOCKED: Insufficient Raw Material Stock</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-1">
                {previewData.shortages.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
              <p className="text-xs italic mt-2 text-red-300">
                Please restock the required raw materials in the Raw Materials section before placing this order.
              </p>
            </div>
          )}

          {/* Raw Materials Required Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase">
                  <th className="py-3 px-2">Raw Material</th>
                  <th className="py-3 px-2 text-center">Required Units</th>
                  <th className="py-3 px-2 text-center">Current Stock</th>
                  <th className="py-3 px-2 text-center">Stock Status</th>
                  {userRole === 'OWNER' && <th className="py-3 px-2 text-right">Line Cost</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {previewData.materials_required.map((mat) => (
                  <tr key={mat.raw_material_id} className="hover:bg-[var(--color-paper-card-hover)]">
                    <td className="py-3 px-2 font-medium">
                      <div className="font-semibold">{mat.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{mat.color}</div>
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-[var(--color-accent)]">
                      {mat.units_required} units
                    </td>
                    <td className="py-3 px-2 text-center text-xs">
                      {Math.floor(mat.total_available / mat.quantity_per_packet)} pkts ({mat.total_available % mat.quantity_per_packet} loose)
                    </td>
                    <td className="py-3 px-2 text-center">
                      {mat.is_sufficient ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400 font-semibold bg-green-950/40 px-2 py-1 rounded">
                          <CheckCircle className="w-3.5 h-3.5" /> Sufficient
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400 font-semibold bg-red-950/40 px-2 py-1 rounded">
                          <AlertOctagon className="w-3.5 h-3.5" /> Shortage
                        </span>
                      )}
                    </td>
                    {userRole === 'OWNER' && (
                      <td className="py-3 px-2 text-right font-medium">
                        ${mat.line_cost?.toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Execution Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button onClick={handleReset} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleProcessOrder}
              disabled={!previewData.is_executable || loadingProcess}
              className="btn-primary bg-green-600 hover:bg-green-500 text-white"
            >
              {loadingProcess ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm & Deduct Stock'}
            </button>
          </div>
        </div>
      )}

      {/* Success Transaction Result View */}
      {successResult && (() => {
        const materials = successResult.materials_used || successResult.materials_summary || [];
        const txId = successResult.order_transaction_id || successResult.id || 'N/A';
        return (
          <div className="bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-xl p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-7 h-7 text-green-400" />
              <div>
                <h3 className="font-bold text-lg text-green-300">Order Executed Successfully!</h3>
                <p className="text-xs text-green-200">
                  Transaction ID: {txId} | SKU: {successResult.sku_id} ({successResult.color}) | Qty: {successResult.order_quantity}
                </p>
              </div>
            </div>

            {userRole === 'OWNER' && successResult.total_order_cost !== null && successResult.total_order_cost !== undefined && (
              <div className="bg-black/30 p-3 rounded-lg text-sm flex justify-between items-center">
                <span>Recorded Order Cost:</span>
                <span className="font-bold text-green-300">${successResult.total_order_cost?.toFixed(2)}</span>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-green-200">Raw Material Deductions:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {materials.map((mat, i) => (
                  <div key={i} className="bg-black/20 p-3 rounded-lg text-xs space-y-1">
                    <div className="font-bold text-white">{mat.name} ({mat.color})</div>
                    <div className="text-green-300">Deducted: {mat.units_used} units</div>
                    {mat.stock_before && mat.stock_after && (
                      <div className="text-[var(--color-text-muted)] flex justify-between">
                        <span>Before: {mat.stock_before.packets} pkts ({mat.stock_before.loose} loose)</span>
                        <ArrowRight className="w-3 h-3 self-center" />
                        <span className="text-white font-semibold">After: {mat.stock_after.packets} pkts ({mat.stock_after.loose} loose)</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button onClick={handleReset} className="btn-primary w-full md:w-auto">
                Place Next Order
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
