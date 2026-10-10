// Service Worker para Firebase Cloud Messaging (VOXA)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload?.notification?.title || 'VOXA';
    const options = {
      body: payload?.notification?.body || '',
      icon: payload?.notification?.icon || '/favicon.ico',
      data: payload?.data || {}
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Ignora payloads não-JSON
  }
});

