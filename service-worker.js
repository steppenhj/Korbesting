const CACHE_NAME = "gohigher-cache-v2"; // 새 버전으로 변경할 때 숫자 증가
const urlsToCache = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/logo.jpg"  // <-- logo.jpg 추가!
  ];
  

// 설치 이벤트 - 리소스 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell...");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); // 즉시 활성화
});

// 요청 가로채기 - 캐시된 파일 제공 or 네트워크 요청
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// 활성화 이벤트 - 이전 캐시 삭제 (유저 데이터는 유지)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 새로운 서비스 워커가 있으면 알림 보내기
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "NEW_VERSION") {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
      });
    });
  }
});