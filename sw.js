const CACHE = 'skibidi-v2';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'js/main.js', 'js/config.js', 'js/audio.js', 'js/input.js', 'js/ui.js',
  'js/renderer.js', 'js/particles.js',
  'audio/stereo-madness.mp3', 'audio/stereo-madness-2.mp3',
  'audio/cosmic-harmony.mp3', 'audio/the-other-side.mp3', 'audio/engine.mp3',
];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
