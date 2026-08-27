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
    doc.setTextColor(212, 175, 55); // Gold tone
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--color-accent)]" />
            <span>Insights & Financial Analytics</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Owner exclusive financial summary, raw material consumption, and PDF report export.
          </p>
        </div>

        <button onClick={handleExportPDF} disabled={!summary} className="btn-primary">
          <Download className="w-4 h-4" /> Download PDF Report
        </button>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Select Timeframe:</span>
          <div className="flex bg-[var(--color-paper)] p-1 rounded-lg border border-[var(--color-border)]">
            {(['7d', '30d', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  period === p ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {p === '7d' ? 'Past 7 Days' : p === '30d' ? 'Past 30 Days' : 'Custom Range'}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field py-1 text-xs"
            />
            <span className="text-xs text-[var(--color-text-muted)]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field py-1 text-xs"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      ) : summary && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-5 rounded-xl">
              <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">Total Orders Placed</span>
              <p className="text-3xl font-bold text-white mt-1">{summary.total_orders_placed}</p>
            </div>
            <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-5 rounded-xl">
              <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">Total Recorded Cost</span>
              <p className="text-3xl font-bold text-[var(--color-accent)] mt-1">${summary.total_order_cost.toFixed(2)}</p>
            </div>
            <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-5 rounded-xl">
              <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">Raw Materials Consumed</span>
              <p className="text-3xl font-bold text-green-400 mt-1">{summary.raw_material_summary_count} types</p>
            </div>
          </div>

          {/* Recharts Bar Chart: Top Raw Materials Consumed */}
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--color-accent)]" /> Top Consumed Raw Materials (Units)
            </h3>
            {summary.top_materials_used.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">No raw material consumption data recorded for this timeframe.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.top_materials_used}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-paper-card)', borderColor: 'var(--color-border)' }}
                      itemStyle={{ color: 'var(--color-accent)' }}
                    />
                    <Bar dataKey="total_units_used" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Consumed Materials Breakdown List */}
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-lg">Detailed Raw Material Consumption Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase">
                    <th className="py-2 px-2">Material Name</th>
                    <th className="py-2 px-2">Color</th>
                    <th className="py-2 px-2 text-center">Units Consumed</th>
                    <th className="py-2 px-2 text-right">Total Line Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {summary.top_materials_used.map((mat, idx) => (
                    <tr key={idx} className="hover:bg-[var(--color-paper-card-hover)]">
                      <td className="py-2.5 px-2 font-semibold text-white">{mat.name}</td>
                      <td className="py-2.5 px-2 text-[var(--color-text-muted)]">{mat.color}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-[var(--color-accent)]">{mat.total_units_used} units</td>
                      <td className="py-2.5 px-2 text-right font-medium text-green-400">${mat.total_line_cost.toFixed(2)}</td>
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
