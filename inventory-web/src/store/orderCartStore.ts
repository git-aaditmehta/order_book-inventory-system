import { create } from 'zustand';
import type { OrderItemInput, OrderPreviewResponse, OrderProcessResponse } from '../types';

const DRAFT_STORAGE_KEY = 'luxe_draft_order_items';

function getInitialDraftItems(): OrderItemInput[] {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Cleanse items so no corrupt/null values exist
        return parsed.map(item => ({
          sku_id: String(item.sku_id || ''),
          color: String(item.color || ''),
          order_quantity: item.order_quantity === '' || item.order_quantity === undefined ? '' : (Number(item.order_quantity) || '')
        }));
      }
    }
  } catch (e) {
    console.error('Failed to parse draft order items from storage:', e);
  }
  return [{ sku_id: '', color: '', order_quantity: '' }];
}

interface OrderCartState {
  orderItems: OrderItemInput[];
  previewData: OrderPreviewResponse | null;
  lastPreviewMaterials: any[];
  successResult: OrderProcessResponse | null;
  errorMessage: string | null;

  setOrderItems: (items: OrderItemInput[]) => void;
  addItemRow: () => void;
  removeItemRow: (index: number) => void;
  updateItemRow: (index: number, field: keyof OrderItemInput, value: any) => void;
  setPreviewData: (data: OrderPreviewResponse | null) => void;
  setLastPreviewMaterials: (materials: any[]) => void;
  setSuccessResult: (result: OrderProcessResponse | null) => void;
  setErrorMessage: (msg: string | null) => void;
  resetCart: () => void;
  clearDraft: () => void;
}

export const useOrderCartStore = create<OrderCartState>((set, get) => ({
  orderItems: getInitialDraftItems(),
  previewData: null,
  lastPreviewMaterials: [],
  successResult: null,
  errorMessage: null,

  setOrderItems: (items) => {
    set({ orderItems: items });
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  },

  addItemRow: () => {
    const current = get().orderItems;
    const next: OrderItemInput[] = [...current, { sku_id: '', color: '', order_quantity: '' }];
    get().setOrderItems(next);
  },

  removeItemRow: (index: number) => {
    const current = get().orderItems;
    if (current.length <= 1) return;
    const next = current.filter((_, i) => i !== index);
    set({ previewData: null });
    get().setOrderItems(next);
  },

  updateItemRow: (index: number, field: keyof OrderItemInput, value: any) => {
    const current = [...get().orderItems];
    current[index] = { ...current[index], [field]: value };
    set({ previewData: null, errorMessage: null });
    get().setOrderItems(current);
  },

  setPreviewData: (data) => set({ previewData: data }),
  setLastPreviewMaterials: (materials) => set({ lastPreviewMaterials: materials }),
  setSuccessResult: (result) => set({ successResult: result }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),

  resetCart: () => {
    const empty: OrderItemInput[] = [{ sku_id: '', color: '', order_quantity: '' }];
    set({
      orderItems: empty,
      previewData: null,
      successResult: null,
      errorMessage: null,
      lastPreviewMaterials: []
    });
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
  },

  clearDraft: () => {
    get().resetCart();
  }
}));
