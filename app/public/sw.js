// Service worker: świeżość ważniejsza niż szybkość.
//
// Historia: pierwsza wersja trzymała cache-first dla wszystkich zasobów przy
// stałej nazwie cache'a. Efekt: po wdrożeniu nowej wersji telefon w nieskończoność
// serwował stary build, bo trafienie w cache zawsze wygrywało, a `activate`
// kasował tylko cache'e o INNEJ nazwie — czyli nigdy tego właściwego.
//
// Teraz: cache-first tylko dla /_next/static/, bo Next.js daje tym plikom nazwy
// z hashem treści — zmiana pliku = zmiana nazwy, więc stary nigdy nie zostanie
// podany zamiast nowego. Cała reszta idzie network-first z cache'em jako
// zapasem na offline.

const CACHE = 'forteca-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.json'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((klucze) => Promise.all(klucze.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Zapisz kopię do cache'a, ignorując błędy (prywatny tryb, brak miejsca). */
function zapisz(request, odpowiedz) {
  if (!odpowiedz || !odpowiedz.ok) return;
  const kopia = odpowiedz.clone();
  caches.open(CACHE).then((c) => c.put(request, kopia)).catch(() => {});
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pliki z hashem w nazwie — bezpiecznie brać z cache'a od ręki.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then(
        (trafienie) =>
          trafienie ||
          fetch(request).then((odp) => {
            zapisz(request, odp);
            return odp;
          }),
      ),
    );
    return;
  }

  // Nawigacja i cała reszta — najpierw sieć, cache tylko gdy jej nie ma.
  e.respondWith(
    fetch(request)
      .then((odp) => {
        zapisz(request.mode === 'navigate' ? '/' : request, odp);
        return odp;
      })
      .catch(() =>
        caches
          .match(request.mode === 'navigate' ? '/' : request)
          .then((r) => r || Response.error()),
      ),
  );
});
