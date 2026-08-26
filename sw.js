/* Service Worker — ให้เว็บใช้งานได้แบบออฟไลน์ (ติดตั้งเป็นแอพบนมือถือ)
   วิธี: network-first แล้วเก็บลง cache — เปิดเน็ตอยู่ก็ได้ข้อมูลใหม่เสมอ, ไม่มีเน็ตก็ใช้เวอร์ชันล่าสุดที่เคยโหลด
   ไฟล์จาก CDN/API ภายนอก (Leaflet, Open-Meteo, Nominatim) ไม่ cache — ใช้เน็ตตามปกติ */
const CACHE = "farmult-p1-local-graphic3d-1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return; // ภายนอก: ใช้เน็ตปกติ
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(m => m || Response.error()))
  );
});
