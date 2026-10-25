// Daybook's service worker: keeps the app shell (the four screens' pages, their scripts and styles,
// the font, the icons) so the app opens with no connection. It never keeps data or `/api/`: the
// screens ask Firestore from the page, and the page itself shows the no-connection screen.

const SHELL_CACHE = "daybook-shell-v2";
// Hashed files under /_next/static never change, so they are kept once and trimmed oldest first.
const STATIC_CACHE = "daybook-static-v2";
const STATIC_LIMIT = 200;
const ROUTES = ["/", "/spending", "/transactions", "/categories"];
const EXTRAS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const STATIC_PATTERN = /\/_next\/static\/[^"'\s\\)<>]+/g;

/** The /_next/static files a page names in its scripts, styles, preloads and inline data. */
function staticFilesIn(html) {
  const found = new Set();
  for (const match of html.matchAll(STATIC_PATTERN)) found.add(match[0].replace(/\\u0026/g, "&"));
  return [...found];
}

async function trimStatic(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map((key) => cache.delete(key)));
}

/** Keeps a page and the static files it names. Does nothing if the page can't be fetched. */
async function keepRoute(route, response) {
  const html = await response.clone().text();
  const shell = await caches.open(SHELL_CACHE);
  await shell.put(route, response);
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    staticFilesIn(html).map(async (file) => {
      if (await statics.match(file)) return;
      try {
        const res = await fetch(file);
        if (res.ok) await statics.put(file, res);
      } catch {
        // Offered again on the next visit.
      }
    })
  );
  await trimStatic(statics);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(EXTRAS);
      await Promise.all(
        ROUTES.map(async (route) => {
          const res = await fetch(route, { cache: "reload" });
          if (res.ok) await keepRoute(route, res);
        })
      );
      await self.skipWaiting();
    })()
  );
});

// Replaces every older cache (the previous app's `spending-tracker-v1` too).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Data and the reading of screenshots always go to the network.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // A screen's page is the same whatever the query string says (filters live there).
    if (!ROUTES.includes(url.pathname)) return;
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) event.waitUntil(keepRoute(url.pathname, res.clone()).catch(() => {}));
          return res;
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: SHELL_CACHE })) || Response.error())
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request, { cacheName: STATIC_CACHE }).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(
                caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy).then(() => trimStatic(cache)))
              );
            }
            return res;
          })
      )
    );
    return;
  }

  if (EXTRAS.includes(url.pathname)) {
    event.respondWith(caches.match(request, { cacheName: SHELL_CACHE }).then((cached) => cached || fetch(request)));
  }
  // Everything else (page-data requests, images, other routes) is left to the network.
});
