const CACHE = 'skibidi-v4';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'js/main.js', 'js/config.js', 'js/audio.js', 'js/input.js', 'js/ui.js',
  'js/renderer.js', 'js/particles.js',
  'audio/stereo-madness.mp3', 'audio/stereo-madness-2.mp3',
  'audio/cosmic-harmony.mp3', 'audio/the-other-side.mp3', 'audio/engine.mp3',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => e.respondWith(
  fetch(e.request).catch(() => caches.match(e.request))
));
