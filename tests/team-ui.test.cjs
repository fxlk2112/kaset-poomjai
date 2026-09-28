const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
  let html='',confirm;
  const ctx=vm.createContext({URL,Date,location:{href:'https://farm.example/'},Auth:{session:{token:'owner'}},PrivatePhotos:{configure(){}},S:{plots:[{id:'p',name:'Plot'}]},TYPE_LABELS:{inspect:'Inspect'},ic:()=>'',esc:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),openModal:s=>{html=s;},App:{confirm:(...args)=>{confirm=args;}}});
  vm.runInContext(fs.readFileSync(require.resolve('../js/team.js'),'utf8')+';globalThis.team=Team;',ctx);
  return {ctx,team:ctx.team,html:()=>html,confirmation:()=>confirm};
}
test('only pending and expired invitations have a recovery action',()=>{
  const t=setup();t.team.section='members';
  t.team.members=['invited','active','revoked'].map((status,i)=>({id:String(i),email:'user'+i+'@example.invalid',status,scopes:JSON.stringify({plots:['p'],types:['inspect']}),expires_at:1}));
  t.team.render();assert.match(t.html(),/Team.renewInvite\(0\)/);
  assert.match(t.html(),/href="\/collector"/);assert.doesNotMatch(t.html(),/href="collector.html"/);
  assert.doesNotMatch(t.html(),/Team.renewInvite\([12]\)/);
});
test('renewal waits for confirmation, preserves identity and updates the displayed revision',async()=>{
  const t=setup(),calls=[];t.team.members=[{id:'g',email:'member@example.invalid',revision:4,status:'invited'}];
  t.team.call=async(action,p)=>{calls.push({action,...p});return {invite:'new-token',expiresAt:Date.now()+86400000,revision:5};};
  t.team.renewInvite(0);assert.equal(calls.length,0);assert.match(t.confirmation()[1],/ลิงก์เก่า/);
  await t.confirmation()[2]();assert.equal(calls.length,1);assert.equal(calls[0].revision,4);assert.equal(calls[0].grantId,'g');
  assert.equal(t.team.members[0].revision,5);assert.equal(t.team.busy,false);
  assert.match(t.html(),/\/collector#invite=new-token/);assert.match(t.html(),/กลับรายชื่อสมาชิก/);assert.match(t.html(),/ลิงก์เก่าใช้ไม่ได้แล้ว/);
});
test('invitation result escapes the email and provides copy, expiry and recovery path',()=>{
  const t=setup();t.team.showInvite({invite:'token',expiresAt:Date.now()},'<script>');
  assert.doesNotMatch(t.html(),/<script>/);assert.match(t.html(),/Team.copyInvite/);
  assert.match(t.html(),/หมดอายุ/);assert.match(t.html(),/สมาชิกและสิทธิ์/);
});

test('owner review displays work totals and the collector rate without exposing calculation as stock quantity',()=>{
  const t=setup();Object.assign(t.ctx,{ApplicationRate:require('../js/application-rate.js'),INSPECTION_CHECKS:[],dateLabel:d=>d,plotById:()=>({name:'Plot'})});t.ctx.S.trials=[];
  t.team.inbox=[{id:'s',status:'pending',member_name:'Collector',payload:JSON.stringify({type:'spray',plotId:'p',date:'2026-09-14',title:'Spray',workStatus:'done',applicationWork:{waterLitres:200,areaRai:3},materials:[{name:'<Product>',unit:'bottle',qty:1,rate:'20 ml / 20 L'}]})}];
  t.team.detail(0);const html=t.html();assert.match(html,/น้ำทั้งหมด 200 ลิตร/);assert.match(html,/พื้นที่ 3 ไร่/);assert.match(html,/อัตราใช้: 20 ml \/ 20 L/);assert.match(html,/1 bottle/);assert.match(html,/&lt;Product&gt;/);
});
test('returning a pending entry clearly identifies the required correction note',()=>{
  const t=setup();Object.assign(t.ctx,{ApplicationRate:{workText:()=>''},INSPECTION_CHECKS:[],dateLabel:d=>d,plotById:()=>({name:'Plot'})});t.ctx.S.trials=[];
  t.team.inbox=[{id:'s',status:'pending',member_name:'Collector',payload:JSON.stringify({type:'inspect',plotId:'p',date:'2026-09-14',title:'Inspect',workStatus:'done'})}];
  t.team.detail(0);assert.match(t.html(),/จำเป็นเมื่อส่งกลับแก้ไข/);assert.match(t.html(),/ระบุเวลารดน้ำ/);
});
