function localR2(){
  const objects=new Map();
  return {
    objects,
    async put(key,value,options={}){objects.set(key,{bytes:new Uint8Array(value),httpMetadata:options.httpMetadata});return {key};},
    async get(key){const v=objects.get(key);return v?{size:v.bytes.length,httpMetadata:v.httpMetadata,arrayBuffer:async()=>v.bytes.slice().buffer}:null;}
  };
}
module.exports={localR2};
