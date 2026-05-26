'use client';

import { useMemo, useSyncExternalStore } from 'react';

export type CartItem = {
  productId: number;
  variantKey?: string | null;
  variantLabel?: string | null;
  slug?: string | null;
  name: string;
  price: number;
  qty: number;
  coverImage?: string | null;
  inStock?: boolean | null;
};

const CART_KEY = 'technoprime_shop_cart_v1';
const CART_EVENT = 'technoprime-cart-changed';
const EMPTY_CART: CartItem[] = [];

let snapshotCache: CartItem[] = EMPTY_CART;

function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: Number(item.productId),
        variantKey: item.variantKey ? String(item.variantKey) : null,
        variantLabel: item.variantLabel ? String(item.variantLabel) : null,
        slug: item.slug || null,
        name: String(item.name || ''),
        price: Number(item.price || 0),
        qty: Math.max(1, Number(item.qty || 1)),
        coverImage: item.coverImage || null,
        inStock: item.inStock ?? null,
      }))
      .filter((item) => item.productId > 0 && item.name);
  } catch {
    return [];
  }
}

function sameCart(a: CartItem[], b: CartItem[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];

    if (
      left.productId !== right.productId ||
      left.variantKey !== right.variantKey ||
      left.variantLabel !== right.variantLabel ||
      left.slug !== right.slug ||
      left.name !== right.name ||
      left.price !== right.price ||
      left.qty !== right.qty ||
      left.coverImage !== right.coverImage ||
      left.inStock !== right.inStock
    ) {
      return false;
    }
  }

  return true;
}

function normalizeCart(items: CartItem[]): CartItem[] {
  if (!Array.isArray(items) || items.length === 0) return EMPTY_CART;

  const normalized = items
    .map((item) => ({
      ...item,
      qty: Math.max(1, Number(item.qty || 1)),
      price: Number(item.price || 0),
    }))
    .filter((item) => item.productId > 0 && item.name);

  return normalized.length ? normalized : EMPTY_CART;
}

function readCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return EMPTY_CART;
  return normalizeCart(parseCart(window.localStorage.getItem(CART_KEY)));
}

function getSnapshot(): CartItem[] {
  if (typeof window === 'undefined') return EMPTY_CART;
  const next = readCartFromStorage();
  if (sameCart(snapshotCache, next)) return snapshotCache;
  snapshotCache = next;
  return snapshotCache;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  const next = normalizeCart(items);
  snapshotCache = next;
  window.localStorage.setItem(CART_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CART_EVENT));
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => {
    snapshotCache = readCartFromStorage();
    onChange();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(CART_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CART_EVENT, handler);
  };
}

export function useCartStore() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateCart = (updater: (current: CartItem[]) => CartItem[]) => {
    const current = getSnapshot();
    const next = updater(current);
    writeCart(next);
  };

  return useMemo(() => {
    const addItem = (item: Omit<CartItem, 'qty'>, qty = 1) => {
      updateCart((current) => {
        const itemVariantKey = item.variantKey || null;
        const index = current.findIndex(
          (x) => x.productId === item.productId && (x.variantKey || null) === itemVariantKey,
        );
        if (index >= 0) {
          return current.map((entry, entryIndex) =>
            entryIndex === index
              ? { ...entry, qty: entry.qty + Math.max(1, qty) }
              : entry,
          );
        }
        return [...current, { ...item, qty: Math.max(1, qty) }];
      });
    };

    const setQty = (productId: number, qty: number, variantKey?: string | null) => {
      const normalizedVariantKey = variantKey || null;
      updateCart((current) =>
        current
          .map((x) =>
            x.productId === productId && (x.variantKey || null) === normalizedVariantKey
              ? { ...x, qty: Math.max(1, qty) }
              : x,
          )
          .filter((x) => x.qty > 0),
      );
    };

    const removeItem = (productId: number, variantKey?: string | null) => {
      const normalizedVariantKey = variantKey || null;
      updateCart((current) =>
        current.filter(
          (x) => !(x.productId === productId && (x.variantKey || null) === normalizedVariantKey),
        ),
      );
    };

    const clear = () => writeCart([]);

    const totalQty = items.reduce((acc, item) => acc + item.qty, 0);
    const totalAmount = items.reduce((acc, item) => acc + item.qty * item.price, 0);

    return {
      items,
      totalQty,
      totalAmount,
      addItem,
      setQty,
      removeItem,
      clear,
    };
  }, [items]);
}
