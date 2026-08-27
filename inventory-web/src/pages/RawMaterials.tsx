import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { RawMaterial, UserRole } from '../types';
import { 
  Package, Plus, Search, RefreshCw, Edit2, Trash2, 
  History, X 
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
  const totalUnits = materials.reduce((acc, m) => acc + m.total_units, 0);

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-[var(--color-accent)]" />
            <span>Raw Materials Inventory</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Summary of all uploaded raw materials. Click any card to view transaction history.
          </p>
        </div>

        {userRole === 'OWNER' && (
          <button onClick={() => { resetForm(); setAddModalOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Raw Material
          </button>
        )}
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl">
          <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase">Total Materials</span>
          <p className="text-2xl font-bold text-white mt-1">{materials.length}</p>
        </div>
        <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl">
          <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase">Total Packets</span>
          <p className="text-2xl font-bold text-[var(--color-accent)] mt-1">{totalPackets}</p>
        </div>
        <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl col-span-2 sm:col-span-1">
          <span className="text-xs text-[var(--color-text-muted)] font-semibold uppercase">Total Available Units</span>
          <p className="text-2xl font-bold text-green-400 mt-1">{totalUnits.toLocaleString()}</p>
        </div>
      </div>

      {/* Flexible Search Inputs */}
      <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by Material Name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
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

      {/* Raw Material Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl">
          <Package className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-lg">No Raw Materials Found</p>
          <p className="text-sm text-[var(--color-text-muted)]">Upload your raw materials using the Owner controls.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((mat) => (
            <div
              key={mat.id}
              className="bg-[var(--color-paper-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all rounded-xl p-5 space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-lg leading-snug">{mat.name}</h3>
                    <span className="badge-gold mt-1 inline-block">{mat.color}</span>
                  </div>
                  {userRole === 'OWNER' && mat.cost_per_unit !== null && (
                    <div className="text-right">
                      <span className="text-xs text-[var(--color-text-muted)] block">Unit Cost</span>
                      <span className="font-bold text-[var(--color-accent)]">${mat.cost_per_unit?.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 bg-[var(--color-paper)] p-3 rounded-lg border border-[var(--color-border)] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Packets:</span>
                    <span className="font-bold text-white">{mat.packets} pkts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Units / Packet:</span>
                    <span>{mat.quantity_per_packet}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Loose Units:</span>
                    <span>{mat.loose_units}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-[var(--color-border)] font-semibold text-sm">
                    <span className="text-[var(--color-text-muted)]">Total Stock:</span>
                    <span className="text-green-400">{mat.packets} pkts ({mat.total_units} units) + {mat.loose_units} loose</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenHistory(mat)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-white flex items-center gap-1.5 py-1 px-2.5 rounded hover:bg-[var(--color-paper-card-hover)]"
                >
                  <History className="w-3.5 h-3.5" /> History
                </button>

                {userRole === 'OWNER' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setSelectedMaterial(mat); setRestockModalOpen(true); }}
                      className="text-xs text-green-400 hover:bg-green-950/40 py-1 px-2.5 rounded font-semibold border border-green-900/40"
                    >
                      Restock
                    </button>
                    <button onClick={() => openEditModal(mat)} className="p-1.5 text-gray-400 hover:text-white">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(mat)} className="p-1.5 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal (Owner Only) */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">Add New Raw Material</h3>
              <button onClick={() => setAddModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Name *</label>
                <input type="text" placeholder="e.g. 3/5 tilak" value={formName} onChange={e => setFormName(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Color *</label>
                <input type="text" placeholder="e.g. Red" value={formColor} onChange={e => setFormColor(e.target.value)} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Packets Count</label>
                  <input type="number" min="0" value={formPackets} onChange={e => setFormPackets(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Qty / Packet</label>
                  <input type="number" min="1" value={formQtyPerPacket} onChange={e => setFormQtyPerPacket(e.target.value ? parseInt(e.target.value) : '')} className="input-field" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Loose Units (Optional)</label>
                  <input type="number" min="0" value={formLooseUnits} onChange={e => setFormLooseUnits(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Unit Cost ($)</label>
                  <input type="number" step="0.0001" min="0" value={formCostPerUnit} onChange={e => setFormCostPerUnit(e.target.value ? parseFloat(e.target.value) : '')} className="input-field" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Raw Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (Owner Only) */}
      {editModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">Edit Raw Material</h3>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Color</label>
                <input type="text" value={formColor} onChange={e => setFormColor(e.target.value)} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Packets</label>
                  <input type="number" min="0" value={formPackets} onChange={e => setFormPackets(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Qty / Packet</label>
                  <input type="number" min="1" value={formQtyPerPacket} onChange={e => setFormQtyPerPacket(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Loose Units</label>
                  <input type="number" min="0" value={formLooseUnits} onChange={e => setFormLooseUnits(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Unit Cost ($)</label>
                  <input type="number" step="0.0001" min="0" value={formCostPerUnit} onChange={e => setFormCostPerUnit(e.target.value ? parseFloat(e.target.value) : '')} className="input-field" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal (Owner Only) */}
      {restockModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-lg">Restock: {selectedMaterial.name} ({selectedMaterial.color})</h3>
              <button onClick={() => setRestockModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRestockSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Add Packets Count</label>
                <input type="number" min="0" value={addPackets} onChange={e => setAddPackets(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Add Loose Units</label>
                <input type="number" min="0" value={addLoose} onChange={e => setAddLoose(e.target.value ? parseInt(e.target.value) : '')} className="input-field" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRestockModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary bg-green-600 hover:bg-green-500 text-white">Add Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Log Modal */}
      {historyModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper-card)] border border-[var(--color-border)] rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-lg">Transaction History</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{selectedMaterial.name} ({selectedMaterial.color})</p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            {historyLogs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No order transactions recorded for this raw material yet.</p>
            ) : (
              <div className="space-y-3">
                {historyLogs.map((log, idx) => (
                  <div key={idx} className="bg-[var(--color-paper)] p-3.5 rounded-lg border border-[var(--color-border)] text-xs space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>Order SKU: {log.sku_id} ({log.color})</span>
                      <span className="text-[var(--color-text-muted)]">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-accent)] font-semibold">
                      <span>Deducted: {log.units_used} units</span>
                      {userRole === 'OWNER' && log.line_cost !== null && (
                        <span>Cost: ${log.line_cost?.toFixed(2)}</span>
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
