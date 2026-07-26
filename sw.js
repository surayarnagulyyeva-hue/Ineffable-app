const CACHE_NAME = "ineffable-v10"; // ← Her güncellemede +1 arttır!
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./grammar.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(ASSETS);
    }).catch(function(err){
      console.error("Cache oluşturulamadı:", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
          .map(function(key){ return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(function(response){
        // Sadece geçerli yanıtları cache'le
        if(!response || response.status !== 200 || response.type !== "basic"){
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){
          cache.put(event.request, copy);
        }).catch(function(err){
          console.warn("Cache'e yazılamadı:", err);
        });
        return response;
      })
      .catch(function(){
        return caches.match(event.request).then(function(cached){
          if(cached) return cached;
          if(event.request.mode === "navigate"){
            return caches.match("./index.html");
          }
        });
      })
  );
});
