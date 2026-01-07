/**
 * Service Worker for MIDI BitLab PWA
 * Enables offline functionality by caching all app assets
 * Cache-first strategy for static assets, network-first for dynamic
 */

const CACHE_NAME = 'midi-bitlab-v1';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './lib/p5.min.js',
  './icons/icon.svg',
  './src/main.js',
  './src/config/constants.js',
  './src/controllers/AppController.js',
  './src/controllers/InteractionController.js',
  './src/models/AverageWindowNode.js',
  './src/models/Connection.js',
  './src/models/GroupManager.js',
  './src/models/HTrigger.js',
  './src/models/MidiManager.js',
  './src/models/Node.js',
  './src/models/OscilloscopeNode.js',
  './src/models/Port.js',
  './src/models/ProjectSerializer.js',
  './src/models/RecordingManager.js',
  './src/models/VTrigger.js',
  './src/models/WaveformGenerator.js',
  './src/models/WaveformNode.js',
  './src/utils/EventEmitter.js',
  './src/utils/geometry.js',
  './src/views/AverageWindowRenderer.js',
  './src/views/CanvasManager.js',
  './src/views/ConnectionRenderer.js',
  './src/views/NodeRenderer.js',
  './src/views/OscilloscopeRenderer.js',
  './src/views/RecordingRenderer.js',
  './src/views/SidebarRenderer.js',
  './src/views/SourceSelector.js'
];

// Install event - cache all static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] All assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Failed to cache assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          console.log('[SW] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone the response (can only be consumed once)
            const responseToCache = networkResponse.clone();

            // Add to cache for future requests
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            // Could return a custom offline page here
            return new Response('Offline - resource not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
