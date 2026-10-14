'use strict';
const WalletImageCache=(()=>{
  function create({maxBytes=40*1024*1024,ttl=120000,now=Date.now}={}){
    const entries=new Map(),pending=new Map();let bytes=0;
    function remove(key){const old=entries.get(key);if(old){bytes-=old.size;entries.delete(key);}}
    async function get(key,loader){
      for(const [id,e] of entries)if(e.until<=now())remove(id);
      const hit=entries.get(key);if(hit){entries.delete(key);entries.set(key,hit);return hit.value;}
      if(pending.has(key))return pending.get(key);
      const request=Promise.resolve().then(loader).then(value=>{
        const size=value.size??value.bytes?.length;
        if(Number.isFinite(size)&&size>0&&size<=maxBytes){
          while(bytes+size>maxBytes&&entries.size)remove(entries.keys().next().value);
          entries.set(key,{value,size,until:now()+ttl});bytes+=size;
        }
        return value;
      }).finally(()=>pending.delete(key));
      pending.set(key,request);return request;
    }
    return {get};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletImageCache;
