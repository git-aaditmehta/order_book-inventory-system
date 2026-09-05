import React, { useState } from 'react';
import { api } from '../api/client';
import type { OrderItemInput, OrderPreviewResponse, OrderProcessResponse, UserRole } from '../types';
import { CheckCircle, AlertOctagon, ArrowRight, RefreshCw, Plus, Trash2, Layers, Package, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

interface OrderBookProps {
  userRole: UserRole;
}

export const OrderBook: React.FC<OrderBookProps> = ({ userRole }) => {
  // Multi-jewelry item rows in the batch cart
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([
    { sku_id: '', color: '', order_quantity: 1 }
  ]);
  
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingProcess, setLoadingProcess] = useState(false);
  
  const [previewData, setPreviewData] = useState<OrderPreviewResponse | null>(null);
  const [successResult, setSuccessResult] = useState<OrderProcessResponse | null>(null);
  const [lastPreviewMaterials, setLastPreviewMaterials] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddItemRow = () => {
    setOrderItems([
      ...orderItems,
      { sku_id: '', color: '', order_quantity: 1 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (orderItems.length <= 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
    // Reset preview if rows are modified
    setPreviewData(null);
  };

  const handleItemChange = (index: number, field: keyof OrderItemInput, value: any) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
    // Clear previous preview on edits
    setPreviewData(null);
    setErrorMessage(null);
  };

  const formatErrorMsg = (detail: any): string => {
    if (!detail) return 'An unexpected error occurred.';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
    }
    if (typeof detail === 'object') {
      return detail.message || detail.msg || JSON.stringify(detail);
    }
    return String(detail);
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that all rows have non-empty SKU, color, and quantity > 0
    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      if (!item.sku_id.trim() || !item.color.trim() || !item.order_quantity || item.order_quantity <= 0) {
        setErrorMessage(`Please fill out valid SKU ID, Color, and Quantity for Item #${i + 1}.`);
        return;
      }
    }

    setLoadingPreview(true);
    setErrorMessage(null);
    setSuccessResult(null);

    try {
      const res = await api.post('/orders/preview', {
        items: orderItems.map(item => ({
          sku_id: item.sku_id.trim(),
          color: item.color.trim(),
          order_quantity: Number(item.order_quantity)
        }))
      });
      setPreviewData(res.data);
      if (res.data?.materials_required) {
        setLastPreviewMaterials(res.data.materials_required);
      }
    } catch (err: any) {
      setPreviewData(null);
      setErrorMessage(formatErrorMsg(err.response?.data?.detail));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProcessOrder = async () => {
    if (!previewData || !previewData.is_executable) return;

    setLoadingProcess(true);
    setErrorMessage(null);

    try {
      if (previewData.materials_required) {
        setLastPreviewMaterials(previewData.materials_required);
      }

      const res = await api.post('/orders/process', {
        items: orderItems.map(item => ({
          sku_id: item.sku_id.trim(),
          color: item.color.trim(),
          order_quantity: Number(item.order_quantity)
        }))
      });

      setSuccessResult(res.data);
      setPreviewData(null);
    } catch (err: any) {
      setErrorMessage(formatErrorMsg(err.response?.data?.detail));
    } finally {
      setLoadingProcess(false);
    }
  };

  const handleReset = () => {
    setOrderItems([{ sku_id: '', color: '', order_quantity: 1 }]);
    setPreviewData(null);
    setSuccessResult(null);
    setErrorMessage(null);
  };

  // Helper to format packets needed string
  const formatPacketsNeeded = (units: number, qtyPerPacket: number) => {
    const qpp = qtyPerPacket || 1;
    const pkts = Math.floor(units / qpp);
    const loose = units % qpp;
    if (pkts > 0) {
      return `${pkts} pkts${loose > 0 ? ` (${loose} loose)` : ''}`;
    }
    return `${loose} loose`;
  };

  const handleDownloadPDF = () => {
    if (!successResult) return;
    const doc = new jsPDF();
    const now = new Date();
    const nowStr = now.toLocaleString();
    const batchId = successResult.batch_id || successResult.order_transaction_id || successResult.id || 'N/A';
    const items = successResult.items_processed || orderItems || [];
    const materials = successResult.materials_used || successResult.materials_summary || [];

    // Map for looking up quantity_per_packet and line_cost from preview
    const previewMap = new Map<string, any>();
    lastPreviewMaterials.forEach(m => {
      previewMap.set(`${m.name}_${m.color}`, m);
      if (m.raw_material_id) previewMap.set(m.raw_material_id, m);
    });

    // ── Header Section ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(168, 138, 82); // Champagne Gold #A88A52
    doc.text('Luxe Craft', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(82, 80, 75);
    doc.text('BATCH ORDER RECEIPT & STOCK DEDUCTION LEDGER', 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${nowStr} | Role: ${userRole}`, 14, 31);
    doc.text(`Batch Reference ID: ${batchId}`, 14, 36);

    doc.setDrawColor(204, 197, 182);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    let y = 48;

    // ── Section 1: Ordered Jewelry Items ──
    const totalPieces = items.reduce((acc, it) => acc + (Number(it.order_quantity) || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 24, 23);
    doc.text(`1. Ordered Jewelry Items (${items.length} items, ${totalPieces} total pieces)`, 14, y);

    y += 6;
    doc.setFillColor(240, 236, 227);
    doc.rect(14, y - 4, 182, 7, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 80, 75);
    doc.text('Item #', 16, y);
    doc.text('Jewelry SKU', 36, y);
    doc.text('Color / Variant', 90, y);
    doc.text('Ordered Quantity', 150, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(23, 24, 23);
    items.forEach((it, idx) => {
      doc.text(`${idx + 1}`, 16, y);
      doc.text(`${it.sku_id || 'N/A'}`, 36, y);
      doc.text(`${it.color || 'N/A'}`, 90, y);
      doc.text(`${it.order_quantity || 0} pieces`, 150, y);
      y += 6;
    });

    // Total Batch Cost (Owner only)
    if (userRole === 'OWNER' && successResult.total_order_cost !== null && successResult.total_order_cost !== undefined) {
      y += 2;
      doc.setFillColor(224, 217, 203);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(122, 100, 56);
      doc.text('Total Batch Order Cost:', 16, y + 1);
      doc.text(`${successResult.total_order_cost.toFixed(2)}`, 160, y + 1);
      y += 11;
    } else {
      y += 5;
    }

    // ── Section 2: Raw Materials Deductions ──
    if (y > 210) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 24, 23);
    doc.text(`2. Combined Raw Material Deductions (${materials.length} components)`, 14, y);

    y += 6;
    // Table Header
    doc.setFillColor(240, 236, 227);
    doc.rect(14, y - 4, 182, 7, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(82, 80, 75);

    const isOwner = userRole === 'OWNER';
    if (isOwner) {
      doc.text('Raw Material (Color)', 16, y);
      doc.text('Units', 58, y);
      doc.text('Packets Needed', 78, y);
      doc.text('Stock Before', 110, y);
      doc.text('Stock After', 142, y);
      doc.text('Line Cost', 172, y);
    } else {
      doc.text('Raw Material (Color)', 16, y);
      doc.text('Units Deducted', 65, y);
      doc.text('Packets Needed', 95, y);
      doc.text('Stock Before', 130, y);
      doc.text('Stock After', 162, y);
    }

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(23, 24, 23);
    doc.setFontSize(7.5);

    materials.forEach((mat) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      const pInfo = previewMap.get(`${mat.name}_${mat.color}`) || previewMap.get(mat.raw_material_id) || {};
      const qtyPerPkt = mat.quantity_per_packet || pInfo.quantity_per_packet || 1;
      const unitsUsed = mat.units_used || mat.units_required || 0;
      const packetsNeededStr = formatPacketsNeeded(unitsUsed, qtyPerPkt);

      const matName = `${mat.name} (${mat.color})`;
      const beforeStr = mat.stock_before 
        ? `${mat.stock_before.packets}p (${mat.stock_before.loose}l)` 
        : (pInfo.packets_current !== undefined ? `${pInfo.packets_current}p (${pInfo.loose_current}l)` : '-');
      const afterStr = mat.stock_after 
        ? `${mat.stock_after.packets}p (${mat.stock_after.loose}l)` 
        : '-';

      const lineCostVal = mat.line_cost !== undefined && mat.line_cost !== null 
        ? Number(mat.line_cost) 
        : (pInfo.line_cost !== undefined && pInfo.line_cost !== null ? Number(pInfo.line_cost) : null);

      if (isOwner) {
        doc.text(matName, 16, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(73, 107, 88); // Forest Green
        doc.text(`${unitsUsed}`, 58, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(122, 100, 56);
        doc.text(packetsNeededStr, 78, y);
        doc.setTextColor(82, 80, 75);
        doc.text(beforeStr, 110, y);
        doc.setTextColor(23, 24, 23);
        doc.text(afterStr, 142, y);
        doc.setTextColor(122, 100, 56);
        doc.setFont('helvetica', 'bold');
        doc.text(lineCostVal !== null ? lineCostVal.toFixed(2) : '-', 172, y);
      } else {
        doc.text(matName, 16, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(73, 107, 88);
        doc.text(`${unitsUsed} units`, 65, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(122, 100, 56);
        doc.text(packetsNeededStr, 95, y);
        doc.setTextColor(82, 80, 75);
        doc.text(beforeStr, 130, y);
        doc.setTextColor(23, 24, 23);
        doc.text(afterStr, 162, y);
      }

      y += 6;
    });

    // ── Verification Footer ──
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(204, 197, 182);
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text('Luxe Craft Automated Inventory Ledger — Atomic Supabase Deduction Verified', 14, y);

    const cleanBatch = String(batchId).slice(0, 8);
    doc.save(`Order_Receipt_${cleanBatch}_${now.toISOString().slice(0, 10)}.pdf`);
  };

  const totalBatchUnits = orderItems.reduce((acc, it) => acc + (Number(it.order_quantity) || 0), 0);

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="pj-header-title">Order Book Ledger</h1>
          <p className="pj-header-subtitle">
            Batch ordering · Add multiple jewelry items to calculate combined raw material deductions
          </p>
        </div>

        {previewData && (
          <button onClick={() => setPreviewData(null)} className="pj-action-btn-ghost" style={{ border: '1px solid #CCC5B6', height: '40px', padding: '0 1rem' }}>
            Modify Items ({orderItems.length})
          </button>
        )}
      </div>

      {/* ── Batch Order Form (When not previewing or modifying) ── */}
      {!previewData && !successResult && (
        <div className="pj-stat-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #CCC5B6', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#171817', margin: 0 }}>
                Order Batch Items ({orderItems.length})
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#52504B' }}>
                Total Jewelry Quantity: <strong>{totalBatchUnits} pieces</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddItemRow}
              className="pj-btn-add"
              style={{ height: '36px', fontSize: '0.8125rem', padding: '0 1rem' }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Add Another Jewelry
            </button>
          </div>

          <form onSubmit={handlePreview} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {orderItems.map((item, idx) => (
              <div 
                key={idx}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CCC5B6',
                  borderRadius: '10px',
                  padding: '0.875rem 1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                  boxShadow: '0 1px 3px rgba(23, 24, 23, 0.02)'
                }}
              >
                <div>
                  <label className="pj-form-label" style={{ fontSize: '0.6875rem' }}>
                    Jewelry #{idx + 1} SKU ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JW-101"
                    value={item.sku_id}
                    onChange={(e) => handleItemChange(idx, 'sku_id', e.target.value)}
                    className="pj-input"
                    style={{ paddingLeft: '0.875rem', height: '40px' }}
                    required
                  />
                </div>

                <div>
                  <label className="pj-form-label" style={{ fontSize: '0.6875rem' }}>
                    Color *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rose Gold"
                    value={item.color}
                    onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                    className="pj-input"
                    style={{ paddingLeft: '0.875rem', height: '40px' }}
                    required
                  />
                </div>

                <div>
                  <label className="pj-form-label" style={{ fontSize: '0.6875rem' }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.order_quantity}
                    onChange={(e) => handleItemChange(idx, 'order_quantity', e.target.value ? parseInt(e.target.value) : '')}
                    className="pj-input"
                    style={{ paddingLeft: '0.875rem', fontWeight: 700, height: '40px' }}
                    required
                  />
                </div>

                {orderItems.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="pj-action-btn-danger"
                      style={{ height: '40px', width: '40px' }}
                      title="Remove item"
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #CCC5B6', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleAddItemRow}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#806B3F', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus style={{ width: 15, height: 15 }} /> Add another jewelry to batch
              </button>

              <button
                type="submit"
                disabled={loadingPreview}
                className="pj-btn-add"
                style={{ height: '44px', padding: '0 1.5rem', minWidth: '220px', justifyContent: 'center' }}
              >
                {loadingPreview ? (
                  <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" />
                ) : (
                  `Check Stock & Preview (${orderItems.length} items)`
                )}
              </button>
            </div>
          </form>
        </div>
      )}

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

      {/* ── Stock Deduction Preview Card (Aggregated Output) ── */}
      {previewData && (
        <div className="pj-stat-card animate-fadeIn" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Batch Summary Header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #CCC5B6', paddingBottom: '1rem', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A88A52', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Package style={{ width: 14, height: 14 }} /> Batch Order Summary
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#171817', margin: '0.2rem 0' }}>
                {previewData.items ? `${previewData.items.length} Jewelry Items` : 'Jewelry Order'}
              </h2>
              
              {/* List of jewelry items in this batch */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {previewData.items?.map((it, idx) => (
                  <span 
                    key={idx} 
                    style={{
                      backgroundColor: '#FFFFFF', 
                      border: '1px solid #CCC5B6', 
                      borderRadius: '6px', 
                      padding: '0.25rem 0.6rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      color: '#171817',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <strong>{it.sku_id}</strong> ({it.color}) × <span style={{ color: '#496B58' }}>{it.order_quantity} pcs</span>
                  </span>
                ))}
              </div>
            </div>

            {userRole === 'OWNER' && previewData.total_order_cost !== null && previewData.total_order_cost !== undefined && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.6875rem', color: '#52504B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Batch Order Cost
                </span>
                <span className="pj-unit-cost" style={{ fontSize: '1.5rem', color: '#7A6438' }}>
                  {previewData.total_order_cost?.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Insufficient Alert (Blocks Entire Batch) */}
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
                <span>ORDER BATCH BLOCKED: Insufficient Combined Raw Material Stock</span>
              </div>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
                {previewData.shortages.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
              <span style={{ fontStyle: 'italic', marginTop: '0.25rem' }}>
                Please restock the required raw materials in the Raw Materials section before placing this batch order.
              </span>
            </div>
          )}

          {/* Combined Raw Materials Table (Aggregated across all jewelry items) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#806B3F', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers style={{ width: 14, height: 14 }} /> Combined Raw Material Deductions ({previewData.materials_required.length} materials)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#52504B' }}>
                Aggregated for all {previewData.items?.length || 1} items
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #CCC5B6', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B' }}>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Raw Material</th>
                    <th style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>Total Required Units</th>
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
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #CCC5B6', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button 
              onClick={() => setPreviewData(null)} 
              className="pj-action-btn-ghost" 
              style={{ border: '1px solid #CCC5B6', padding: '0.5rem 1rem' }}
            >
              Modify Batch Items
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleReset} className="pj-action-btn-ghost" style={{ border: '1px solid #CCC5B6', padding: '0.5rem 1rem' }}>
                Cancel & Clear
              </button>
              <button
                onClick={handleProcessOrder}
                disabled={!previewData.is_executable || loadingProcess}
                className="pj-action-btn-restock"
                style={{
                  opacity: !previewData.is_executable ? 0.5 : 1,
                  cursor: !previewData.is_executable ? 'not-allowed' : 'pointer',
                  padding: '0.625rem 1.5rem',
                  fontSize: '0.875rem'
                }}
              >
                {loadingProcess ? (
                  <RefreshCw style={{ width: 16, height: 16 }} className="animate-spin" />
                ) : (
                  `Confirm & Deduct Stock (${orderItems.length} items)`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Result View ── */}
      {successResult && (() => {
        const materials = successResult.materials_used || successResult.materials_summary || [];
        const itemsProcessed = successResult.items_processed || [];
        const batchId = successResult.batch_id || successResult.order_transaction_id || successResult.id || 'N/A';

        return (
          <div className="pj-stat-card animate-fadeIn" style={{ padding: '1.5rem', borderLeft: '4px solid #496B58', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle style={{ width: 28, height: 28, color: '#496B58' }} />
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#496B58', margin: 0 }}>
                  Batch Order Executed Successfully!
                </h3>
                <span style={{ fontSize: '0.8125rem', color: '#52504B' }}>
                  Batch ID: <strong>{batchId}</strong> · {itemsProcessed.length || orderItems.length} Jewelry Items Deducted
                </span>
              </div>
            </div>

            {/* Processed Jewelry Items Pills */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B', display: 'block', marginBottom: '0.35rem' }}>
                Jewelry Ordered in this Batch:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {itemsProcessed.map((it, i) => (
                  <span key={i} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {it.sku_id} ({it.color}) × {it.order_quantity} pcs
                  </span>
                ))}
              </div>
            </div>

            {userRole === 'OWNER' && successResult.total_order_cost !== null && successResult.total_order_cost !== undefined && (
              <div style={{ backgroundColor: '#E0D9CB', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', border: '1px solid #CCC5B6' }}>
                <span style={{ fontWeight: 600, color: '#52504B' }}>Total Batch Order Cost:</span>
                <span className="pj-unit-cost" style={{ fontSize: '1.25rem', color: '#7A6438' }}>{successResult.total_order_cost?.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B' }}>
                Combined Raw Material Deductions:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {materials.map((mat, i) => {
                  const pInfo = lastPreviewMaterials.find(m => m.name === mat.name && m.color === mat.color) || {};
                  const qtyPerPkt = mat.quantity_per_packet || pInfo.quantity_per_packet || 1;
                  const unitsUsed = mat.units_used || mat.units_required || 0;
                  const packetsNeededStr = formatPacketsNeeded(unitsUsed, qtyPerPkt);

                  return (
                    <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ fontWeight: 700, color: '#171817' }}>{mat.name} ({mat.color})</div>
                      <div style={{ color: '#496B58', fontWeight: 700 }}>Deducted: {mat.units_used} units</div>
                      <div style={{ color: '#806B3F', fontWeight: 600, fontSize: '0.75rem' }}>
                        Packets Needed: <strong>{packetsNeededStr}</strong>
                      </div>
                      {mat.stock_before && mat.stock_after && (
                        <div style={{ fontSize: '0.75rem', color: '#52504B', borderTop: '1px solid #CCC5B6', paddingTop: '0.25rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Before: {mat.stock_before.packets} pkts ({mat.stock_before.loose} loose)</span>
                          <ArrowRight style={{ width: 12, height: 12 }} />
                          <span style={{ fontWeight: 700, color: '#171817' }}>After: {mat.stock_after.packets} pkts ({mat.stock_after.loose} loose)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', paddingTop: '0.5rem' }}>
              <button
                onClick={handleDownloadPDF}
                className="pj-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  backgroundColor: '#A88A52'
                }}
              >
                <FileText style={{ width: 16, height: 16 }} />
                <span>Download Order Receipt (PDF)</span>
              </button>

              <button onClick={handleReset} className="pj-btn-add">
                Place Next Batch Order
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
