/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Push notification event handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, url, icon } = data;

    const options: NotificationOptions = {
      body: body || '',
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: { url: url || '/' },
      vibrate: [200, 100, 200],
      tag: `controleieasy-${Date.now()}`,
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title || 'Controlei CRM', options));
  } catch (err) {
    console.error('[SW] Push parse error:', err);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      return self.clients.openWindow(url);
    }),
  );
});
