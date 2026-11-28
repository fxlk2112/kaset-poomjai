// Read-only verification after the documented browser scenario on the synthetic QA server.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'.private/runtime/state.sqlite'),{readOnly:true});
const state=JSON.parse(db.prepare('SELECT data FROM user_data WHERE user_id=?').get('daily-entry-qa').data);
const ctx=vm.createContext({console,Date,JSON,App:{},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},setTimeout(){},state});
const run=s=>vm.runInContext(s,ctx);
for(const f of ['data','projects','project-workspace','cycle-notebook','plot-materials'])run(fs.readFileSync(path.join(__dirname,'../../js',f+'.js'),'utf8'));
const app=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8');
run(app.slice(app.indexOf('function taskMaterialItems('),app.indexOf('function taskMaterialsHtml(')));
run('Object.assign(S,state);');
const result=run(`({records:S.tasks.length,uniqueIds:new Set(S.tasks.map(t=>t.id)).size,projectCash:projectCosts(projectById('daily-project')).cost,plannedProjectCash:projectCosts(projectById('daily-plan')).cost,cycleCash:cycleFinance(S,S.projects[0].cycleId).cost,materialCash:materialHistoryModel(S.tasks).cost,stock:S.stock.find(s=>s.id==='proposal-stock').qty,adHocProgress:projectProgress(projectById('daily-project')),plannedProgress:projectProgress(projectById('daily-plan')),newActivityCount:S.tasks.filter(t=>t.title==='ใส่ปุ๋ยทดสอบรวมค่าแรง').length,photos:S.tasks.filter(t=>t.title==='ใส่ปุ๋ยทดสอบรวมค่าแรง').flatMap(t=>[...(t.photos||[]),...(t.donePhotos||[])]).length,supportedCash:S.tasks.flatMap(t=>t.costItems||[]).filter(materialIsSupported).reduce((n,i)=>n+Number(i.totalCost||0),0)})`);
assert.equal(result.records,5);assert.equal(result.uniqueIds,5);assert.equal(result.newActivityCount,1);
assert.equal(result.projectCash,850);assert.equal(result.plannedProjectCash,100);assert.equal(result.cycleCash,950);
assert.equal(result.materialCash,450);assert.equal(result.stock,48);assert.equal(result.supportedCash,0);
assert.equal(result.adHocProgress,null);assert.equal(result.plannedProgress,100);assert.equal(result.photos,1);
assert.equal(db.prepare('SELECT count(*) AS n FROM qa_photos').get().n,1);
console.log(JSON.stringify({result:'PASS',...result},null,2));db.close();
