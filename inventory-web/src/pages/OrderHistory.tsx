import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { OrderTransaction, UserRole, MaterialUsageSnapshot } from '../types';
import { 
  History, Search, RefreshCw, Layers, ChevronDown, ChevronUp, 
  Package, FileText 
} from 'lucide-react';
import jsPDF from 'jspdf';

interface OrderHistoryProps {
  userRole: UserRole;
}

export interface GroupedBatchOrder {
  orderNumber: number;
  batchId: string;
  createdAt: string;
  placedByRole: UserRole;
  totalOrderCost: number | null;
  totalQuantity: number;
  jewelryItems: { sku_id: string; color: string; order_quantity: number }[];
  materialsDeducted: MaterialUsageSnapshot[];
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ userRole }) => {
  const [groupedOrders, setGroupedOrders] = useState<GroupedBatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchSku, setSearchSku] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch history records (fetching up to 200 to group batches properly)
      const res = await api.get('/orders/history', { params: { limit: 200 } });
      const rawTransactions: OrderTransaction[] = res.data || [];

      // Group by batch_id or fallback to tx.id
      const batchMap = new Map<string, {
        batchId: string;
        createdAt: string;
        placedByRole: UserRole;
        totalOrderCost: number | null;
        jewelryItems: { sku_id: string; color: string; order_quantity: number }[];
        materialsMap: Map<string, MaterialUsageSnapshot>;
      }>();

      rawTransactions.forEach((tx) => {
        const key = tx.batch_id || tx.id;
        if (!batchMap.has(key)) {
          batchMap.set(key, {
            batchId: key,
            createdAt: tx.created_at,
            placedByRole: tx.placed_by_role,
            totalOrderCost: tx.total_order_cost !== undefined ? tx.total_order_cost : null,
            jewelryItems: [],
            materialsMap: new Map()
          });
        }

        const group = batchMap.get(key)!;
        group.jewelryItems.push({
          sku_id: tx.sku_id,
          color: tx.color,
          order_quantity: tx.order_quantity
        });

        // Collect material usage snapshots
        if (Array.isArray(tx.materials_summary)) {
          tx.materials_summary.forEach((mat) => {
            const matKey = `${mat.name}_${mat.color}`;
            if (!group.materialsMap.has(matKey)) {
              group.materialsMap.set(matKey, mat);
            }
          });
        }
      });

      // Sort groups chronologically (oldest first to assign sequential Order #1, #2, #3...)
      const sortedAsc = Array.from(batchMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const numbered: GroupedBatchOrder[] = sortedAsc.map((g, idx) => ({
        orderNumber: idx + 1,
        batchId: g.batchId,
        createdAt: g.createdAt,
        placedByRole: g.placedByRole,
        totalOrderCost: g.totalOrderCost,
        totalQuantity: g.jewelryItems.reduce((acc, it) => acc + (it.order_quantity || 0), 0),
        jewelryItems: g.jewelryItems,
        materialsDeducted: Array.from(g.materialsMap.values())
      }));

      // Reverse so newest order appears at the top
      setGroupedOrders(numbered.reverse());
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Filter grouped orders based on searchSku query
  const filteredOrders = groupedOrders.filter((order) => {
    if (!searchSku.trim()) return true;
    const q = searchSku.toLowerCase().trim();
    // Match against any jewelry SKU or color in the batch
    const hasJewelryMatch = order.jewelryItems.some(
      (j) => j.sku_id.toLowerCase().includes(q) || j.color.toLowerCase().includes(q)
    );
    // Or match against order number e.g. "10" or "#10"
    const hasOrderNumMatch = `order #${order.orderNumber}`.includes(q) || `${order.orderNumber}` === q;
    return hasJewelryMatch || hasOrderNumMatch;
  });

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="pj-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <History style={{ width: 24, height: 24, color: '#A88A52' }} /> Order Transaction History
          </h1>
          <p className="pj-header-subtitle">
            Audit ledger · Batch grouped order records with sequential order numbering and complete stock deduction logs
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="pj-action-btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem' }}
          title="Refresh transaction history"
        >
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          <span style={{ fontSize: '0.875rem' }}>Refresh</span>
        </button>
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
            placeholder="Filter by SKU ID (e.g. JW-102), Color, or Order #…"
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
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Loading and grouping audit history…</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #CCC5B6',
          borderRadius: '14px',
          padding: '3rem 1rem',
          textAlign: 'center',
        }}>
          <History style={{ width: 40, height: 40, color: '#CCC5B6', margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', color: '#171817' }}>
            {searchSku ? 'No Matching Orders Found' : 'No Order Transactions Found'}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#52504B', marginTop: '0.25rem' }}>
            {searchSku ? 'Try searching by a different SKU or clearing the filter.' : 'Placed orders will automatically be recorded here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredOrders.map((order) => (
            <BatchOrderCard key={order.batchId} order={order} userRole={userRole} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Grouped Batch Order Card ─── */

interface BatchOrderCardProps {
  order: GroupedBatchOrder;
  userRole: UserRole;
}

const BatchOrderCard: React.FC<BatchOrderCardProps> = ({ order, userRole }) => {
  const [expanded, setExpanded] = useState(false);

  // Helper to format packets needed string
  const formatPackets = (units: number, qtyPerPacket: number = 1) => {
    const qpp = qtyPerPacket || 1;
    const pkts = Math.floor(units / qpp);
    const loose = units % qpp;
    if (pkts > 0) {
      return `${pkts} pkts${loose > 0 ? ` (${loose} loose)` : ''}`;
    }
    return `${loose} loose`;
  };

  const handleDownloadPDF = (e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = new jsPDF();
    const nowStr = new Date(order.createdAt).toLocaleString();
    const batchId = order.batchId || 'N/A';
    const items = order.jewelryItems;
    const materials = order.materialsDeducted;

    // ── Header Section ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(168, 138, 82); // Champagne Gold #A88A52
    doc.text('Luxe Craft', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(82, 80, 75);
    doc.text(`BATCH ORDER RECEIPT — ORDER #${order.orderNumber}`, 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Order Date: ${nowStr} | Placed By: ${order.placedByRole}`, 14, 31);
    doc.text(`Batch Reference ID: ${batchId}`, 14, 36);

    doc.setDrawColor(204, 197, 182);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    let y = 48;

    // ── Section 1: Ordered Jewelry Items ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 24, 23);
    doc.text(`1. Ordered Jewelry Items (${items.length} items, ${order.totalQuantity} total pieces)`, 14, y);

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
    if (userRole === 'OWNER' && order.totalOrderCost !== null && order.totalOrderCost !== undefined) {
      y += 2;
      doc.setFillColor(224, 217, 203);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(122, 100, 56);
      doc.text('Total Batch Order Cost:', 16, y + 1);
      doc.text(`${order.totalOrderCost.toFixed(2)}`, 160, y + 1);
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

      const qtyPerPkt = mat.quantity_per_packet || 1;
      const unitsUsed = mat.units_used || 0;
      const packetsNeededStr = formatPackets(unitsUsed, qtyPerPkt);

      const matName = `${mat.name} (${mat.color})`;
      const beforeStr = mat.stock_before ? `${mat.stock_before.packets}p (${mat.stock_before.loose}l)` : '-';
      const afterStr = mat.stock_after ? `${mat.stock_after.packets}p (${mat.stock_after.loose}l)` : '-';

      if (isOwner) {
        doc.text(matName, 16, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(73, 107, 88);
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
        doc.text(mat.line_cost !== null && mat.line_cost !== undefined ? mat.line_cost.toFixed(2) : '-', 172, y);
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
    doc.save(`Order_Receipt_${order.orderNumber}_${cleanBatch}.pdf`);
  };

  return (
    <article
      className="pj-material-card"
      style={{ cursor: 'pointer', padding: '1.25rem' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          {/* Header Row with Sequential Order # and Items Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <span style={{
              backgroundColor: '#A88A52',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.8125rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              letterSpacing: '0.04em'
            }}>
              Order #{order.orderNumber}
            </span>

            {/* Jewelry items tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {order.jewelryItems.map((item, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: '#EFE9DC',
                    border: '1px solid #CCC5B6',
                    color: '#171817',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <span>{item.sku_id}</span>
                  <span style={{ fontWeight: 400, color: '#666' }}>({item.color})</span>
                  <span style={{ color: '#496B58' }}>× {item.order_quantity}</span>
                </span>
              ))}
            </div>
          </div>

          <span style={{ fontSize: '0.8125rem', color: '#52504B', display: 'block', marginTop: '0.25rem' }}>
            Total Quantity: <strong>{order.totalQuantity} units</strong> ({order.jewelryItems.length} jewelry {order.jewelryItems.length === 1 ? 'item' : 'items'}) · Placed by: <strong style={{ textTransform: 'uppercase', color: '#7A6438' }}>{order.placedByRole}</strong>
          </span>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#52504B', display: 'block' }}>
              {new Date(order.createdAt).toLocaleString()}
            </span>
            {userRole === 'OWNER' && order.totalOrderCost !== null && (
              <span className="pj-unit-cost" style={{ fontSize: '1.25rem', color: '#7A6438' }}>
                {order.totalOrderCost?.toFixed(2)}
              </span>
            )}
          </div>

          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52504B', padding: '0.25rem' }}
            aria-label={expanded ? 'Collapse order' : 'Expand order'}
          >
            {expanded ? <ChevronUp style={{ width: 18, height: 18 }} /> : <ChevronDown style={{ width: 18, height: 18 }} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="animate-fadeIn" style={{ marginTop: '1rem' }} onClick={(e) => e.stopPropagation()}>
          <hr className="pj-divider" />

          {/* Section 1: Jewelry Items Breakdown */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <Package style={{ width: 13, height: 13 }} /> Ordered Jewelry in this Batch:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {order.jewelryItems.map((j, idx) => (
                <div key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCC5B6', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 700, color: '#171817' }}>{j.sku_id}</div>
                  <div style={{ fontSize: '0.75rem', color: '#52504B' }}>Color: <strong>{j.color}</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#496B58', fontWeight: 700 }}>Ordered: {j.order_quantity} pieces</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Materials Deducted */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#806B3F', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Layers style={{ width: 13, height: 13 }} /> Combined Raw Materials Deducted:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {order.materialsDeducted.map((mat, idx) => {
                const qtyPerPkt = mat.quantity_per_packet || 1;
                const units = mat.units_used || 0;
                const packetsNeededStr = formatPackets(units, qtyPerPkt);

                return (
                  <div key={idx} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ fontWeight: 700, color: '#171817' }}>{mat.name} ({mat.color})</div>
                    <div style={{ color: '#496B58', fontWeight: 700 }}>Deducted: {mat.units_used} units</div>
                    <div style={{ color: '#806B3F', fontWeight: 600, fontSize: '0.75rem' }}>
                      Packets Needed: <strong>{packetsNeededStr}</strong>
                    </div>
                    {mat.stock_before && mat.stock_after && (
                      <div style={{ fontSize: '0.75rem', color: '#52504B', borderTop: '1px solid #CCC5B6', paddingTop: '0.35rem', marginTop: '0.25rem' }}>
                        Before: {mat.stock_before.packets} pkts ({mat.stock_before.loose} loose) <br />
                        After: <strong>{mat.stock_after.packets} pkts ({mat.stock_after.loose} loose)</strong>
                      </div>
                    )}
                    {userRole === 'OWNER' && mat.line_cost !== null && mat.line_cost !== undefined && (
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#7A6438', marginTop: '0.25rem' }}>
                        Cost: {mat.line_cost?.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #CCC5B6' }}>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              Batch Reference: <code>{order.batchId}</code>
            </span>

            <button
              onClick={handleDownloadPDF}
              className="pj-action-btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.75rem' }}
            >
              <FileText style={{ width: 14, height: 14 }} />
              <span>Download Receipt (PDF)</span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
