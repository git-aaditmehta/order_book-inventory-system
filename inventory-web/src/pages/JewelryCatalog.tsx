import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Jewelry, RawMaterial, UserRole } from '../types';
import { 
  Gem, Plus, Search, RefreshCw, Edit2, Trash2, X, Layers, Scale 
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gem className="w-6 h-6 text-[var(--color-accent)]" />
            <span>Jewelry Master Catalog</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Jewelry items and their BOM raw material recipe breakdown.
          </p>
        </div>

        {userRole === 'OWNER' && (
          <button onClick={() => { resetForm(); setAddModalOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Jewelry Item
          </button>
        )}
      </div>

      {/* Flexible Search */}
      <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by SKU ID (e.g. J-101)..."
            value={searchSku}
            onChange={(e) => setSearchSku(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by Color..."
            value={searchColor}
            onChange={(e) => setSearchColor(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Jewelry Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      ) : jewelryList.length === 0 ? (
        <div className="text-center py-12 bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl">
          <Gem className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-lg">No Jewelry Items Found</p>
          <p className="text-sm text-[var(--color-text-muted)]">Setup jewelry SKU recipes using Owner controls.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jewelryList.map((j) => (
            <div
              key={j.id}
              className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-xl leading-tight">{j.sku_id}</h3>
                    <span className="badge-gold mt-1 inline-block">{j.color}</span>
                  </div>
                  <div className="text-right text-xs text-[var(--color-text-muted)] space-y-0.5">
                    <div className="flex items-center justify-end gap-1">
                      <Scale className="w-3.5 h-3.5" />
                      <span>Before: {j.weight_before}g</span>
                    </div>
                    <div>After: {j.weight_after}g</div>
                  </div>
                </div>

                {/* Recipe Section */}
                <div className="mt-4 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" /> BOM Recipe (per 1 unit):
                  </span>
                  <div className="bg-[var(--color-paper)] p-3 rounded-lg border border-[var(--color-border)] space-y-1.5 text-xs">
                    {j.recipes.length === 0 ? (
                      <span className="text-[var(--color-text-muted)]">No recipes configured.</span>
                    ) : (
                      j.recipes.map((r, i) => (
                        <div key={i} className="flex justify-between items-center py-0.5">
                          <span className="font-medium text-white">{r.raw_material_name} ({r.raw_material_color})</span>
                          <span className="font-bold text-[var(--color-accent)]">{r.required_quantity} units</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {userRole === 'OWNER' && (
                <div className="pt-3 border-t border-[var(--color-border)] flex justify-end gap-2">
                  <button onClick={() => openEditModal(j)} className="btn-secondary text-xs py-1.5 px-3">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Recipe
                  </button>
                  <button onClick={() => handleDelete(j)} className="p-1.5 text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">Add Jewelry Master Item</h3>
              <button onClick={() => setAddModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">SKU ID *</label>
                  <input type="text" placeholder="e.g. J-101" value={skuId} onChange={e => setSkuId(e.target.value)} className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Color *</label>
                  <input type="text" placeholder="e.g. Rose Gold" value={color} onChange={e => setColor(e.target.value)} className="input-field" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Weight Before (g)</label>
                  <input type="number" step="0.001" value={weightBefore} onChange={e => setWeightBefore(e.target.value ? parseFloat(e.target.value) : '')} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Weight After (g)</label>
                  <input type="number" step="0.001" value={weightAfter} onChange={e => setWeightAfter(e.target.value ? parseFloat(e.target.value) : '')} className="input-field" />
                </div>
              </div>

              {/* Recipe Selector List */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                    Raw Material Recipes (per 1 unit)
                  </span>
                  <button type="button" onClick={handleAddRecipeRow} className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 font-semibold">
                    <Plus className="w-3 h-3" /> Add Material
                  </button>
                </div>

                {recipeInputs.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={row.raw_material_id}
                      onChange={e => handleRecipeChange(idx, 'raw_material_id', e.target.value)}
                      className="input-field flex-1"
                      required
                    >
                      <option value="">-- Select Raw Material --</option>
                      {rawMaterials.map(rm => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.color}) — {rm.packets} pkts avail
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.required_quantity}
                      onChange={e => handleRecipeChange(idx, 'required_quantity', parseInt(e.target.value) || 1)}
                      className="input-field w-24"
                      required
                    />
                    {recipeInputs.length > 1 && (
                      <button type="button" onClick={() => handleRemoveRecipeRow(idx)} className="text-red-400 p-2">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Jewelry Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && selectedJewelry && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">Edit Jewelry: {selectedJewelry.sku_id} ({selectedJewelry.color})</h3>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Weight Before (g)</label>
                  <input type="number" step="0.001" value={weightBefore} onChange={e => setWeightBefore(e.target.value ? parseFloat(e.target.value) : '')} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Weight After (g)</label>
                  <input type="number" step="0.001" value={weightAfter} onChange={e => setWeightAfter(e.target.value ? parseFloat(e.target.value) : '')} className="input-field" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                    Update BOM Recipe List
                  </span>
                  <button type="button" onClick={handleAddRecipeRow} className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 font-semibold">
                    <Plus className="w-3 h-3" /> Add Material
                  </button>
                </div>

                {recipeInputs.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={row.raw_material_id}
                      onChange={e => handleRecipeChange(idx, 'raw_material_id', e.target.value)}
                      className="input-field flex-1"
                      required
                    >
                      <option value="">-- Select Raw Material --</option>
                      {rawMaterials.map(rm => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.color})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.required_quantity}
                      onChange={e => handleRecipeChange(idx, 'required_quantity', parseInt(e.target.value) || 1)}
                      className="input-field w-24"
                      required
                    />
                    {recipeInputs.length > 1 && (
                      <button type="button" onClick={() => handleRemoveRecipeRow(idx)} className="text-red-400 p-2">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
