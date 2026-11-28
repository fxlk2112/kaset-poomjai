'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {readExpenses,readPayers,readAttachment}=require('./wallet-lark-source.cjs');
const {loadPrivateEnv,readConfig,receiptCells}=require('./wallet-config.cjs');
const env=loadPrivateEnv(),config=readConfig(env),{owner}=config;
if(!owner)throw new Error('Configure the legacy wallet owner before starting this preview');
const {createPinGate}=require('./wallet-pin.cjs');
const pin=createPinGate(path.join(__dirname,'.wallet-private','pin.json'));
const port=Number(process.argv[2]||4208),origin=`http://127.0.0.1:${port}`,root=path.resolve(__dirname,'..');
const {createLarkAuth}=require('./wallet-lark-auth.cjs');
const {createMemberRoutes}=require('./wallet-member-routes.cjs');
const larkAuth=createLarkAuth({origin,env,onDiagnostic:event=>{
  if(process.env.LARK_WALLET_AUTH_DIAGNOSTICS==='1')console.warn('wallet-lark-auth',JSON.stringify(event));
}});
const memberRoutes=createMemberRoutes({auth:larkAuth,env,directory:path.join(__dirname,'.wallet-private','members')});
const assets=new Map([
  ['/','wallet-preview.html'],['/wallet-preview.html','wallet-preview.html'],
  ['/css/wallet-preview.css','css/wallet-preview.css'],['/css/wallet-read.css','css/wallet-read.css'],
  ['/js/wallet-lark-read.js','js/wallet-lark-read.js'],['/js/wallet-read-ui.js','js/wallet-read-ui.js'],['/js/wallet-evidence.js','js/wallet-evidence.js'],['/js/lucide.min.js','js/lucide.min.js'],['/logo.jpg','logo.jpg']
]);
const pending=new Map();
assets.set('/js/wallet-image-cache.js','js/wallet-image-cache.js');
for(const file of ['js/wallet-receipt-template.js','js/wallet-receipt.js','css/wallet-receipt.css','assets/wallet-receipt/logo.png'])assets.set('/'+file,file);
for(const file of ['js/wallet-vault.js','js/wallet-access.js','css/wallet-access.css'])assets.set('/'+file,file);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  const send=(code,body,type='application/json; charset=utf-8',headers={})=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"frame-ancestors 'none'",...headers});res.end(body);};
  try{
    if(req.headers.host!==`127.0.0.1:${port}`)return send(403,'{}');
    const url=new URL(req.url,origin);
    if(url.pathname==='/__wallet/oauth/callback'&&req.method==='GET'){
      try{
        const result=await larkAuth.complete({state:url.searchParams.get('state'),code:url.searchParams.get('code'),error:url.searchParams.get('error'),cookie:req.headers.cookie||''});
        return send(303,'','text/plain',{'Location':'/wallet-preview.html?mode=lark','Set-Cookie':[result.sessionCookie,larkAuth.clearStateCookie()]});
      }catch{return send(303,'','text/plain',{'Location':'/wallet-preview.html?mode=lark&authError=1','Set-Cookie':larkAuth.clearStateCookie()});}
    }
    if(url.pathname.startsWith('/__wallet/')){
      if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-wallet-preview']!=='1')return send(403,'{}');
      if(url.pathname==='/__wallet/oauth/config')return send(200,JSON.stringify(larkAuth.config()));
      if(url.pathname==='/__wallet/oauth/start'){const result=larkAuth.begin(),cleared=larkAuth.logout(req.headers.cookie||'');return send(200,JSON.stringify({url:result.url}),undefined,{'Set-Cookie':[result.stateCookie,cleared.sessionCookie]});}
      if(url.pathname==='/__wallet/oauth/logout'){const result=larkAuth.logout(req.headers.cookie||'');return send(200,'{"ok":true}',undefined,{'Set-Cookie':result.sessionCookie});}
      if(url.pathname.startsWith('/__wallet/member/'))return await memberRoutes(req,url,send);
      const token=req.headers['x-wallet-session'];
      if(url.pathname.startsWith('/__wallet/pin/')){
        const action=url.pathname.slice('/__wallet/pin/'.length);
        if(action==='status')return send(200,JSON.stringify(await pin.status()));
        if(action==='lock'||action==='touch')return send(200,JSON.stringify(pin[action](token)));
        if(!['setup','unlock','recovery','recover'].includes(action))return send(404,'{}');
        let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)return send(413,'{}');raw+=chunk;}
        let body;try{body=JSON.parse(raw);}catch{return send(400,JSON.stringify({error:'ข้อมูล PIN ไม่ถูกต้อง'}));}
        if(!body||typeof body!=='object'||Array.isArray(body))return send(400,'{}');
        const result=action==='recover'?await pin.recover(body.code,body.pin):action==='recovery'?await pin.recovery(token,body.pin):await pin[action](body.pin);
        return send(200,JSON.stringify(result));
      }
      if(!pin.valid(token))return send(401,JSON.stringify({error:'กรุณาปลดล็อกกระเป๋าก่อน'}));
      if(url.pathname==='/__wallet/context')return send(200,JSON.stringify({...config,receiptCells:receiptCells()}));
    }
    if(url.pathname==='/__wallet/attachment'){
      if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-wallet-preview']!=='1')return send(403,'{}');
      if(url.searchParams.get('payer')!==owner.id)return send(403,JSON.stringify({error:'กระเป๋านี้อ่านเฉพาะเจ้าของที่ตั้งค่าไว้'}));
      const result=await readAttachment(env,fetch,url.searchParams.get('payer'),url.searchParams.get('record'),Number(url.searchParams.get('index')??-1),url.searchParams.get('file'));
      if(!pin.valid(req.headers['x-wallet-session']))return send(401,'{}');
      return send(200,result.bytes,result.type);
    }
    if(['/__wallet/lark','/__wallet/payers'].includes(url.pathname)){
      if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-wallet-preview']!=='1')return send(403,'{}');
      const payerId=url.searchParams.get('payer'),requestKey=url.pathname+':'+(payerId||'');
      if(url.pathname==='/__wallet/lark'&&payerId!==owner.id)return send(403,JSON.stringify({error:'กระเป๋านี้อ่านเฉพาะเจ้าของที่ตั้งค่าไว้'}));
      if(!pending.has(requestKey))pending.set(requestKey,(url.pathname==='/__wallet/payers'?readPayers(env,fetch,owner.id):readExpenses(env,fetch,payerId)).finally(()=>{pending.delete(requestKey);}));
      const result=await pending.get(requestKey);if(!pin.valid(req.headers['x-wallet-session']))return send(401,'{}');
      return send(200,JSON.stringify(result));
    }
    if(req.method!=='GET'||!assets.has(url.pathname))return send(404,'{}');
    const file=assets.get(url.pathname);return send(200,await fs.readFile(path.join(root,file)),types[path.extname(file)]);
  }catch(error){return send(error.status||502,JSON.stringify({error:error.status?error.message:error.name==='TimeoutError'?'Lark ตอบช้า ลองอัปเดตอีกครั้ง':'เซิร์ฟเวอร์อ่านข้อมูลไม่สำเร็จ',retryAfter:error.retryAfter||0}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Read-only FIN-EXPENSE main Base preview: ${origin}/wallet-preview.html`));
