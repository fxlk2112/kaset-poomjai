'use strict';
const WalletVault=(()=>{
  const prefix='farm-wallet-encrypted-v1:';
  async function create(hex,storage){
    if(!/^[a-f0-9]{64}$/.test(hex))throw new Error('กุญแจข้อมูลไม่ถูกต้อง');
    const key=await crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);
    const memory=new Map(),enc=new TextEncoder(),dec=new TextDecoder();let active=true,queue=Promise.resolve();
    function check(){if(!active)throw new Error('กระเป๋าถูกล็อกแล้ว');}
    async function seal(bytes,context){check();const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(context)},key,bytes);check();return {version:1,iv:Array.from(iv),data:Array.from(new Uint8Array(data))};}
    async function open(value,context){check();if(value?.version!==1||!Array.isArray(value.iv)||value.iv.length!==12||!Array.isArray(value.data))throw new Error('ข้อมูลเข้ารหัสไม่สมบูรณ์');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(value.iv),additionalData:enc.encode(context)},key,Uint8Array.from(value.data));check();return plain;}
    function setItem(name,value){
      const task=queue.then(async()=>{check();const sealed=JSON.stringify(await seal(enc.encode(value),name));storage.setItem(prefix+name,sealed);memory.set(name,value);});queue=task.catch(()=>{});return task;
    }
    async function load(names){
      for(const name of names){
        const sealed=storage.getItem(prefix+name),old=storage.getItem(name);
        if(sealed!==null){memory.set(name,dec.decode(await open(JSON.parse(sealed),name)));if(old!==null)storage.removeItem(name);}
        else if(old!==null){await setItem(name,old);if(dec.decode(await open(JSON.parse(storage.getItem(prefix+name)),name))!==old)throw new Error('ตรวจสอบข้อมูลเดิมไม่สำเร็จ');storage.removeItem(name);}
      }
    }
    return {load,getItem:name=>{check();return memory.get(name)??null;},setItem,seal,open,clear(){active=false;memory.clear();}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletVault;
