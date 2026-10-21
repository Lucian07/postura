/* Site-ul merge și fără internet după prima vizită. Mereu încearcă întâi versiunea nouă. */
const CACHE = 'postura-v4';
const FILES = [
  './', 'index.html', 'css/style.css',
  'js/data.js', 'js/core.js', 'js/sync.js', 'js/audio.js', 'js/player.js', 'js/app.js',
  'icon.svg', 'manifest.webmanifest', 'memento-exercitii-8am.ics',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Doar fișierele site-ului; cererile către GitHub (progresul) și fonturi merg direct.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // no-cache: întreabă serverul de fiecare dată (GitHub Pages ține fișierele 10 min în cache).
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('./#azi');
    })
  );
});
