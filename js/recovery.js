"use strict";

// One transaction retains both sides before a conflict is resolved; never store session tokens.
const Recovery = {
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("farmult-recovery-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("snapshots", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("ปิดแท็บเก่าแล้วลองสำรองอีกครั้ง"));
    });
  },
  async list(owner) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("snapshots", "readonly");
        const request = tx.objectStore("snapshots").getAll();
        tx.oncomplete = () => resolve(request.result.filter(x => x.owner === owner.toLowerCase()).sort((a, b) => b.createdAt - a.createdAt));
        tx.onabort = tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  },
  async save(owner, local, cloud, revision, reason) {
    const entry = { id: uid(), owner: owner.toLowerCase(), createdAt: Date.now(), revision, reason,
      local: JSON.parse(JSON.stringify(local)), cloud: cloud ? JSON.parse(JSON.stringify(cloud)) : null };
    const db = await this.open();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("snapshots", "readwrite");
        const store = tx.objectStore("snapshots");
        const request = store.getAll();
        request.onsuccess = () => {
          request.result.filter(x => x.owner === entry.owner).sort((a, b) => b.createdAt - a.createdAt).slice(4).forEach(x => store.delete(x.id));
          store.put(entry);
        };
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error || new Error("สำรองข้อมูลไม่สำเร็จ"));
      });
      return entry.id;
    } finally { db.close(); }
  }
};

function syncDifference(local, cloud) {
  const stable = value => JSON.stringify(value, function (_key, item) {
    return item && typeof item === "object" && !Array.isArray(item)
      ? Object.keys(item).sort().reduce((out, key) => { out[key] = item[key]; return out; }, {}) : item;
  });
  const groups = { plots: "แปลง", cycles: "รอบปลูก", tasks: "กิจกรรม", stock: "สต็อก", sales: "ใบเสร็จ", trials: "การทดลอง", equipment: "อุปกรณ์", workers: "คนงาน" };
  const result = Object.entries(groups).map(([key, label]) => {
    const left = Array.isArray(local[key]) ? local[key] : [];
    const right = Array.isArray(cloud[key]) ? cloud[key] : [];
    const id = (x, i) => x.id || "legacy-" + i;
    const l = new Map(left.map((x, i) => [id(x, i), x]));
    const r = new Map(right.map((x, i) => [id(x, i), x]));
    const names = records => records.map(x => String(x.title || x.name || x.plant || x.customer || (x.no ? "#" + x.no : x.id) || label));
    return { label, localCount: left.length, cloudCount: right.length,
      localOnly: names(left.filter((x, i) => !r.has(id(x, i)))),
      cloudOnly: names(right.filter((x, i) => !l.has(id(x, i)))),
      changed: names(left.filter((x, i) => r.has(id(x, i)) && stable(x) !== stable(r.get(id(x, i))))) };
  });
  const other = data => Object.fromEntries(Object.entries(data).filter(([key]) => !groups[key] && key !== "version"));
  return { groups: result, otherChanged: stable(other(local)) !== stable(other(cloud)) };
}
