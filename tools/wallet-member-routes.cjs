'use strict';
const path=require('node:path'),{createHash}=require('node:crypto');
const {readConfig,receiptCells}=require('./wallet-config.cjs');
const {createPinGate}=require('./wallet-pin.cjs');
const source=require('./wallet-lark-source.cjs');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function createMemberRoutes({auth,directory,env=process.env,fetcher=fetch,read=source,pinFactory=createPinGate}){
  const config=readConfig(env),{target}=config;
  const gates=new Map();
  function scopeOf(identity){return createHash('sha256').update(JSON.stringify([env.LARK_APP_ID,identity.tenant,identity.id])).digest('hex');}
  function gateFor(scope){if(!gates.has(scope))gates.set(scope,pinFactory(path.join(directory,scope+'.json')));return gates.get(scope);}
  async function bodyOf(req){let raw='',size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>2048)fail(413,'ข้อมูลใหญ่เกินกำหนด');raw+=chunk;}try{const body=JSON.parse(raw||'{}');if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body;}catch{fail(400,'ข้อมูลไม่ถูกต้อง');}}
  return async function member(req,url,send){
    const identity=await auth.authenticate(req.headers.cookie||''),scope=scopeOf(identity),gate=gateFor(scope),token=req.headers['x-wallet-session'];
    const action=url.pathname.slice('/__wallet/member/'.length);
    const context={owner:{id:identity.id,name:identity.name},target:{...target,team:null},baseUrl:config.baseUrl,defaultTeam:target.team,storageBase:'farm-wallet-read-v1:lark:'+scope,profileKey:'farm-wallet-receipt-profile-v1:lark:'+scope};
    if(action==='context')return send(200,JSON.stringify(context));
    if(req.headers['x-wallet-scope']!==context.storageBase)fail(401,'บัญชี Lark เปลี่ยนแล้ว กรุณาเปิดกระเป๋าใหม่');
    if(action.startsWith('pin/')){
      const method=action.slice(4);
      if(method==='status')return send(200,JSON.stringify(await gate.status()));
      if(method==='lock'||method==='touch')return send(200,JSON.stringify(gate[method](token)));
      if(!['setup','unlock','recovery','recover'].includes(method))return send(404,'{}');
      const body=await bodyOf(req);
      const result=method==='recover'?await gate.recover(body.code,body.pin):method==='recovery'?await gate.recovery(token,body.pin):await gate[method](body.pin);
      if(!auth.valid(req.headers.cookie||'')){if(result.token)gate.lock(result.token);fail(401,'กรุณาเข้าสู่ระบบ Lark อีกครั้ง');}
      return send(200,JSON.stringify(result));
    }
    if(!gate.valid(token))fail(401,'กรุณาปลดล็อกกระเป๋าของคุณก่อน');
    if(action==='config')return send(200,JSON.stringify({receiptCells:receiptCells(path.dirname(directory))}));
    const payer=url.searchParams.get('payer');
    if((payer!==null&&payer!==identity.id)||url.searchParams.has('team'))fail(403,'ดูได้เฉพาะรายการที่คุณเป็นผู้จ่าย');
    if(action==='payers')return send(200,JSON.stringify({payers:[context.owner],unassigned:0,source:context.target}));
    if(action==='lark'){
      const result=await read.readExpenses(env,fetcher,identity.id,null);
      if(!gate.valid(token)||!auth.valid(req.headers.cookie||''))fail(401,'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      return send(200,JSON.stringify(result));
    }
    if(action==='attachment'){
      const result=await read.readAttachment(env,fetcher,identity.id,url.searchParams.get('record'),Number(url.searchParams.get('index')??-1),url.searchParams.get('file'),null);
      if(!gate.valid(token)||!auth.valid(req.headers.cookie||''))fail(401,'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      return send(200,result.bytes,result.type);
    }
    return send(404,'{}');
  };
}
module.exports={createMemberRoutes};
