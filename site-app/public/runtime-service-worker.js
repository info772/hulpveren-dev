/* Retire the legacy worker that intercepted public page requests.
 * Keep this URL available so existing browsers can install this replacement.
 * There is intentionally no fetch handler; navigation uses the network.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
