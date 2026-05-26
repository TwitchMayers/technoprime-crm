self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // CRM is mostly real-time, so we intentionally avoid aggressive caching here.
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'TechnoPrime CRM', body: event.data.text() };
  }

  const title = payload.title || 'TechnoPrime CRM';
  const body = payload.body || payload.text || 'Новое уведомление';
  const data = payload.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const hasVisibleCrm = clients.some((client) => {
        try {
          const url = new URL(client.url);
          return (
            url.origin === self.location.origin &&
            (client.visibilityState === 'visible' || client.focused)
          );
        } catch {
          return false;
        }
      });

      if (hasVisibleCrm) {
        return undefined;
      }

      return self.registration.showNotification(title, {
        body,
        icon: '/apple-icon',
        badge: '/apple-icon',
        data,
        tag: payload.tag || data.tag,
        renotify: false,
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.href || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matched = clients.find((client) => 'focus' in client);
      if (matched) {
        matched.navigate?.(targetUrl);
        return matched.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
