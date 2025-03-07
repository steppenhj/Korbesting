const CACHE_NAME = "gohigher-cache-v4"; // 캐시 버전 업데이트
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

// 네트워크 우선(fetch 이벤트) - 기존 방식 유지
self.addEventListener("fetch", (event) => {
    event.respondWith(
        fetch(event.request)
        .then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response.clone());
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

// 백그라운드 동기화 지원
self.addEventListener("sync", (event) => {
    if (event.tag === "background-sync") {
        event.waitUntil(
            fetch("/api/sync")
            .then(() => console.log("[Service Worker] Background Sync Successful"))
            .catch(() => console.log("[Service Worker] Background Sync Failed"))
        );
    }
});

// 푸시 알림 수신
self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || "알림", {
            body: data.body || "새로운 알림이 도착했습니다!",
            icon: "/icon-192x192.png",
            badge: "/icon-192x192.png"
        })
    );
});

// PWA 설치 감지
self.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    self.deferredPrompt = event;
    console.log("[Service Worker] PWA 설치 가능!");
});
