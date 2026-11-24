'use strict';
const WalletEvidence=(()=>{
  let vault=null;
  const context=r=>'wallet-photo:'+r.wallet+':'+r.entry+':'+r.id;
  async function secure(next,prefix){
    vault=next;const database=await db();
    try{
      const rows=await new Promise((resolve,reject)=>{const r=database.transaction('photos').objectStore('photos').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      for(const row of rows){
        if(!row.wallet.startsWith(prefix)||row.sealed)continue;
        const sealed=await vault.seal(await row.blob.arrayBuffer(),context(row));
        await vault.open(sealed,context(row));
        const {blob,...metadata}=row;
        await new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite');tx.objectStore('photos').put({...metadata,sealed});tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('เข้ารหัสรูปเดิมไม่สำเร็จ'));});
      }
    }finally{database.close();}
  }
  function validate(existing,files){
    if(existing.length+files.length>6)throw new Error('แนบได้สูงสุด 6 รูป');
    for(const f of files)if(!['image/jpeg','image/png','image/webp'].includes(f.type)||!f.size||f.size>5*1024*1024)throw new Error('ใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB ต่อรูป');
  }
  function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('farm-wallet-evidence-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('เปิดพื้นที่เก็บรูปไม่ได้'));});}
  async function put(wallet,entry,files){
    validate([],files);
    const database=await db(),rows=files.map(file=>({id:crypto.randomUUID(),wallet,entry,name:file.name,type:file.type,size:file.size,blob:file}));
    try{const stored=await Promise.all(rows.map(async row=>{if(!vault)return row;const {blob,...metadata}=row;return {...metadata,sealed:await vault.seal(await blob.arrayBuffer(),context(row))};}));await new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite');stored.forEach(r=>tx.objectStore('photos').put(r));tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('บันทึกรูปไม่สำเร็จ กรุณาตรวจพื้นที่เครื่อง'));});return rows.map(({blob,...r})=>r);}finally{database.close();}
  }
  async function get(id,wallet,entry){const database=await db();try{const r=await new Promise((resolve,reject)=>{const request=database.transaction('photos').objectStore('photos').get(id);request.onsuccess=()=>{const r=request.result;if(!r||r.wallet!==wallet||r.entry!==entry)reject(new Error('ไม่พบรูปในเครื่องนี้'));else resolve(r);};request.onerror=()=>reject(new Error('อ่านรูปไม่สำเร็จ'));});if(r.sealed){if(!vault)throw new Error('กรุณาปลดล็อกกระเป๋า');return new Blob([await vault.open(r.sealed,context(r))],{type:r.type});}return r.blob;}finally{database.close();}}
  async function remove(ids){if(!ids.length)return;const database=await db();try{await new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite');ids.forEach(id=>tx.objectStore('photos').delete(id));tx.oncomplete=resolve;tx.onabort=tx.onerror=reject;});}finally{database.close();}}
  return {validate,put,get,remove,secure};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletEvidence;
