import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { RawMaterial, UserRole } from '../types';
import { 
  Package, Plus, Search, RefreshCw, Edit2, Trash2, 
  History, X, ChevronDown, ChevronUp 
} from 'lucide-react';

interface RawMaterialsProps {
  userRole: UserRole;
}

export const RawMaterials: React.FC<RawMaterialsProps> = ({ userRole }) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchColor, setSearchColor] = useState('');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  // Form states
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formPackets, setFormPackets] = useState<number | ''>(0);
  const [formQtyPerPacket, setFormQtyPerPacket] = useState<number | ''>(100);
  const [formLooseUnits, setFormLooseUnits] = useState<number | ''>(0);
  const [formCostPerUnit, setFormCostPerUnit] = useState<number | ''>(0);

  // Restock form states
  const [addPackets, setAddPackets] = useState<number | ''>(0);
  const [addLoose, setAddLoose] = useState<number | ''>(0);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchName) params.search = searchName;
      if (searchColor) params.color = searchColor;
      const res = await api.get('/raw-materials', { params });
      setMaterials(res.data);
    } catch (err: any) {
      console.error('Failed to load raw materials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [searchName, searchColor]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/raw-materials', {
        name: formName.trim(),
        color: formColor.trim(),
        packets: Number(formPackets) || 0,
        quantity_per_packet: Number(formQtyPerPacket) || 1,
        loose_units: Number(formLooseUnits) || 0,
        cost_per_unit: Number(formCostPerUnit) || 0
      });
      setAddModalOpen(false);
      resetForm();
      fetchMaterials();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create raw material.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    try {
      await api.put(`/raw-materials/${selectedMaterial.id}`, {
        name: formName.trim(),
        color: formColor.trim(),
        packets: Number(formPackets),
        quantity_per_packet: Number(formQtyPerPacket),
        loose_units: Number(formLooseUnits),
        cost_per_unit: Number(formCostPerUnit)
      });
      setEditModalOpen(false);
      resetForm();
      fetchMaterials();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update raw material.');
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    try {
      await api.post(`/raw-materials/${selectedMaterial.id}/restock`, {
        add_packets: Number(addPackets) || 0,
        add_loose: Number(addLoose) || 0
      });
      setRestockModalOpen(false);
      setAddPackets(0);
      setAddLoose(0);
      fetchMaterials();
    } catch (err: any) {
      alert('Failed to restock raw material.');
    }
  };

  const handleDelete = async (mat: RawMaterial) => {
    if (!confirm(`Archive raw material "${mat.name} (${mat.color})"?`)) return;
    try {
      await api.delete(`/raw-materials/${mat.id}`);
      fetchMaterials();
    } catch (err: any) {
      alert('Failed to delete raw material.');
    }
  };

  const handleOpenHistory = async (mat: RawMaterial) => {
    setSelectedMaterial(mat);
    setHistoryModalOpen(true);
    try {
      const res = await api.get(`/raw-materials/${mat.id}/history`);
      setHistoryLogs(res.data);
    } catch (err: any) {
      setHistoryLogs([]);
    }
  };

  const openEditModal = (mat: RawMaterial) => {
    setSelectedMaterial(mat);
    setFormName(mat.name);
    setFormColor(mat.color);
    setFormPackets(mat.packets);
    setFormQtyPerPacket(mat.quantity_per_packet);
    setFormLooseUnits(mat.loose_units);
    setFormCostPerUnit(mat.cost_per_unit || 0);
    setEditModalOpen(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormColor('');
    setFormPackets(0);
    setFormQtyPerPacket(100);
    setFormLooseUnits(0);
    setFormCostPerUnit(0);
    setSelectedMaterial(null);
  };

  const totalPackets = materials.reduce((acc, m) => acc + m.packets, 0);
  const totalUnits   = materials.reduce((acc, m) => acc + m.total_units, 0);

  /* ────────────────── RENDER ────────────────── */
  return (
    <div className="precision-jewelry-page space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="pj-header-title">Today’s Stock</h1>
          <p className="pj-header-subtitle">
            Raw materials inventory · {materials.length} material{materials.length !== 1 ? 's' : ''}
          </p>
        </div>
        {userRole === 'OWNER' && (
          <button
            id="add-raw-material-btn"
            onClick={() => { resetForm(); setAddModalOpen(true); }}
            className="pj-btn-add"
          >
            <Plus style={{ width: 16, height: 16 }} />
            Add Material
          </button>
        )}
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="stat-grid">
        <div className="pj-stat-card">
          <span className="pj-stat-label">Materials</span>
          <p className="pj-stat-value">{materials.length}</p>
        </div>
        <div className="pj-stat-card">
          <span className="pj-stat-label">Total Packets</span>
          <p className="pj-stat-value pj-stat-value--gold">{totalPackets.toLocaleString()}</p>
        </div>
        <div className="pj-stat-card">
          <span className="pj-stat-label">Available Units</span>
          <p className="pj-stat-value pj-stat-value--green">{totalUnits.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="pj-search-box">
        <div className="search-grid">
          {/* Name Search */}
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              color: '#66645F',
              pointerEvents: 'none',
            }} />
            <input
              id="search-name-input"
              type="text"
              placeholder="Search by material name…"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="pj-input"
            />
          </div>
          {/* Color Filter */}
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              color: '#66645F',
              pointerEvents: 'none',
            }} />
            <input
              id="search-color-input"
              type="text"
              placeholder="Filter by color…"
              value={searchColor}
              onChange={(e) => setSearchColor(e.target.value)}
              className="pj-input"
            />
          </div>
        </div>
      </div>

      {/* ── Material Inventory Grid ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#66645F' }}>Loading materials ledger…</span>
        </div>
      ) : materials.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E4E0D7',
          borderRadius: '14px',
          padding: '3rem 1rem',
          textAlign: 'center',
        }}>
          <Package style={{ width: 40, height: 40, color: '#E4E0D7', margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', color: '#171817' }}>No materials found</p>
          <p style={{ fontSize: '0.875rem', color: '#66645F', marginTop: '0.25rem' }}>
            {searchName || searchColor
              ? 'Try adjusting your search or color filter.'
              : 'Add raw materials to build your inventory recipe database.'}
          </p>
        </div>
      ) : (
        <div className="material-grid">
          {materials.map((mat) => (
            <MaterialCard
              key={mat.id}
              mat={mat}
              userRole={userRole}
              onHistory={() => handleOpenHistory(mat)}
              onRestock={() => { setSelectedMaterial(mat); setRestockModalOpen(true); }}
              onEdit={() => openEditModal(mat)}
              onDelete={() => handleDelete(mat)}
            />
          ))}
        </div>
      )}

      {/* ── Add Modal ── */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="pj-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-header">
              <h3 className="pj-modal-title">Add Raw Material</h3>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66645F' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="pj-form-label">Material Name *</label>
                <input type="text" placeholder="e.g. Emerald Gem Cut" value={formName}
                  onChange={e => setFormName(e.target.value)} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
              </div>
              <div>
                <label className="pj-form-label">Color *</label>
                <input type="text" placeholder="e.g. Green" value={formColor}
                  onChange={e => setFormColor(e.target.value)} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">Packets</label>
                  <input type="number" min="0" value={formPackets}
                    onChange={e => setFormPackets(e.target.value ? parseInt(e.target.value) : '')}
                    className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
                <div>
                  <label className="pj-form-label">Qty / Packet *</label>
                  <input type="number" min="1" value={formQtyPerPacket}
                    onChange={e => setFormQtyPerPacket(e.target.value ? parseInt(e.target.value) : '')}
                    className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">Loose Units</label>
                  <input type="number" min="0" value={formLooseUnits}
                    onChange={e => setFormLooseUnits(e.target.value ? parseInt(e.target.value) : '')}
                    className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
                <div>
                  <label className="pj-form-label">Unit Cost ($)</label>
                  <input type="number" step="0.0001" min="0" value={formCostPerUnit}
                    onChange={e => setFormCostPerUnit(e.target.value ? parseFloat(e.target.value) : '')}
                    className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setAddModalOpen(false)} className="pj-action-btn-ghost" style={{ flex: 1, justifyContent: 'center', height: '42px', border: '1px solid #E4E0D7' }}>
                  Cancel
                </button>
                <button type="submit" className="pj-btn-add" style={{ flex: 2, justifyContent: 'center', height: '42px' }}>
                  Create Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editModalOpen && selectedMaterial && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="pj-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-header">
              <h3 className="pj-modal-title">Edit Raw Material</h3>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66645F' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="pj-form-label">Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
              </div>
              <div>
                <label className="pj-form-label">Color</label>
                <input type="text" value={formColor} onChange={e => setFormColor(e.target.value)} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">Packets</label>
                  <input type="number" min="0" value={formPackets} onChange={e => setFormPackets(e.target.value ? parseInt(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
                <div>
                  <label className="pj-form-label">Qty / Packet</label>
                  <input type="number" min="1" value={formQtyPerPacket} onChange={e => setFormQtyPerPacket(e.target.value ? parseInt(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">Loose Units</label>
                  <input type="number" min="0" value={formLooseUnits} onChange={e => setFormLooseUnits(e.target.value ? parseInt(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
                <div>
                  <label className="pj-form-label">Unit Cost ($)</label>
                  <input type="number" step="0.0001" min="0" value={formCostPerUnit} onChange={e => setFormCostPerUnit(e.target.value ? parseFloat(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditModalOpen(false)} className="pj-action-btn-ghost" style={{ flex: 1, justifyContent: 'center', height: '42px', border: '1px solid #E4E0D7' }}>
                  Cancel
                </button>
                <button type="submit" className="pj-btn-add" style={{ flex: 2, justifyContent: 'center', height: '42px' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Restock Modal ── */}
      {restockModalOpen && selectedMaterial && (
        <div className="modal-overlay" onClick={() => setRestockModalOpen(false)}>
          <div className="pj-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-header">
              <div>
                <h3 className="pj-modal-title">Restock Material</h3>
                <p style={{ fontSize: '0.8125rem', color: '#66645F', marginTop: 2 }}>
                  {selectedMaterial.name} ({selectedMaterial.color})
                </p>
              </div>
              <button onClick={() => setRestockModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66645F' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div className="pj-ledger-row">
                <span className="pj-ledger-label">Current Packets</span>
                <span className="pj-ledger-value">{selectedMaterial.packets} pkts</span>
              </div>
              <div className="pj-ledger-row">
                <span className="pj-ledger-label">Loose Units</span>
                <span className="pj-ledger-value">{selectedMaterial.loose_units}</span>
              </div>
              <div className="pj-ledger-row" style={{ borderTop: '1px solid #E4E0D7', marginTop: '0.35rem', paddingTop: '0.35rem' }}>
                <span className="pj-ledger-label" style={{ fontWeight: 600 }}>Total Available</span>
                <span className="pj-total-stock-value">{selectedMaterial.total_units.toLocaleString()} units</span>
              </div>
            </div>

            <form onSubmit={handleRestockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="pj-form-label">Add Packets Count</label>
                <input type="number" min="0" value={addPackets} onChange={e => setAddPackets(e.target.value ? parseInt(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} placeholder="0" />
              </div>
              <div>
                <label className="pj-form-label">Add Loose Units</label>
                <input type="number" min="0" value={addLoose} onChange={e => setAddLoose(e.target.value ? parseInt(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} placeholder="0" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setRestockModalOpen(false)} className="pj-action-btn-ghost" style={{ flex: 1, justifyContent: 'center', height: '42px', border: '1px solid #E4E0D7' }}>
                  Cancel
                </button>
                <button type="submit" className="pj-action-btn-restock" style={{ flex: 2, justifyContent: 'center', height: '42px', fontSize: '0.875rem' }}>
                  Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── History Log Modal ── */}
      {historyModalOpen && selectedMaterial && (
        <div className="modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="pj-modal-box" style={{ maxWidth: '34rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-header">
              <div>
                <h3 className="pj-modal-title">Transaction History</h3>
                <p style={{ fontSize: '0.8125rem', color: '#66645F', marginTop: 2 }}>
                  {selectedMaterial.name} ({selectedMaterial.color})
                </p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#66645F' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {historyLogs.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#66645F', textAlign: 'center', padding: '2rem 0' }}>
                No order transactions recorded for this material yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '360px', overflowY: 'auto' }}>
                {historyLogs.map((log, idx) => (
                  <div key={idx} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <span>Order SKU: {log.sku_id} ({log.color})</span>
                      <span style={{ color: '#66645F', fontWeight: 400, fontSize: '0.75rem' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#9B5757', fontFamily: 'var(--pj-font-mono)', fontWeight: 600 }}>
                        −{log.units_used} units
                      </span>
                      {userRole === 'OWNER' && log.line_cost !== null && (
                        <span style={{ color: '#806B3F', fontFamily: 'var(--pj-font-mono)', fontWeight: 600 }}>
                          ${log.line_cost?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Material Card Sub-Component ─── */

interface MaterialCardProps {
  mat: RawMaterial;
  userRole: UserRole;
  onHistory: () => void;
  onRestock: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ mat, userRole, onHistory, onRestock, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const gem = getGemColor(mat.color);

  return (
    <article 
      className={`pj-material-card ${expanded ? 'pj-material-card--expanded' : 'pj-material-card--compact'}`}
      style={{ cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top Header: Always Visible (Name, Color Swatch, Unit Cost, Quick Stock & Expand Icon) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="pj-material-name">{mat.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
            <div className="pj-color-indicator" style={{ marginTop: 0 }}>
              <span
                className="pj-color-dot"
                style={{
                  backgroundColor: gem.bg,
                  border: gem.border ? `1px solid ${gem.border}` : 'none'
                }}
              />
              <span>{mat.color}</span>
            </div>
            {/* Quick stock pill visible when collapsed */}
            {!expanded && (
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--pj-font-mono)', fontWeight: 600, color: '#496B58' }}>
                · {mat.total_units.toLocaleString()} units ({mat.packets} pkts)
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {userRole === 'OWNER' && mat.cost_per_unit !== null && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.625rem', color: '#52504B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Unit Cost
              </span>
              <span className="pj-unit-cost">${mat.cost_per_unit?.toFixed(2)}</span>
            </div>
          )}
          <button
            type="button"
            aria-label={expanded ? "Collapse details" : "Expand details"}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#52504B',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      </div>

      {/* Expanded Details Body */}
      {expanded && (
        <div 
          className="animate-fadeIn" 
          style={{ marginTop: '0.75rem' }} 
          onClick={(e) => e.stopPropagation()}
        >
          <hr className="pj-divider" />

          {/* Stock Ledger Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div className="pj-ledger-row">
              <span className="pj-ledger-label">Packets</span>
              <span className="pj-ledger-value">{mat.packets} pkts</span>
            </div>
            <div className="pj-ledger-row">
              <span className="pj-ledger-label">Units / Packet</span>
              <span className="pj-ledger-value">{mat.quantity_per_packet}</span>
            </div>
            <div className="pj-ledger-row">
              <span className="pj-ledger-label">Loose Units</span>
              <span className="pj-ledger-value">{mat.loose_units}</span>
            </div>
          </div>

          <hr className="pj-divider" />

          {/* Total Stock Summary */}
          <div>
            <div className="pj-total-stock-label">Total Stock</div>
            <div className="pj-total-stock-value">
              {mat.packets} pkts · {mat.total_units.toLocaleString()} units
              {mat.loose_units > 0 ? ` + ${mat.loose_units} loose` : ''}
            </div>
          </div>

          <hr className="pj-divider" />

          {/* Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={onHistory} className="pj-action-btn-ghost" aria-label={`History for ${mat.name}`}>
              <History style={{ width: 14, height: 14 }} /> History
            </button>

            {userRole === 'OWNER' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button onClick={onRestock} className="pj-action-btn-restock" aria-label={`Restock ${mat.name}`}>
                  Restock
                </button>
                <button onClick={onEdit} className="pj-action-btn-ghost" title="Edit Material" aria-label={`Edit ${mat.name}`}>
                  <Edit2 style={{ width: 14, height: 14 }} />
                </button>
                <button onClick={onDelete} className="pj-action-btn-danger" title="Archive Material" aria-label={`Archive ${mat.name}`}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

/* ─── Helper: Refined Gemstone Color Dot ─── */
function getGemColor(colorName: string): { bg: string; border?: string } {
  const c = colorName.toLowerCase();
  if (c.includes('green') || c.includes('emerald') || c.includes('jade')) return { bg: '#496B58' };
  if (c.includes('red') || c.includes('ruby') || c.includes('garnet') || c.includes('rose')) return { bg: '#9B5757' };
  if (c.includes('gold') || c.includes('yellow') || c.includes('amber')) return { bg: '#A88A52' };
  if (c.includes('silver') || c.includes('platinum') || c.includes('steel') || c.includes('gray')) return { bg: '#94A3B8' };
  if (c.includes('pearl') || c.includes('white') || c.includes('ivory')) return { bg: '#FFFFFF', border: '#CBD5E1' };
  if (c.includes('black') || c.includes('onyx') || c.includes('dark')) return { bg: '#171817' };
  if (c.includes('blue') || c.includes('sapphire')) return { bg: '#3B82F6' };
  return { bg: '#A88A52' };
}
