const CACHE_NAME = "watch-films-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/assets/styles/home.css",
  "/assets/scripts/home.js",
  "/assets/images/icons/icon-192x192.png",
  "/assets/images/icons/icon-512x512.png",
  "https://cdn.jsdelivr.net/npm/chart.js",
];

// Установка сервис-воркера и кэширование статических ресурсов
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Кэширование ресурсов");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Активация нового сервис-воркера
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Удаляем старый кэш:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Стратегия кэширования: сначала сеть, потом кэш
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если запрос успешен, сохраняем его копию в кэше
        if (event.request.method === "GET" && response.status === 200) {
          let responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Если запрос не удался, ищем в кэше
        return caches.match(event.request);
      })
  );
});
