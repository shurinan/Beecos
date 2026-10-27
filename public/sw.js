// Service worker do Beecos. De propósito não guarda páginas nem dados em cache:
// assim ninguém fica preso numa versão antiga do app depois de uma publicação.
// Faz três coisas: página de "sem internet", clique nos avisos e (futuramente) push.
const OFFLINE_CACHE = "beecos-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((c) => c.add("/offline.html")));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/mensagens", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => ("navigate" in c ? c.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// Aviso enviado por um servidor (Web Push), quando esse envio for configurado.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    /* ignora corpo inválido */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Beecos", {
      body: data.body || "Você tem uma nova mensagem",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.url || "beecos",
      data: { url: data.url || "/mensagens" },
    }),
  );
});
