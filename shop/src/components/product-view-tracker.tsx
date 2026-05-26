'use client';

import { useEffect } from 'react';
import { trackShopProductView } from '@/lib/shop-api';

const VIEWED_COOKIE = 'tp_viewed_products';
const VISITOR_COOKIE = 'tp_visitor_id';
const REPEAT_VIEW_WINDOW_MS = 12 * 60 * 60 * 1000;
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

type ViewedMap = Record<string, number>;

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const part = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.split('=').slice(1).join('=')) : '';
}

function writeCookie(name: string, value: string, maxAgeSec = ONE_YEAR_SEC) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; samesite=lax`;
}

function ensureVisitorId() {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const generated = `v_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  writeCookie(VISITOR_COOKIE, generated);
  return generated;
}

function readViewedMap(): ViewedMap {
  const raw = readCookie(VIEWED_COOKIE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const entries = Object.entries(parsed).filter(
      ([key, value]) => /^\d+$/.test(key) && Number.isFinite(Number(value)),
    );
    return Object.fromEntries(entries) as ViewedMap;
  } catch {
    return {};
  }
}

function writeViewedMap(map: ViewedMap) {
  const now = Date.now();
  const normalized = Object.entries(map)
    .filter(([key, value]) => /^\d+$/.test(key) && Number.isFinite(Number(value)))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 120)
    .reduce((acc, [key, value]) => {
      if (now - Number(value) <= ONE_YEAR_SEC * 1000) {
        acc[key] = Number(value);
      }
      return acc;
    }, {} as ViewedMap);

  writeCookie(VIEWED_COOKIE, JSON.stringify(normalized));
}

export function ProductViewTracker({ productId }: { productId: number }) {
  useEffect(() => {
    if (!productId || Number.isNaN(productId)) return;

    const now = Date.now();
    const viewed = readViewedMap();
    const lastViewedAt = Number(viewed[String(productId)] || 0);
    const shouldSend = !lastViewedAt || now - lastViewedAt >= REPEAT_VIEW_WINDOW_MS;

    viewed[String(productId)] = now;
    writeViewedMap(viewed);

    if (!shouldSend) return;

    const visitorId = ensureVisitorId();
    void trackShopProductView({
      productId,
      cookieId: visitorId,
    });
  }, [productId]);

  return null;
}
