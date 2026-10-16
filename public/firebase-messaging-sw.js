/**
 * HER-SPACE — Firebase Cloud Messaging Web Push Service Worker
 * Handles background push notifications, curfew alerts, and click actions.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker dynamically (No hardcoded credentials)
const swUrl = new URL(self.location.href);
const apiKey = swUrl.searchParams.get('apiKey');
const projectId = swUrl.searchParams.get('projectId');
const appId = swUrl.searchParams.get('appId');
const messagingSenderId = swUrl.searchParams.get('messagingSenderId');

if (apiKey && projectId) {
  firebase.initializeApp({
    apiKey,
    projectId,
    appId: appId || '',
    messagingSenderId: messagingSenderId || '',
  });
}

const messaging = firebase.messaging();

// Handle background push payload
messaging.onBackgroundMessage((payload) => {
  console.log('[HER-SPACE Service Worker] Received background notification:', payload);

  const title = payload.notification?.title || payload.data?.title || 'HER-SPACE Night Curfew Alert';
  const options = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      'Night roll-call window is active (22:00 — 00:00 IST). Please confirm your presence.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'her-space-curfew-reminder',
    renotify: true,
    data: {
      url: payload.data?.url || '/student/dashboard',
      timestamp: new Date().toISOString(),
    },
    actions: [
      { action: 'checkin', title: "Confirm I'm IN" },
      { action: 'view', title: 'Open Dashboard' },
    ],
  };

  self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
