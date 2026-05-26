'use client';

import { fetchWithAuth } from '@/lib/fetchWithAuth';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(normalized);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export async function syncCrmPushSubscription() {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return { ok: false, reason: 'unsupported' as const };
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission' as const };
  }

  const config = await fetchWithAuth('/api/notifications/push/public-key');
  if (!config?.supported || !config?.publicKey) {
    return { ok: false, reason: 'disabled' as const };
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.pushManager) {
    return { ok: false, reason: 'unsupported' as const };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(String(config.publicKey)),
    });
  }

  const payload = subscription.toJSON();
  await fetchWithAuth('/api/notifications/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: payload.endpoint,
      expirationTime: payload.expirationTime ?? null,
      keys: payload.keys,
      userAgent: navigator.userAgent,
    }),
  });

  return { ok: true as const, endpoint: payload.endpoint };
}

export async function clearCrmPushSubscription() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager?.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  await fetchWithAuth('/api/notifications/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
}
