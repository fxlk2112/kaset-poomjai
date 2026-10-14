'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {randomBytes,scrypt:derive,timingSafeEqual,createHash}=require('node:crypto');
const {promisify}=require('node:util'),scrypt=promisify(derive);
const IDLE=5*60*1000,ABSOLUTE=30*60*1000,COOLDOWN=15*60*1000;
function error(status,message,retryAfter=0){return Object.assign(new Error(message),{status,retryAfter});}
function createPinGate(file,{now=Date.now}={}){
  const sessions=new Map();let queue=Promise.resolve();
  const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
  async function read(){
    let value;try{value=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw error(503,'อ่านการตั้งค่า PIN ไม่สำเร็จ กรุณาตรวจเซิร์ฟเวอร์');}
    if(value.version!==1||!/^([a-f0-9]{32})$/.test(value.salt)||!/^([a-f0-9]{128})$/.test(value.hash)||!/^([a-f0-9]{64})$/.test(value.key)||!Number.isInteger(value.failures)||value.failures<0||!Number.isFinite(value.blockedUntil))throw error(503,'การตั้งค่า PIN ไม่สมบูรณ์');
    if(value.recoveryHash!==undefined&&(!/^[a-f0-9]{64}$/.test(value.recoveryHash)||!Number.isInteger(value.recoveryFailures)||value.recoveryFailures<0||!Number.isFinite(value.recoveryBlockedUntil)))throw error(503,'การตั้งค่ารหัสกู้คืนไม่สมบูรณ์');
    return value;
  }
  async function write(value,first=false){
    await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
    if(first){try{await fs.writeFile(file,JSON.stringify(value),{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')throw error(409,'ตั้ง PIN แล้ว กรุณาปลดล็อก');throw e;}return;}
    const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
    try{await fs.writeFile(tmp,JSON.stringify(value),{flag:'wx',mode:0o600});await fs.rename(tmp,file);}finally{await fs.unlink(tmp).catch(()=>{});}
  }
  const hash=(pin,salt)=>scrypt(pin,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  function valid(token){
    const s=typeof token==='string'?sessions.get(token):null;
    if(!s||now()>=s.expiresAt||now()>=s.lastActive+IDLE){if(s)sessions.delete(token);return false;}return true;
  }
  function issue(value){
    for(const token of sessions.keys())valid(token);
    if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
    const token=randomBytes(32).toString('hex'),expiresAt=now()+ABSOLUTE;
    sessions.set(token,{expiresAt,lastActive:now()});return {token,key:value.key,expiresAt,idleMs:IDLE};
  }
  async function status(){return {configured:!!await read()};}
  const recoveryDigest=code=>createHash('sha256').update(code).digest();
  function rotateRecovery(value){
    const code=randomBytes(20).toString('hex').toUpperCase().match(/.{4}/g).join('-');
    value.recoveryHash=recoveryDigest(code.replaceAll('-','')).toString('hex');value.recoveryFailures=0;value.recoveryBlockedUntil=0;return code;
  }
  const setup=pin=>serial(async()=>{
    if(await read())throw error(409,'ตั้ง PIN แล้ว กรุณาปลดล็อก');
    if(typeof pin!=='string'||!/^\d{6}$/.test(pin))throw error(400,'ใช้ PIN ตัวเลข 6 หลัก');
    const salt=randomBytes(16).toString('hex'),value={version:1,salt,hash:(await hash(pin,salt)).toString('hex'),key:randomBytes(32).toString('hex'),failures:0,blockedUntil:0};
    const recoveryCode=rotateRecovery(value);await write(value,true);return {...issue(value),recoveryCode};
  });
  async function verifyPin(pin){
    const value=await read();if(!value)throw error(409,'กรุณาตั้ง PIN ก่อน');
    const remaining=value.blockedUntil-now();if(remaining>0)throw error(429,'ลอง PIN ผิดหลายครั้ง กรุณารอ '+Math.ceil(remaining/60000)+' นาที',Math.ceil(remaining/1000));
    if(value.blockedUntil){value.failures=0;value.blockedUntil=0;}
    const wellFormed=typeof pin==='string'&&/^\d{6}$/.test(pin);
    const match=wellFormed&&timingSafeEqual(await hash(pin,value.salt),Buffer.from(value.hash,'hex'));
    if(!match){value.failures++;if(value.failures>=5)value.blockedUntil=now()+COOLDOWN;await write(value);throw error(value.blockedUntil?429:401,value.blockedUntil?'ลอง PIN ผิด 5 ครั้ง กรุณารอ 15 นาที':'PIN ไม่ถูกต้อง',value.blockedUntil?COOLDOWN/1000:0);}
    value.failures=0;value.blockedUntil=0;return value;
  }
  const unlock=pin=>serial(async()=>{const value=await verifyPin(pin);await write(value);return issue(value);});
  const recovery= (token,pin)=>serial(async()=>{
    if(!valid(token))throw error(401,'กรุณาปลดล็อกกระเป๋าก่อน');
    const value=await verifyPin(pin);
    if(!valid(token))throw error(401,'กรุณาปลดล็อกกระเป๋าอีกครั้ง');
    const recoveryCode=rotateRecovery(value);await write(value);return {recoveryCode};
  });
  const recover=(code,pin)=>serial(async()=>{
    const value=await read();if(!value?.recoveryHash)throw error(409,'ยังไม่มีรหัสกู้คืน ต้องปลดล็อกด้วย PIN เดิมเพื่อสร้างรหัสก่อน');
    const remaining=value.recoveryBlockedUntil-now();if(remaining>0)throw error(429,'ลองรหัสกู้คืนผิดหลายครั้ง กรุณารอ '+Math.ceil(remaining/60000)+' นาที',Math.ceil(remaining/1000));
    if(typeof pin!=='string'||!/^\d{6}$/.test(pin))throw error(400,'ใช้ PIN ใหม่ตัวเลข 6 หลัก');
    if(value.recoveryBlockedUntil){value.recoveryFailures=0;value.recoveryBlockedUntil=0;}
    const normalized=typeof code==='string'?code.replace(/[-\s]/g,'').toUpperCase():'';
    if(!/^[A-F0-9]{40}$/.test(normalized)||!timingSafeEqual(recoveryDigest(normalized),Buffer.from(value.recoveryHash,'hex'))){
      value.recoveryFailures++;if(value.recoveryFailures>=5)value.recoveryBlockedUntil=now()+COOLDOWN;await write(value);
      throw error(value.recoveryBlockedUntil?429:401,value.recoveryBlockedUntil?'ลองรหัสกู้คืนผิด 5 ครั้ง กรุณารอ 15 นาที':'รหัสกู้คืนไม่ถูกต้องหรือใช้ไปแล้ว',value.recoveryBlockedUntil?COOLDOWN/1000:0);
    }
    value.salt=randomBytes(16).toString('hex');value.hash=(await hash(pin,value.salt)).toString('hex');value.failures=0;value.blockedUntil=0;
    // Retain the vault key so resetting the PIN never strands existing records or photos.
    const recoveryCode=rotateRecovery(value);await write(value);sessions.clear();return {...issue(value),recoveryCode};
  });
  function touch(token){if(!valid(token))throw error(401,'กรุณาปลดล็อกกระเป๋าอีกครั้ง');sessions.get(token).lastActive=now();return {ok:true};}
  function lock(token){if(!valid(token))throw error(401,'กรุณาปลดล็อกกระเป๋าอีกครั้ง');sessions.clear();return {ok:true};}
  return {status,setup,unlock,valid,touch,lock,recovery,recover};
}
module.exports={createPinGate,IDLE,ABSOLUTE,COOLDOWN};
