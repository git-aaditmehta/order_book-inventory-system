import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../types';
import { 
  Database, Download, FileSpreadsheet, RefreshCw, CheckCircle2, 
  Layers, Package, Gem, History, ShieldAlert, Sparkles 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface BackupProps {
  userRole: UserRole;
}

interface BackupSummary {
  raw_materials_count: number;
  raw_materials_active: number;
  raw_materials_valuation: number;
  jewelry_count: number;
  jewelry_active: number;
  recipes_count: number;
  orders_count: number;
  total_orders_cost: number;
}

export const Backup: React.FC<BackupProps> = ({ userRole }) => {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get('/backup/summary');
      setSummary(res.data);
    } catch (err: any) {
      console.error('Failed to load backup summary:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to connect to Supabase database for backup metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const getTimestamp = () => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  };

  // Helper to auto-fit worksheet column widths based on content
  const autoFitColumns = (worksheet: XLSX.WorkSheet, data: any[]) => {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const colWidths = keys.map(key => {
      let maxLen = key.toString().length;
      data.forEach(row => {
        const val = row[key];
        if (val !== undefined && val !== null) {
          const len = val.toString().length;
          if (len > maxLen) maxLen = len;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
    });
    worksheet['!cols'] = colWidths;
  };

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
  };

  // 1. Download Master Backup (All 3 tables + metadata in 1 Excel workbook)
  const handleDownloadMasterBackup = async () => {
    setExporting('all');
    setErrorMessage(null);
    try {
      const res = await api.get('/backup/data');
      const data = res.data;
      const wb = XLSX.utils.book_new();

      // Sheet 1: Metadata Summary
      const metaData = [
        { Parameter: 'Backup Generation Time', Value: new Date().toLocaleString() },
        { Parameter: 'Authorized Role', Value: userRole },
        { Parameter: 'Database Engine', Value: 'Supabase PostgreSQL' },
        { Parameter: 'Total Raw Materials Count', Value: data.raw_materials.length },
        { Parameter: 'Total Raw Materials Inventory Valuation', Value: summary?.raw_materials_valuation ?? 0 },
        { Parameter: 'Total Jewelry Models Count', Value: data.jewelry.length },
        { Parameter: 'Total BOM Recipe Relations', Value: data.jewelry_recipes_flattened.length },
        { Parameter: 'Total Order History Ledger Records', Value: data.order_transactions.length },
        { Parameter: 'Total Recorded Order Volume Value', Value: summary?.total_orders_cost ?? 0 }
      ];
      const wsMeta = XLSX.utils.json_to_sheet(metaData);
      autoFitColumns(wsMeta, metaData);
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Backup Overview');

      // Sheet 2: Raw Materials Table
      const rmFormatted = data.raw_materials.map((r: any) => ({
        'Material ID': r.id,
        'Material Name': r.name,
        'Color': r.color,
        'Packets In Stock': r.packets,
        'Units Per Packet': r.quantity_per_packet,
        'Loose Units': r.loose_units,
        'Total Available Units': r.total_units,
        'Unit Cost': r.cost_per_unit,
        'Total Valuation': r.total_valuation,
        'Status': r.status,
        'Created At': r.created_at,
        'Last Updated': r.updated_at
      }));
      const wsRM = XLSX.utils.json_to_sheet(rmFormatted);
      autoFitColumns(wsRM, rmFormatted);
      XLSX.utils.book_append_sheet(wb, wsRM, 'Raw Materials');

      // Sheet 3: Jewelry Catalog & BOM Recipes
      const jewelryFormatted = data.jewelry.map((j: any) => ({
        'Jewelry ID': j.id,
        'SKU ID': j.sku_id,
        'Color': j.color,
        'Weight Before (g)': j.weight_before,
        'Weight After (g)': j.weight_after,
        'BOM Components Count': j.recipe_count,
        'Total Recipe Cost': j.total_recipe_cost,
        'Status': j.status,
        'Created At': j.created_at
      }));
      const wsJewelry = XLSX.utils.json_to_sheet(jewelryFormatted);
      autoFitColumns(wsJewelry, jewelryFormatted);
      XLSX.utils.book_append_sheet(wb, wsJewelry, 'Jewelry Catalog');

      // Sheet 4: Flattened BOM Recipes
      const recipesFormatted = data.jewelry_recipes_flattened.map((rf: any) => ({
        'Jewelry SKU': rf.jewelry_sku_id,
        'Jewelry Color': rf.jewelry_color,
        'Weight Before (g)': rf.jewelry_weight_before,
        'Weight After (g)': rf.jewelry_weight_after,
        'Required Raw Material': rf.raw_material_name,
        'Material Color': rf.raw_material_color,
        'Units Required Per Piece': rf.required_quantity_per_piece,
        'Material Unit Cost': rf.material_cost_per_unit,
        'Component Line Cost': rf.recipe_line_cost,
        'Jewelry Status': rf.is_archived,
        'Created At': rf.created_at
      }));
      const wsRecipes = XLSX.utils.json_to_sheet(recipesFormatted);
      autoFitColumns(wsRecipes, recipesFormatted);
      XLSX.utils.book_append_sheet(wb, wsRecipes, 'Jewelry BOM Recipes');

      // Sheet 5: Orders Ledger
      const ordersFormatted = data.order_transactions.map((o: any) => ({
        'Transaction ID': o.id,
        'Batch ID': o.batch_id,
        'Order Date & Time': o.created_at,
        'Jewelry SKU': o.sku_id,
        'Color': o.color,
        'Order Quantity': o.order_quantity,
        'Total Recorded Cost': o.total_order_cost,
        'Placed By Role': o.placed_by_role,
        'Placed By User ID': o.placed_by_user_id,
        'Deducted Materials Summary': o.materials_summary_text
      }));
      const wsOrders = XLSX.utils.json_to_sheet(ordersFormatted);
      autoFitColumns(wsOrders, ordersFormatted);
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders History Ledger');

      // Write and trigger download
      const filename = `Luxe_Craft_Full_Database_Backup_${getTimestamp()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification(`Successfully exported master backup: ${filename}`);
    } catch (err: any) {
      console.error('Failed to export full backup:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to export master Excel backup.');
    } finally {
      setExporting(null);
    }
  };

  // 2. Download Raw Materials Table
  const handleDownloadRawMaterials = async () => {
    setExporting('raw_materials');
    setErrorMessage(null);
    try {
      const res = await api.get('/backup/data');
      const data = res.data.raw_materials;
      const wb = XLSX.utils.book_new();

      const formatted = data.map((r: any) => ({
        'Material ID': r.id,
        'Material Name': r.name,
        'Color': r.color,
        'Packets In Stock': r.packets,
        'Units Per Packet': r.quantity_per_packet,
        'Loose Units': r.loose_units,
        'Total Available Units': r.total_units,
        'Unit Cost': r.cost_per_unit,
        'Total Valuation': r.total_valuation,
        'Status': r.status,
        'Created At': r.created_at,
        'Last Updated': r.updated_at
      }));

      const ws = XLSX.utils.json_to_sheet(formatted);
      autoFitColumns(ws, formatted);
      XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');

      const filename = `Raw_Materials_Backup_${getTimestamp()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification(`Raw materials exported: ${filename}`);
    } catch (err: any) {
      console.error('Failed to export raw materials:', err);
      setErrorMessage('Failed to export raw materials table.');
    } finally {
      setExporting(null);
    }
  };

  // 3. Download Jewelry with BOM Recipes
  const handleDownloadJewelryRecipes = async () => {
    setExporting('jewelry');
    setErrorMessage(null);
    try {
      const res = await api.get('/backup/data');
      const wb = XLSX.utils.book_new();

      const jFormatted = res.data.jewelry.map((j: any) => ({
        'Jewelry ID': j.id,
        'SKU ID': j.sku_id,
        'Color': j.color,
        'Weight Before (g)': j.weight_before,
        'Weight After (g)': j.weight_after,
        'BOM Components Count': j.recipe_count,
        'Total Calculated Unit Cost': j.total_recipe_cost,
        'Status': j.status,
        'Created At': j.created_at
      }));
      const wsJ = XLSX.utils.json_to_sheet(jFormatted);
      autoFitColumns(wsJ, jFormatted);
      XLSX.utils.book_append_sheet(wb, wsJ, 'Jewelry Catalog');

      const rFormatted = res.data.jewelry_recipes_flattened.map((rf: any) => ({
        'Jewelry SKU': rf.jewelry_sku_id,
        'Jewelry Color': rf.jewelry_color,
        'Weight Before (g)': rf.jewelry_weight_before,
        'Weight After (g)': rf.jewelry_weight_after,
        'Required Raw Material': rf.raw_material_name,
        'Material Color': rf.raw_material_color,
        'Units Required Per Piece': rf.required_quantity_per_piece,
        'Material Unit Cost': rf.material_cost_per_unit,
        'Component Line Cost': rf.recipe_line_cost,
        'Jewelry Status': rf.is_archived,
        'Created At': rf.created_at
      }));
      const wsR = XLSX.utils.json_to_sheet(rFormatted);
      autoFitColumns(wsR, rFormatted);
      XLSX.utils.book_append_sheet(wb, wsR, 'BOM Recipes Breakdown');

      const filename = `Jewelry_and_Recipes_Backup_${getTimestamp()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification(`Jewelry & recipes exported: ${filename}`);
    } catch (err: any) {
      console.error('Failed to export jewelry recipes:', err);
      setErrorMessage('Failed to export jewelry and recipes tables.');
    } finally {
      setExporting(null);
    }
  };

  // 4. Download Orders History Ledger
  const handleDownloadOrders = async () => {
    setExporting('orders');
    setErrorMessage(null);
    try {
      const res = await api.get('/backup/data');
      const data = res.data.order_transactions;
      const wb = XLSX.utils.book_new();

      const formatted = data.map((o: any) => ({
        'Transaction ID': o.id,
        'Batch ID': o.batch_id,
        'Order Date & Time': o.created_at,
        'Jewelry SKU': o.sku_id,
        'Color': o.color,
        'Order Quantity': o.order_quantity,
        'Total Recorded Cost': o.total_order_cost,
        'Placed By Role': o.placed_by_role,
        'Placed By User ID': o.placed_by_user_id,
        'Deducted Materials Breakdown': o.materials_summary_text
      }));

      const ws = XLSX.utils.json_to_sheet(formatted);
      autoFitColumns(ws, formatted);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders Ledger');

      const filename = `Orders_Ledger_Backup_${getTimestamp()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification(`Orders data exported: ${filename}`);
    } catch (err: any) {
      console.error('Failed to export orders:', err);
      setErrorMessage('Failed to export orders ledger table.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="pj-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Database style={{ width: 26, height: 26, color: '#A88A52' }} /> Database Backup & Data Export
          </h1>
          <p className="pj-header-subtitle">
            Export production inventory, BOM recipes, and order ledger tables from Supabase into Excel (.xlsx) spreadsheets
          </p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="pj-action-btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem' }}
          title="Refresh database statistics"
        >
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          <span style={{ fontSize: '0.875rem' }}>Refresh Stats</span>
        </button>
      </div>

      {/* ── Feedback Banners ── */}
      {successMessage && (
        <div style={{
          backgroundColor: '#E5EFEA',
          border: '1px solid #B8D6C6',
          borderRadius: '8px',
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#284E3A',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          <CheckCircle2 style={{ width: 20, height: 20, flexShrink: 0, color: '#496B58' }} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{
          backgroundColor: '#FDE8E8',
          border: '1px solid #F8B4B4',
          borderRadius: '8px',
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#9B1C1C',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          <ShieldAlert style={{ width: 20, height: 20, flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Metric Summary Cards ── */}
      {loading && !summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Reading database tables telemetry…</span>
        </div>
      ) : summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="pj-stat-card">
              <span className="pj-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Package style={{ width: 14, height: 14, color: '#7A6438' }} /> Raw Materials
              </span>
              <p className="pj-stat-number">{summary.raw_materials_count}</p>
              <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
                {summary.raw_materials_active} active in catalog
              </span>
            </div>

            <div className="pj-stat-card">
              <span className="pj-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Gem style={{ width: 14, height: 14, color: '#7A6438' }} /> Jewelry & Recipes
              </span>
              <p className="pj-stat-number">{summary.jewelry_count}</p>
              <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
                {summary.recipes_count} BOM component links
              </span>
            </div>

            <div className="pj-stat-card">
              <span className="pj-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <History style={{ width: 14, height: 14, color: '#7A6438' }} /> Orders Ledger
              </span>
              <p className="pj-stat-number">{summary.orders_count}</p>
              <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
                Total recorded transactions
              </span>
            </div>

            <div className="pj-stat-card">
              <span className="pj-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles style={{ width: 14, height: 14, color: '#7A6438' }} /> Raw Material Valuation
              </span>
              <p className="pj-stat-number" style={{ color: '#7A6438' }}>
                {summary.raw_materials_valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
                Total stock asset value
              </span>
            </div>
          </div>

          {/* ── Featured Master Backup Card ── */}
          <div style={{
            background: 'linear-gradient(135deg, #FBF8F2 0%, #EFE9DC 100%)',
            border: '2px solid #D0C3AA',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{
                    backgroundColor: '#A88A52',
                    color: '#FFF',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}>
                    Recommended
                  </span>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#171817' }}>
                    Complete Master System Backup (.xlsx)
                  </h2>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#52504B', maxWidth: '750px', lineHeight: 1.45 }}>
                  Downloads a multi-worksheet Excel spreadsheet compiling all tables: <strong>Raw Materials</strong>, <strong>Jewelry Catalog</strong>, <strong>BOM Recipes</strong>, and the complete <strong>Order Ledger</strong> with timestamps and financial calculations.
                </p>
              </div>

              <button
                onClick={handleDownloadMasterBackup}
                disabled={exporting !== null}
                className="pj-btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {exporting === 'all' ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Compiling All Sheets…</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet style={{ width: 20, height: 20 }} />
                    <span>Download All Tables (.xlsx)</span>
                  </>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #E0D6C3' }}>
              <span style={{ fontSize: '0.75rem', color: '#7A6438', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 style={{ width: 14, height: 14 }} /> 4 Formatted Worksheets
              </span>
              <span style={{ fontSize: '0.75rem', color: '#7A6438', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 style={{ width: 14, height: 14 }} /> Auto-fitted column widths
              </span>
              <span style={{ fontSize: '0.75rem', color: '#7A6438', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 style={{ width: 14, height: 14 }} /> Supabase PostgreSQL live dump
              </span>
            </div>
          </div>

          {/* ── Individual Table Downloads Section ── */}
          <div className="space-y-4">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#171817', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers style={{ width: 20, height: 20, color: '#A88A52' }} /> Individual Table Downloads
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              
              {/* Card 1: Raw Materials */}
              <div className="pj-stat-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Package style={{ width: 20, height: 20, color: '#A88A52' }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#171817' }}>Raw Materials</h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7A6438', backgroundColor: '#EFE9DC', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {summary.raw_materials_count} Rows
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#52504B', lineHeight: 1.4 }}>
                    Stock levels (packets & loose units), quantity per packet, unit cost, inventory asset valuation, and archive statuses.
                  </p>
                </div>

                <button
                  onClick={handleDownloadRawMaterials}
                  disabled={exporting !== null}
                  className="pj-action-btn-ghost"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem',
                    fontWeight: 700,
                    borderRadius: '8px'
                  }}
                >
                  {exporting === 'raw_materials' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Exporting…</span>
                    </>
                  ) : (
                    <>
                      <Download style={{ width: 16, height: 16 }} />
                      <span>Download Raw Materials (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Card 2: Jewelry & Recipes */}
              <div className="pj-stat-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Gem style={{ width: 20, height: 20, color: '#A88A52' }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#171817' }}>Jewelry & BOM Recipes</h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7A6438', backgroundColor: '#EFE9DC', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {summary.jewelry_count} Models
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#52504B', lineHeight: 1.4 }}>
                    SKU IDs, color variants, weights before/after, full bill-of-materials recipe breakdowns, component costs, and calculated unit totals.
                  </p>
                </div>

                <button
                  onClick={handleDownloadJewelryRecipes}
                  disabled={exporting !== null}
                  className="pj-action-btn-ghost"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem',
                    fontWeight: 700,
                    borderRadius: '8px'
                  }}
                >
                  {exporting === 'jewelry' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Exporting…</span>
                    </>
                  ) : (
                    <>
                      <Download style={{ width: 16, height: 16 }} />
                      <span>Download Jewelry & Recipes (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Card 3: Orders History */}
              <div className="pj-stat-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <History style={{ width: 20, height: 20, color: '#A88A52' }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#171817' }}>Orders Ledger</h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7A6438', backgroundColor: '#EFE9DC', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {summary.orders_count} Orders
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#52504B', lineHeight: 1.4 }}>
                    Complete audit trail of placed batch orders, item quantities, timestamped atomic stock deductions, and recorded costs.
                  </p>
                </div>

                <button
                  onClick={handleDownloadOrders}
                  disabled={exporting !== null}
                  className="pj-action-btn-ghost"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem',
                    fontWeight: 700,
                    borderRadius: '8px'
                  }}
                >
                  {exporting === 'orders' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Exporting…</span>
                    </>
                  ) : (
                    <>
                      <Download style={{ width: 16, height: 16 }} />
                      <span>Download Orders Ledger (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
};
