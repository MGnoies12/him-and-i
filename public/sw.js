/* No offline/private-data cache. Push payloads contain no chat, letter or health content. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    /* Generic fallback. */
  }
  event.waitUntil(
    self.registration.showNotification('HIM & I', {
      body: 'A little update in your private space.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: typeof data.id === 'string' ? data.id : 'him-and-i',
      data: { url: '/notifications' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        existing.navigate('/notifications');
        return existing.focus();
      }
      return clients.openWindow('/notifications');
    }),
  );
});
