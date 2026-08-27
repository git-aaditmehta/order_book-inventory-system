import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Jewelry, RawMaterial, UserRole } from '../types';
import { 
  Gem, Plus, Search, RefreshCw, Edit2, Trash2, X, 
  Layers, Scale, CheckCircle2, ChevronDown, ChevronUp 
} from 'lucide-react';

interface JewelryCatalogProps {
  userRole: UserRole;
}

export const JewelryCatalog: React.FC<JewelryCatalogProps> = ({ userRole }) => {
  const [jewelryList, setJewelryList] = useState<Jewelry[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchSku, setSearchSku] = useState('');
  const [searchColor, setSearchColor] = useState('');

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedJewelry, setSelectedJewelry] = useState<Jewelry | null>(null);

  // Form states
  const [skuId, setSkuId] = useState('');
  const [color, setColor] = useState('');
  const [weightBefore, setWeightBefore] = useState<number | ''>(0);
  const [weightAfter, setWeightAfter] = useState<number | ''>(0);
  
  // Recipe form array: [{ raw_material_id, required_quantity }]
  const [recipeInputs, setRecipeInputs] = useState<Array<{ raw_material_id: string; required_quantity: number }>>([
    { raw_material_id: '', required_quantity: 1 }
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jRes, rmRes] = await Promise.all([
        api.get('/jewelry', { params: { sku_id: searchSku, color: searchColor } }),
        api.get('/raw-materials')
      ]);
      setJewelryList(jRes.data);
      setRawMaterials(rmRes.data);
    } catch (err: any) {
      console.error('Failed to load catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchSku, searchColor]);

  const handleAddRecipeRow = () => {
    setRecipeInputs([...recipeInputs, { raw_material_id: '', required_quantity: 1 }]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipeInputs(recipeInputs.filter((_, i) => i !== index));
  };

  const handleRecipeChange = (index: number, field: string, value: any) => {
    const updated = [...recipeInputs];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeInputs(updated);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRecipes = recipeInputs.filter(r => r.raw_material_id && r.required_quantity > 0);
    if (validRecipes.length === 0) {
      alert('Please add at least one valid raw material recipe.');
      return;
    }

    try {
      await api.post('/jewelry', {
        sku_id: skuId.trim(),
        color: color.trim(),
        weight_before: Number(weightBefore) || 0,
        weight_after: Number(weightAfter) || 0,
        recipes: validRecipes
      });
      setAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create jewelry item.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJewelry) return;

    const validRecipes = recipeInputs.filter(r => r.raw_material_id && r.required_quantity > 0);

    try {
      await api.put(`/jewelry/${selectedJewelry.id}`, {
        weight_before: Number(weightBefore),
        weight_after: Number(weightAfter),
        recipes: validRecipes.length > 0 ? validRecipes : undefined
      });
      setEditModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      alert('Failed to update jewelry item.');
    }
  };

  const handleDelete = async (j: Jewelry) => {
    if (!confirm(`Archive jewelry "${j.sku_id} (${j.color})"?`)) return;
    try {
      await api.delete(`/jewelry/${j.id}`);
      fetchData();
    } catch (err) {
      alert('Failed to archive jewelry item.');
    }
  };

  const openEditModal = (j: Jewelry) => {
    setSelectedJewelry(j);
    setSkuId(j.sku_id);
    setColor(j.color);
    setWeightBefore(j.weight_before);
    setWeightAfter(j.weight_after);
    setRecipeInputs(j.recipes.map(r => ({ raw_material_id: r.raw_material_id, required_quantity: r.required_quantity })));
    setEditModalOpen(true);
  };

  const resetForm = () => {
    setSkuId('');
    setColor('');
    setWeightBefore(0);
    setWeightAfter(0);
    setRecipeInputs([{ raw_material_id: '', required_quantity: 1 }]);
    setSelectedJewelry(null);
  };

  // Helper to calculate total BOM recipe cost for an item
  const calculateTotalCost = (j: Jewelry): number | null => {
    let total = 0;
    let hasValidCost = false;
    for (const r of j.recipes) {
      const rm = rawMaterials.find(m => m.id === r.raw_material_id);
      if (rm && rm.cost_per_unit !== null && rm.cost_per_unit !== undefined) {
        total += r.required_quantity * rm.cost_per_unit;
        hasValidCost = true;
      }
    }
    return hasValidCost ? total : null;
  };

  return (
    <div className="precision-jewelry-page space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="pj-header-title">Jewelry Master Catalog</h1>
          <p className="pj-header-subtitle">
            Catalog inventory · {jewelryList.length} item{jewelryList.length !== 1 ? 's' : ''} with BOM raw material recipes
          </p>
        </div>

        {userRole === 'OWNER' && (
          <button onClick={() => { resetForm(); setAddModalOpen(true); }} className="pj-btn-add">
            <Plus style={{ width: 16, height: 16 }} /> Add Jewelry Item
          </button>
        )}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="pj-search-box">
        <div className="search-grid">
          <div style={{ position: 'relative' }}>
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
              placeholder="Search by SKU ID (e.g. J-101)…"
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              className="pj-input"
            />
          </div>
          <div style={{ position: 'relative' }}>
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
              placeholder="Filter by color…"
              value={searchColor}
              onChange={(e) => setSearchColor(e.target.value)}
              className="pj-input"
            />
          </div>
        </div>
      </div>

      {/* ── Jewelry Cards Grid ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', gap: '0.75rem' }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#A88A52' }} />
          <span style={{ fontSize: '0.875rem', color: '#52504B' }}>Loading master catalog…</span>
        </div>
      ) : jewelryList.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #CCC5B6',
          borderRadius: '14px',
          padding: '3rem 1rem',
          textAlign: 'center',
        }}>
          <Gem style={{ width: 40, height: 40, color: '#CCC5B6', margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', color: '#171817' }}>No Jewelry Items Found</p>
          <p style={{ fontSize: '0.875rem', color: '#52504B', marginTop: '0.25rem' }}>
            {searchSku || searchColor
              ? 'Try adjusting your SKU or color filters.'
              : 'Add jewelry SKU items with raw material recipes.'}
          </p>
        </div>
      ) : (
        <div className="material-grid">
          {jewelryList.map((j) => (
            <JewelryCard
              key={j.id}
              j={j}
              userRole={userRole}
              calculatedCost={calculateTotalCost(j)}
              rawMaterials={rawMaterials}
              onEdit={() => openEditModal(j)}
              onDelete={() => handleDelete(j)}
            />
          ))}
        </div>
      )}

      {/* ── Add Modal ── */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="pj-modal-box" style={{ maxWidth: '34rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-header">
              <h3 className="pj-modal-title">Add Jewelry Master Item</h3>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52504B' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">SKU ID *</label>
                  <input type="text" placeholder="e.g. J-908" value={skuId} onChange={e => setSkuId(e.target.value)} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
                </div>
                <div>
                  <label className="pj-form-label">Color *</label>
                  <input type="text" placeholder="e.g. Rose Gold" value={color} onChange={e => setColor(e.target.value)} className="pj-input" style={{ paddingLeft: '0.875rem' }} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">Weight Before (g)</label>
                  <input type="number" step="0.001" value={weightBefore} onChange={e => setWeightBefore(e.target.value ? parseFloat(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
                <div>
                  <label className="pj-form-label">Weight After (g)</label>
                  <input type="number" step="0.001" value={weightAfter} onChange={e => setWeightAfter(e.target.value ? parseFloat(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
              </div>

              {/* Recipe Selector Rows */}
              <div style={{ borderTop: '1px solid #CCC5B6', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#806B3F', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Layers style={{ width: 14, height: 14 }} /> BOM Recipe (per 1 unit)
                  </span>
                  <button type="button" onClick={handleAddRecipeRow} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A88A52', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus style={{ width: 14, height: 14 }} /> Add Material
                  </button>
                </div>

                {recipeInputs.map((row, idx) => {
                  const selectedMat = rawMaterials.find(rm => rm.id === row.raw_material_id);
                  return (
                    <div key={idx} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label className="pj-form-label" style={{ fontSize: '0.625rem' }}>Raw Material #{idx + 1}</label>
                          <select
                            value={row.raw_material_id}
                            onChange={e => handleRecipeChange(idx, 'raw_material_id', e.target.value)}
                            className="pj-input"
                            style={{ paddingLeft: '0.75rem', height: '38px', fontSize: '0.8125rem' }}
                            required
                          >
                            <option value="">-- Select Raw Material --</option>
                            {rawMaterials.map(rm => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} ({rm.color}) — {rm.packets} pkts ({rm.total_units} units avail)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ width: '100px' }}>
                          <label className="pj-form-label" style={{ fontSize: '0.625rem' }}>Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={row.required_quantity}
                            onChange={e => handleRecipeChange(idx, 'required_quantity', parseInt(e.target.value) || 1)}
                            className="pj-input"
                            style={{ paddingLeft: '0.5rem', textAlign: 'center', height: '38px', fontSize: '0.8125rem', fontWeight: 700 }}
                            required
                          />
                        </div>

                        {recipeInputs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeRow(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B5757', padding: '0.35rem', marginTop: '1.25rem' }}
                          >
                            <X style={{ width: 16, height: 16 }} />
                          </button>
                        )}
                      </div>

                      {selectedMat && (
                        <div style={{ fontSize: '0.75rem', color: '#496B58', fontWeight: 600, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #CCC5B6', paddingTop: '0.35rem' }}>
                          <span>Selected: {selectedMat.name} ({selectedMat.color})</span>
                          <span>Avail: {selectedMat.total_units} units</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setAddModalOpen(false)} className="pj-action-btn-ghost" style={{ flex: 1, justifyContent: 'center', height: '42px', border: '1px solid #CCC5B6' }}>
                  Cancel
                </button>
                <button type="submit" className="pj-btn-add" style={{ flex: 2, justifyContent: 'center', height: '42px' }}>
                  Save Jewelry Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editModalOpen && selectedJewelry && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="pj-modal-box" style={{ maxWidth: '34rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-header">
              <h3 className="pj-modal-title">Edit Jewelry: {selectedJewelry.sku_id} ({selectedJewelry.color})</h3>
              <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52504B' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="pj-form-label">Weight Before (g)</label>
                  <input type="number" step="0.001" value={weightBefore} onChange={e => setWeightBefore(e.target.value ? parseFloat(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
                <div>
                  <label className="pj-form-label">Weight After (g)</label>
                  <input type="number" step="0.001" value={weightAfter} onChange={e => setWeightAfter(e.target.value ? parseFloat(e.target.value) : '')} className="pj-input" style={{ paddingLeft: '0.875rem' }} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #CCC5B6', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#806B3F', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Layers style={{ width: 14, height: 14 }} /> Update BOM Recipe List
                  </span>
                  <button type="button" onClick={handleAddRecipeRow} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A88A52', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus style={{ width: 14, height: 14 }} /> Add Material
                  </button>
                </div>

                {recipeInputs.map((row, idx) => {
                  const selectedMat = rawMaterials.find(rm => rm.id === row.raw_material_id);
                  return (
                    <div key={idx} style={{ backgroundColor: '#E0D9CB', border: '1px solid #CCC5B6', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label className="pj-form-label" style={{ fontSize: '0.625rem' }}>Raw Material #{idx + 1}</label>
                          <select
                            value={row.raw_material_id}
                            onChange={e => handleRecipeChange(idx, 'raw_material_id', e.target.value)}
                            className="pj-input"
                            style={{ paddingLeft: '0.75rem', height: '38px', fontSize: '0.8125rem' }}
                            required
                          >
                            <option value="">-- Select Raw Material --</option>
                            {rawMaterials.map(rm => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} ({rm.color}) — {rm.packets} pkts ({rm.total_units} units avail)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ width: '100px' }}>
                          <label className="pj-form-label" style={{ fontSize: '0.625rem' }}>Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={row.required_quantity}
                            onChange={e => handleRecipeChange(idx, 'required_quantity', parseInt(e.target.value) || 1)}
                            className="pj-input"
                            style={{ paddingLeft: '0.5rem', textAlign: 'center', height: '38px', fontSize: '0.8125rem', fontWeight: 700 }}
                            required
                          />
                        </div>

                        {recipeInputs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeRow(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B5757', padding: '0.35rem', marginTop: '1.25rem' }}
                          >
                            <X style={{ width: 16, height: 16 }} />
                          </button>
                        )}
                      </div>

                      {selectedMat && (
                        <div style={{ fontSize: '0.75rem', color: '#496B58', fontWeight: 600, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #CCC5B6', paddingTop: '0.35rem' }}>
                          <span>Selected: {selectedMat.name} ({selectedMat.color})</span>
                          <span>Avail: {selectedMat.total_units} units</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditModalOpen(false)} className="pj-action-btn-ghost" style={{ flex: 1, justifyContent: 'center', height: '42px', border: '1px solid #CCC5B6' }}>
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
    </div>
  );
};

/* ─── Compact Collapsible Jewelry Card Sub-Component ─── */

interface JewelryCardProps {
  j: Jewelry;
  userRole: UserRole;
  calculatedCost: number | null;
  rawMaterials: RawMaterial[];
  onEdit: () => void;
  onDelete: () => void;
}

const JewelryCard: React.FC<JewelryCardProps> = ({ j, userRole, calculatedCost, rawMaterials, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const gem = getGemColor(j.color);

  return (
    <article
      className={`pj-material-card ${expanded ? 'pj-material-card--expanded' : 'pj-material-card--compact'}`}
      style={{ cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top Header: SKU ID, Color Swatch, Total Recipe Costing & Expand Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="pj-material-name">{j.sku_id}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
            <div className="pj-color-indicator" style={{ marginTop: 0 }}>
              <span
                className="pj-color-dot"
                style={{
                  backgroundColor: gem.bg,
                  border: gem.border ? `1px solid ${gem.border}` : 'none'
                }}
              />
              <span>{j.color}</span>
            </div>
            {/* Quick recipe summary count visible when collapsed */}
            {!expanded && (
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--pj-font-mono)', fontWeight: 600, color: '#52504B' }}>
                · {j.recipes.length} material{j.recipes.length !== 1 ? 's' : ''} in BOM
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {userRole === 'OWNER' && calculatedCost !== null && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.625rem', color: '#52504B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Cost
              </span>
              <span className="pj-unit-cost">${calculatedCost.toFixed(2)}</span>
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

          {/* Weights metadata */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#52504B' }}>
            <span>Weight Before: <strong>{j.weight_before}g</strong></span>
            <span>Weight After: <strong>{j.weight_after}g</strong></span>
          </div>

          <hr className="pj-divider" />

          {/* BOM Recipe Breakdown */}
          <div>
            <div className="pj-total-stock-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#806B3F' }}>
              <Layers style={{ width: 13, height: 13 }} /> BOM Recipe (per 1 unit)
            </div>
            {j.recipes.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: '#52504B', fontStyle: 'italic' }}>No raw material recipe configured.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                {j.recipes.map((r, idx) => {
                  const rm = rawMaterials.find(m => m.id === r.raw_material_id);
                  const lineCost = (rm && rm.cost_per_unit !== null && rm.cost_per_unit !== undefined)
                    ? r.required_quantity * rm.cost_per_unit
                    : null;
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#E0D9CB',
                        border: '1px solid #CCC5B6',
                        borderRadius: '6px',
                        padding: '0.35rem 0.625rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8125rem'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#171817' }}>
                        {r.raw_material_name || 'Material'} ({r.raw_material_color || 'Default'})
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--pj-font-mono)', fontWeight: 700, color: '#496B58' }}>
                          {r.required_quantity} units
                        </span>
                        {userRole === 'OWNER' && lineCost !== null && (
                          <span style={{ fontFamily: 'var(--pj-font-mono)', fontSize: '0.75rem', color: '#7A6438' }}>
                            (${lineCost.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="pj-divider" />

          {/* Action Controls */}
          {userRole === 'OWNER' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={onEdit} className="pj-action-btn-ghost" title="Edit Recipe">
                <Edit2 style={{ width: 14, height: 14 }} /> Edit Recipe
              </button>
              <button onClick={onDelete} className="pj-action-btn-danger" title="Archive Item">
                <Trash2 style={{ width: 14, height: 14 }} /> Archive
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

/* Helper: Color Dot */
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
