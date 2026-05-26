'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { syncCrmPushSubscription } from '@/lib/push-subscriptions';

export default function PushSubscriptionSync() {
  const { user, loading } = useAuth();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user) {
      syncedRef.current = null;
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'granted') {
      syncedRef.current = null;
      return;
    }

    const syncKey = `${user.id}:${Notification.permission}`;
    if (syncedRef.current === syncKey) {
      return;
    }

    syncedRef.current = syncKey;
    void syncCrmPushSubscription().catch(() => {
      syncedRef.current = null;
    });
  }, [loading, user]);

  return null;
}
