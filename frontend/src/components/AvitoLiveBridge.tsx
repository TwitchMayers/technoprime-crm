'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { usePageActivity } from '@/hooks/usePageActivity';

type LiveAccount = {
  id: number;
  displayName: string;
  requiresReconnect?: boolean;
};

type LiveChat = {
  id: string;
  unreadCount: number;
  counterpart: {
    name: string;
  };
  item: {
    title: string;
    url?: string | null;
  };
  lastMessage: {
    id?: string | null;
    text?: string | null;
    direction: string;
    createdAt?: string | null;
  };
};

const VISIBLE_INTERVAL_MS = 40000;
const ERROR_INTERVAL_MS = 75000;
const ACCOUNT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function supportsBadging() {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as any).setAppBadge === 'function' || typeof (navigator as any).clearAppBadge === 'function';
}

export default function AvitoLiveBridge() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isPageActive = usePageActivity();
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const runningRef = useRef(false);
  const knownMessageKeysRef = useRef<Record<string, string>>({});
  const accountsCacheRef = useRef<LiveAccount[]>([]);
  const accountsFetchedAtRef = useRef(0);
  const errorStreakRef = useRef(0);

  useEffect(() => {
    if (loading || !user) return;
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role)) return;
    if (!isPageActive) return;
    if (pathname.startsWith('/communication-center')) return;

    let cancelled = false;

    const syncUnreadBadge = (unreadCount: number) => {
      if (!supportsBadging()) return;
      if (unreadCount > 0) {
        (navigator as any).setAppBadge?.(unreadCount);
      } else {
        (navigator as any).clearAppBadge?.();
      }
    };

    const scheduleNext = (delay: number) => {
      if (cancelled) return;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        void poll();
      }, delay);
    };

    const loadHealthyAccounts = async (force = false) => {
      const isFresh = Date.now() - accountsFetchedAtRef.current < ACCOUNT_REFRESH_INTERVAL_MS;
      if (!force && isFresh && accountsCacheRef.current.length > 0) {
        return accountsCacheRef.current;
      }

      const accounts = (await fetchWithAuth('/api/logistics/marketplace-accounts/avito/connected')) as LiveAccount[];
      const healthyAccounts = (Array.isArray(accounts) ? accounts : []).filter((item) => !item.requiresReconnect);
      accountsCacheRef.current = healthyAccounts;
      accountsFetchedAtRef.current = Date.now();
      return healthyAccounts;
    };

    const poll = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const healthyAccounts = await loadHealthyAccounts();
        if (!healthyAccounts.length) {
          syncUnreadBadge(0);
          errorStreakRef.current = 0;
          startedRef.current = true;
          scheduleNext(VISIBLE_INTERVAL_MS);
          return;
        }

        let totalUnread = 0;

        const settled = await Promise.allSettled(
          healthyAccounts.map(async (account) => {
            const response = await fetchWithAuth(
              `/api/logistics/marketplace-accounts/${account.id}/avito/chats?limit=8&unreadOnly=true&live=true`,
            );
            return {
              account,
              chats: Array.isArray(response?.items) ? (response.items as LiveChat[]) : [],
            };
          }),
        );

        for (const result of settled) {
          if (result.status !== 'fulfilled') continue;
          const { account, chats } = result.value;

          for (const chat of chats) {
            totalUnread += Number(chat.unreadCount || 0);
            const key = `${chat.lastMessage.id || ''}:${chat.lastMessage.createdAt || ''}:${chat.unreadCount}`;
            const storageKey = `${account.id}:${chat.id}`;

            if (!startedRef.current) {
              knownMessageKeysRef.current[storageKey] = key;
              continue;
            }

            knownMessageKeysRef.current[storageKey] = key;
          }
        }

        syncUnreadBadge(totalUnread);
        errorStreakRef.current = 0;
        startedRef.current = true;
      } catch {
        errorStreakRef.current += 1;
      } finally {
        runningRef.current = false;
        const delay =
          errorStreakRef.current > 0
            ? Math.min(ERROR_INTERVAL_MS * errorStreakRef.current, 2 * 60 * 1000)
            : VISIBLE_INTERVAL_MS;
        scheduleNext(delay);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPageActive, loading, pathname, user]);

  return null;
}
