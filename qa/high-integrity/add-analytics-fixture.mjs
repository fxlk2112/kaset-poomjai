// Run only against this harness's local synthetic SQLite fixture, with its server stopped.
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const db=new DatabaseSync(fileURLToPath(new URL('.private/runtime/state.sqlite',import.meta.url)));
try {
  const row=db.prepare('SELECT data,updated_at FROM user_data WHERE user_id=?').get('high-integrity-qa');
  assert.ok(row,'Start serve-backend.mjs once before adding this synthetic fixture');
  const state=JSON.parse(row.data),missing=JSON.stringify(state.tasks.filter(t=>t.id.startsWith('missing-')));
  if(!state.tasks.some(t=>t.id==='analytics-unknown')) {
    state.tasks.push({id:'analytics-unknown',title:'ทดสอบแสดงปริมาณที่ยังไม่ทราบ',type:'spray',status:'done',date:'2026-11-28',doneDate:'2026-11-28',plotId:'integrity-qa',cycleId:'',projectId:'',cost:0,revenue:0,dataStatus:'pending',missingFields:['ปริมาณ'],costItems:[{name:'วัสดุสมมติไม่ทราบปริมาณ',category:'chemical',qty:null,unit:'มล.',funding:'supported',totalCost:0}],stockState:'untracked',stockLog:[]});
    assert.equal(JSON.stringify(state.tasks.filter(t=>t.id.startsWith('missing-'))),missing);
    const result=db.prepare('UPDATE user_data SET data=?,updated_at=? WHERE user_id=? AND updated_at=?').run(JSON.stringify(state),Math.max(Date.now(),row.updated_at+1),'high-integrity-qa',row.updated_at);
    assert.equal(Number(result.changes),1);
  }
  console.log('Synthetic analytics fixture ready; seven existing incomplete fixtures unchanged');
} finally {db.close();}
