/* Project Command Center service worker — cache-first for the app shell.
 * Data is NOT cached here: the record lives in localStorage (cache), in
 * Firestore (owner-only, after sign-in) and in the exported JSON on
 * Google Drive (durable source of truth). No project data is ever in the
 * shell cache. */
var CACHE = 'pcc-v2';
var SHELL = ['index.html', 'styles.css', 'app.js', 'core.js', 'auth.js', 'firebase.js', 'manifest.json'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
});
self.addEventListener('fetch', function (e) {
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
