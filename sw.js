/* eslint-env serviceworker */
/**
 * Trading Research Office service worker.
 *
 * Caching policy:
 *  - Only the static app shell is cached, and only same-origin requests.
 *  - Anything cross-origin (the research bridge lives on another origin) is
 *    passed straight through, so an authenticated snapshot can never be stored.
 *  - Any request carrying an Authorization header is passed through untouched.
 *
 * Push policy:
 *  - The bridge sends { title, body, alert_id, kind, expires_at_ms, mode,
 *    live_eligible }. Only alert_id, kind, expires_at_ms and the paper flags are
 *    used; the notification wording is written here, so a payload string can
 *    never introduce a price, a quantity or a claim about readiness.
 *  - A payload that is not tagged paper-only is refused outright.
 *  - Records whose recorded expiry has already passed are not surfaced as
 *    something to act on, and expiry is never extended by delivery delay.
 */

const CACHE_PREFIX = 'trading-office-shell:' + new URL(self.registration.scope).pathname + ':';
const CACHE_NAME = CACHE_PREFIX + '14b21d26d91aca10';
const NOTIFICATION_TAG = 'research-record';
const SHELL = ["./","./assets/ibm-plex-mono-cyrillic-400-normal-BSMlKf0J.woff2","./assets/ibm-plex-mono-cyrillic-400-normal-CEL4l2ZJ.woff","./assets/ibm-plex-mono-cyrillic-500-normal-Ael50iVv.woff","./assets/ibm-plex-mono-cyrillic-500-normal-Bq9vWWag.woff2","./assets/ibm-plex-mono-cyrillic-ext-400-normal-DMdlQ8Kv.woff","./assets/ibm-plex-mono-cyrillic-ext-400-normal-xuaO2J-f.woff2","./assets/ibm-plex-mono-cyrillic-ext-500-normal-BIfNGwUT.woff","./assets/ibm-plex-mono-cyrillic-ext-500-normal-BqneJy0T.woff2","./assets/ibm-plex-mono-latin-400-normal-CvHOgSBP.woff","./assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2","./assets/ibm-plex-mono-latin-500-normal-CB9ihrfo.woff","./assets/ibm-plex-mono-latin-500-normal-DSY6xOcd.woff2","./assets/ibm-plex-mono-latin-ext-400-normal-BmRBH3aV.woff2","./assets/ibm-plex-mono-latin-ext-400-normal-D3D2R8hC.woff","./assets/ibm-plex-mono-latin-ext-500-normal-CAhNIIs5.woff2","./assets/ibm-plex-mono-latin-ext-500-normal-CZ70TYgx.woff","./assets/ibm-plex-mono-vietnamese-400-normal-BulugwFq.woff2","./assets/ibm-plex-mono-vietnamese-400-normal-DDuiU_S-.woff","./assets/ibm-plex-mono-vietnamese-500-normal-C8zxqsMH.woff","./assets/ibm-plex-mono-vietnamese-500-normal-DZ4AoWbu.woff2","./assets/ibm-plex-sans-cyrillic-400-normal-BTotfTJu.woff","./assets/ibm-plex-sans-cyrillic-400-normal-DZqxrq2p.woff2","./assets/ibm-plex-sans-cyrillic-500-normal-ByOcLdNv.woff","./assets/ibm-plex-sans-cyrillic-500-normal-CocWQlwt.woff2","./assets/ibm-plex-sans-cyrillic-600-normal-71GNu3SW.woff2","./assets/ibm-plex-sans-cyrillic-600-normal-BGq0mW3O.woff","./assets/ibm-plex-sans-cyrillic-ext-400-normal-Dsrv2Tcn.woff","./assets/ibm-plex-sans-cyrillic-ext-400-normal-g30qAdWV.woff2","./assets/ibm-plex-sans-cyrillic-ext-500-normal-Cs5J6C77.woff2","./assets/ibm-plex-sans-cyrillic-ext-500-normal-DB5PtV2g.woff","./assets/ibm-plex-sans-cyrillic-ext-600-normal-Bz0x94Yp.woff","./assets/ibm-plex-sans-cyrillic-ext-600-normal-DUMzJB7m.woff2","./assets/ibm-plex-sans-greek-400-normal-D9ESIMu3.woff","./assets/ibm-plex-sans-greek-400-normal-_efipK4i.woff2","./assets/ibm-plex-sans-greek-500-normal-CuWXN6rf.woff","./assets/ibm-plex-sans-greek-500-normal-JMMifIXV.woff2","./assets/ibm-plex-sans-greek-600-normal-D-CqTdkO.woff","./assets/ibm-plex-sans-greek-600-normal-DzTrcv_p.woff2","./assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2","./assets/ibm-plex-sans-latin-400-normal-CYLoc0-x.woff","./assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2","./assets/ibm-plex-sans-latin-500-normal-BgVn5rGT.woff","./assets/ibm-plex-sans-latin-600-normal-Cu4Hd6ag.woff","./assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2","./assets/ibm-plex-sans-latin-ext-400-normal-C5H60-Va.woff2","./assets/ibm-plex-sans-latin-ext-400-normal-RBey6euL.woff","./assets/ibm-plex-sans-latin-ext-500-normal-D0aIdm-b.woff","./assets/ibm-plex-sans-latin-ext-500-normal-DakdToA3.woff2","./assets/ibm-plex-sans-latin-ext-600-normal-DIrixKbi.woff","./assets/ibm-plex-sans-latin-ext-600-normal-DOrvGEcy.woff2","./assets/ibm-plex-sans-vietnamese-400-normal-DG4YqDda.woff2","./assets/ibm-plex-sans-vietnamese-400-normal-fK1oJ5dG.woff","./assets/ibm-plex-sans-vietnamese-500-normal-BEb3_waV.woff","./assets/ibm-plex-sans-vietnamese-500-normal-e4dixQRQ.woff2","./assets/ibm-plex-sans-vietnamese-600-normal-DgdngZtN.woff","./assets/ibm-plex-sans-vietnamese-600-normal-DpPYBSTl.woff2","./assets/index-Amio3X3C.css","./assets/index-DYDjlSIk.js","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./manifest.webmanifest"];
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isShellRequest(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('Authorization')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.includes('/api/')) return false;
  return SHELL_URLS.has(url.origin + url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isShellRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then(cache => cache.match(new URL('./index.html', self.registration.scope).href, { ignoreSearch: true, ignoreVary: true })).then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request, { ignoreVary: true })).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    }),
  );
});

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    const parsed = event.data.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Positive whole milliseconds only; anything else is not a time. */
function timestampOrNull(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const paperOnly = payload.mode === 'PAPER' && payload.live_eligible === false;
  const alertId = typeof payload.alert_id === 'string' && payload.alert_id.length > 0 ? payload.alert_id : null;
  const isTest = payload.kind === 'test';
  const expiresAtMs = timestampOrNull(payload.expires_at_ms);
  const expired = expiresAtMs !== null && expiresAtMs <= Date.now();
  const validDeadline = expiresAtMs !== null && expiresAtMs <= Date.now() + 60_000;

  // userVisibleOnly subscriptions must show something, so a refused, expired or
  // unusable record is downgraded to a plainly-worded notice rather than being
  // presented as something to review.
  let title;
  let body;
  if (!paperOnly || !validDeadline || !alertId) {
    title = 'Notice refused';
    body = 'An invalid or unverified notification was received. No trade or order was created.';
  } else if (expired) {
    title = 'Expired before delivery';
    body = 'A paper research record expired before this device received it. There is nothing to review.';
  } else if (isTest) {
    title = 'Notification test';
    body = 'This is a delivery test only. No trade or order was created.';
  } else {
    title = 'Paper review record';
    body =
      'A paper research record is waiting for review. Open the app to read it. Paper only — nothing was ordered and no market readiness is implied.';
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // Per-record tagging so two live records do not silently replace each
      // other, while repeats of the same record still collapse.
      tag: alertId && paperOnly && !expired ? `${NOTIFICATION_TAG}:${alertId}` : NOTIFICATION_TAG,
      renotify: false,
      requireInteraction: false,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { route: '#/alerts' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./#/alerts', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
