/* VELA service worker (v2)
 * - 빌드 때 이름에 해시가 붙는 코드·스타일·글꼴(/assets/…)과 아이콘은 폰/컴퓨터에 저장해 두고 바로 꺼내 씁니다. 이름이 바뀌면 새로 받으므로 옛 파일이 섞이지 않습니다.
 * - 화면(HTML)·상품 데이터·로그인·결제·서버 요청은 저장하지 않고 항상 최신으로 받습니다(상품·가격·주문이 오래된 값으로 보이지 않게).
 * - 인터넷이 끊긴 상태에서 페이지를 열면 안내 화면을 보여 줍니다.
 */
const VERSION = 'v2';
const STATIC = `vela-static-${VERSION}`;
const MAX_STATIC = 240;
const SHELL = ['/manifest.json', '/favicon.png', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC).then(cache => cache.addAll(SHELL)).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('vela-') && name !== STATIC).map(name => caches.delete(name)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch { /* optional */ } }
    await self.clients.claim();
  })());
});

const isStaticAsset = url => url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname));

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_STATIC) await Promise.all(keys.slice(0, keys.length - MAX_STATIC).map(key => cache.delete(key)));
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') { await cache.put(request, response.clone()); void trim(cache); }
  return response;
}

const offlinePage = () => new Response(
  '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VELA</title></head>' +
  '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0D0D0F;color:#f5f1e8;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
  '<div><h1 style="font-size:20px;margin:0 0 8px">인터넷 연결을 확인해 주세요</h1><p style="margin:0 0 20px;opacity:.7;font-size:14px">Check your internet connection.</p>' +
  '<button onclick="location.reload()" style="background:#c9a96a;color:#0D0D0F;border:0;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600">다시 시도 · Retry</button></div></body></html>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isStaticAsset(url)) { event.respondWith(cacheFirst(request).catch(() => fetch(request))); return; }
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try { return (await event.preloadResponse) || (await fetch(request)); } catch { return offlinePage(); }
    })());
  }
});
