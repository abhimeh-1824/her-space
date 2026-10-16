/**
 * HER-SPACE — Firebase Cloud Messaging & Web Push Service Worker
 * Handles background push notifications, curfew alerts, and system tray/notification bar actions.
 */

/* eslint-disable no-undef */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Safe Firebase initialization
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

  const swUrl = new URL(self.location.href);
  const apiKey = swUrl.searchParams.get('apiKey') || 'AIzaSyBweVzmweTJpPW6u61EzymZCyX9hYyh-Qw';
  const projectId = swUrl.searchParams.get('projectId') || 'tidy-marker-fmn89';
  const appId = swUrl.searchParams.get('appId') || '1:1555908782:web:a32e749f3519e89f0b853f';
  const messagingSenderId = swUrl.searchParams.get('messagingSenderId') || '1555908782';

  firebase.initializeApp({
    apiKey,
    projectId,
    appId,
    messagingSenderId,
  });

  const messaging = firebase.messaging();

  // Handle background push payload from FCM server
  messaging.onBackgroundMessage((payload) => {
    console.log('[HER-SPACE Service Worker] Background push received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'HER-SPACE Night Curfew Alert ⏰';
    const body =
      payload.notification?.body ||
      payload.data?.body ||
      'Night roll-call window is active. Please confirm your presence on your device.';

    const options = {
      body,
      tag: payload.data?.tag || `her-space-curfew-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 150, 400, 150, 400],
      data: {
        url: payload.data?.url || '/student/dashboard',
        timestamp: new Date().toISOString(),
      },
    };

    self.registration.showNotification(title, options);
  });
} catch (fbErr) {
  console.warn('[HER-SPACE Service Worker] Offline mode / Firebase init fallback:', fbErr);
}

// Handle standard Web Push / background push event when browser is closed
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || data.notification?.title || '🚨 HER-SPACE Curfew Alert';
  const body =
    data.body ||
    data.notification?.body ||
    'Night roll-call verification is active. Please confirm your attendance.';

  const options = {
    body,
    tag: data.tag || `her-space-alert-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 150, 400, 150, 400],
    data: {
      url: data.url || '/student/dashboard',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle direct notification messages from the client web app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      ...options,
      vibrate: [400, 150, 400, 150, 400],
      renotify: true,
      requireInteraction: true,
    });
  }
});

// Handle notification click: Open or focus student dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/student/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
