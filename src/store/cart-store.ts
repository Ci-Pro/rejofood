/**
 * Cart store — client-side state untuk keranjang belanja customer.
 *
 * Constraint: semua item harus dari merchant yang sama. Jika user menambah item
 * dari merchant berbeda, store akan prompt (lewat return value) untuk clear cart dulu.
 *
 * Persist ke localStorage agar cart tidak hilang saat refresh.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  menuItemId: string;
  merchantId: string;
  restaurantName: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface CartState {
  items: CartItem[];
  merchantId: string | null;
  restaurantName: string | null;
  /** Tambah item. Return { ok, conflict } — conflict = merchant berbeda. */
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => { ok: boolean; conflict: boolean };
  /** Paksa add (override cart jika beda merchant) */
  forceAddItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
}

const DELIVERY_FEE = 10000;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      merchantId: null,
      restaurantName: null,

      addItem: (item, quantity = 1) => {
        const state = get();
        // Cek konflik merchant
        if (state.merchantId && state.merchantId !== item.merchantId) {
          return { ok: false, conflict: true };
        }
        const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
        if (existing) {
          set({
            items: state.items.map((i) =>
              i.menuItemId === item.menuItemId
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
          });
        } else {
          set({
            items: [...state.items, { ...item, quantity }],
            merchantId: item.merchantId,
            restaurantName: item.restaurantName,
          });
        }
        return { ok: true, conflict: false };
      },

      forceAddItem: (item, quantity = 1) => {
        set({
          items: [{ ...item, quantity }],
          merchantId: item.merchantId,
          restaurantName: item.restaurantName,
        });
      },

      removeItem: (menuItemId) => {
        const state = get();
        const newItems = state.items.filter((i) => i.menuItemId !== menuItemId);
        set({
          items: newItems,
          merchantId: newItems.length === 0 ? null : state.merchantId,
          restaurantName: newItems.length === 0 ? null : state.restaurantName,
        });
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, quantity } : i,
          ),
        }));
      },

      clearCart: () => set({ items: [], merchantId: null, restaurantName: null }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getDeliveryFee: () => (get().items.length > 0 ? DELIVERY_FEE : 0),
      getTotal: () => get().getSubtotal() + get().getDeliveryFee(),
    }),
    { name: "rejofood-cart" },
  ),
);
