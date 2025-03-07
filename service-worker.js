const CACHE_NAME = "gohigher-cache-v8"; // 캐시 버전 업데이트
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

// 네트워크 우선(fetch 이벤트) - 로컬 데이터 저장 기능 유지
self.addEventListener("fetch", (event) => {
    event.respondWith(
        fetch(event.request)
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

// **백그라운드 동기화 지원 (명확한 등록 추가)**
self.addEventListener("sync", (event) => {
    if (event.tag === "sync-user-actions") {
        event.waitUntil(syncUserActions());
    }
});

async function syncUserActions() {
    try {
        console.log("[Service Worker] Attempting background sync...");
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
                console.log("[Service Worker] Synced action:", action);
            } catch (error) {
                console.error("[Service Worker] Failed to sync action", error);
                throw error; // Sync 재시도를 위해 throw
            }
        }
        console.log("[Service Worker] Background Sync Complete!");
    } catch (error) {
        console.error("[Service Worker] Background Sync Failed", error);
    }
}

// **클라이언트에서 명확하게 sync 요청하는 코드 추가**
function registerSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((swRegistration) => {
            swRegistration.sync.register("sync-user-actions").then(() => {
                console.log("[Service Worker] Sync registered successfully");
            }).catch((error) => {
                console.error("[Service Worker] Sync registration failed:", error);
            });
        });
    } else {
        console.warn("[Service Worker] Background Sync is not supported in this browser.");
    }
}

// **IndexedDB를 활용한 로컬 데이터 저장 및 동기화 기능**
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("PWA_DB", 1);
        request.onerror = () => reject("IndexedDB open failed");
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore("user-actions", { keyPath: "id", autoIncrement: true });
        };
    });
}

function getUnsyncedActions(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("user-actions", "readonly");
        const store = transaction.objectStore("user-actions");
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.filter(action => !action.synced));
        request.onerror = () => reject("Failed to fetch actions");
    });
}

function markActionAsSynced(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("user-actions", "readwrite");
        const store = transaction.objectStore("user-actions");
        const request = store.put({ id, synced: true });
        request.onsuccess = resolve;
        request.onerror = () => reject("Failed to mark action as synced");
    });
}

// **클라이언트에서 registerSync() 실행하여 동기화 요청 (클라이언트 JS 코드에 추가)**
registerSync();
