const CACHE_NAME = "gohigher-cache-v7"; // 캐시 버전 업데이트
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

// **fetch: 네트워크 우선 + 실패 시 캐시 fallback**
self.addEventListener("fetch", (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone()); // 최신 데이터 캐싱
                    return response;
                });
            })
            .catch(() => {
                // 네트워크 실패 시 캐시 사용
                return caches.match(event.request);
            })
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

// **백그라운드 동기화 (event.tag 구분)**
self.addEventListener("sync", (event) => {
    if (event.tag === "background-sync") {
        event.waitUntil(
            fetch("/api/sync")
                .then(response => response.json())
                .then(data => {
                    console.log("[Service Worker] Background Sync Successful", data);
                })
                .catch(error => {
                    console.error("[Service Worker] Background Sync Failed", error);
                })
        );
    } else if (event.tag === "sync-user-actions") {
        event.waitUntil(
            (async () => {
                const db = await openDatabase();
                const unsyncedActions = await getUnsyncedActions(db);

                for (const action of unsyncedActions) {
                    try {
                        await fetch("/api/user-actions", {
                            method: "POST",
                            body: JSON.stringify(action),
                            headers: { "Content-Type": "application/json" }
                        });
                        await markActionAsSynced(db, action.id);
                    } catch (error) {
                        console.error("[Service Worker] Failed to sync action", error);
                    }
                }
            })()
        );
    }
});

// IndexedDB 함수들
function openDatabase() { /* ... */ }
function getUnsyncedActions(db) { /* ... */ }
function markActionAsSynced(db, id) { /* ... */ }

// 푸시 알림
self.addEventListener("push", (event) => {
    let data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || "GoHigher 알림", {
            body: data.body || "새로운 알림이 도착했습니다!",
            icon: "/icon-192x192.png",
            badge: "/icon-192x192.png",
            data: { url: data.url || "/" },
            actions: [{ action: "open", title: "열기" }]
        })
    );
});

// 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
