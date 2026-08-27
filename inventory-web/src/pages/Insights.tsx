import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { InsightsSummary, UserRole } from '../types';
import { BarChart3, Download, Calendar, RefreshCw, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';

interface InsightsProps {
  userRole: UserRole;
}

export const Insights: React.FC<InsightsProps> = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | 'custom'>('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const params: any = { period };
      if (period === 'custom') {
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }
      const res = await api.get('/insights/summary', { params });
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load insights summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [period, startDate, endDate]);

  const handleExportPDF = () => {
    if (!summary) return;

    const doc = new jsPDF();
    const nowStr = new Date().toLocaleString();

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(168, 138, 82); // Champagne Gold
    doc.text('Luxe Craft Inventory Summary Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Report Period: ${summary.period.toUpperCase()} | Generated: ${nowStr}`, 14, 28);
    doc.text(`Authorized Owner: Financial & Stock Audit Log`, 14, 34);

    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 38, 196, 38);

    // Summary Metrics Table
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Key Performance Indicators', 14, 48);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Orders Placed: ${summary.total_orders_placed}`, 14, 58);
    doc.text(`Total Recorded Cost: $${summary.total_order_cost.toFixed(2)}`, 14, 66);
    doc.text(`Distinct Raw Materials Used: ${summary.raw_material_summary_count}`, 14, 74);

    // Top Raw Materials Used Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Top Raw Materials Consumed', 14, 90);

    let y = 100;
    doc.setFontSize(10);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 6, 182, 8, 'F');
    doc.text('Material Name & Color', 16, y);
    doc.text('Total Units Used', 110, y);
    doc.text('Total Cost', 160, y);

    doc.setFont('helvetica', 'normal');
    summary.top_materials_used.forEach((mat) => {
      y += 10;
      doc.text(`${mat.name} (${mat.color})`, 16, y);
      doc.text(`${mat.total_units_used} units`, 110, y);
      doc.text(`$${mat.total_line_cost.toFixed(2)}`, 160, y);
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    // Save PDF
    doc.save(`Inventory_Report_${summary.period}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="pj-header-title">Insights & Financial Analytics</h1>
          <p className="pj-header-subtitle">
            Owner exclusive analytics · Recorded order cost, raw material consumption, and PDF report export
          </p>
        </div>

        <button onClick={handleExportPDF} disabled={!summary} className="pj-btn-add">
          <Download style={{ width: 16, height: 16 }} /> Download PDF Report
        </button>
      </div>

      {/* ── Period Filter Bar ── */}
      <div className="pj-search-box">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar style={{ width: 18, height: 18, color: '#A88A52' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#171817' }}>Select Timeframe:</span>
            <div style={{ display: 'flex', backgroundColor: '#E0D9CB', padding: '0.25rem', borderRadius: '8px', border: '1px solid #CCC5B6' }}>
              {(['7d', '30d', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: period === p ? '#171817' : 'transparent',
                    color: period === p ? '#FFFFFF' : '#52504B',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p === '7d' ? 'Past 7 Days' : p === '30d' ? 'Past 30 Days' : 'Custom Range'}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pj-input"
                style={{ height: '36px', fontSize: '0.8125rem', paddingLeft: '0.5rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#52504B' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pj-input"
                style={{ height: '36px', fontSize: '0.8125rem', paddingLeft: '0.5rem' }}
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Generating financial insights…</span>
        </div>
      ) : summary && (
        <div className="space-y-6">
          {/* ── KPI Summary Cards ── */}
          <div className="metrics-grid">
            <div className="pj-stat-card">
              <span className="pj-stat-label">Total Orders Placed</span>
              <p className="pj-stat-number">{summary.total_orders_placed}</p>
            </div>
            <div className="pj-stat-card">
              <span className="pj-stat-label">Total Recorded Cost</span>
              <p className="pj-stat-number" style={{ color: '#7A6438' }}>${summary.total_order_cost.toFixed(2)}</p>
            </div>
            <div className="pj-stat-card">
              <span className="pj-stat-label">Raw Materials Consumed</span>
              <p className="pj-stat-number" style={{ color: '#496B58' }}>{summary.raw_material_summary_count} types</p>
            </div>
          </div>

          {/* ── Recharts Bar Chart ── */}
          <div className="pj-stat-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#171817', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers style={{ width: 18, height: 18, color: '#A88A52' }} /> Top Consumed Raw Materials (Units)
            </h3>
            {summary.top_materials_used.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#52504B', padding: '2rem 0', textAlign: 'center' }}>
                No raw material consumption data recorded for this timeframe.
              </p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.top_materials_used}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
                    <XAxis dataKey="name" stroke="#52504B" fontSize={12} tickLine={false} />
                    <YAxis stroke="#52504B" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CCC5B6', borderRadius: '8px', color: '#171817' }}
                      itemStyle={{ color: '#7A6438', fontWeight: 700 }}
                    />
                    <Bar dataKey="total_units_used" fill="#496B58" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Consumption Breakdown Table ── */}
          <div className="pj-stat-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#171817' }}>Detailed Raw Material Consumption Ledger</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #CCC5B6', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52504B' }}>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Material Name</th>
                    <th style={{ padding: '0.625rem 0.5rem' }}>Color</th>
                    <th style={{ padding: '0.625rem 0.5rem', textAlign: 'center' }}>Units Consumed</th>
                    <th style={{ padding: '0.625rem 0.5rem', textAlign: 'right' }}>Total Line Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.top_materials_used.map((mat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #CCC5B6' }}>
                      <td style={{ padding: '0.625rem 0.5rem', fontWeight: 600, color: '#171817' }}>{mat.name}</td>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#52504B' }}>{mat.color}</td>
                      <td style={{ padding: '0.625rem 0.5rem', textAlign: 'center', fontFamily: 'var(--pj-font-mono)', fontWeight: 700, color: '#496B58' }}>
                        {mat.total_units_used} units
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', textAlign: 'right', fontFamily: 'var(--pj-font-mono)', fontWeight: 700, color: '#7A6438' }}>
                        ${mat.total_line_cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
