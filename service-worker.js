const CACHE_NAME = "gohigher-cache-v3"; // 캐시 버전 변경 (반드시 증가)
const urlsToCache = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/logo.jpg"
];

// 서비스 워커 설치 및 캐싱
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[Service Worker] Caching essential files...");
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting(); // 즉시 활성화
});

// 네트워크 우선(fetch 이벤트)
self.addEventListener("fetch", (event) => {
    event.respondWith(
        fetch(event.request) // 네트워크 요청 우선
        .then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response.clone()); // 최신 데이터 캐싱
                return response;
            });
        })
        .catch(() => caches.match(event.request)) // 네트워크 실패 시 캐시 사용
    );
});

// 기존 캐시 삭제 (새 버전 적용)
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

// 서비스 워커 업데이트 알림 (클라이언트에게 새 버전 알림)
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "NEW_VERSION") {
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
            });
        });
    }
});
