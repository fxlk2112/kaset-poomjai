const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function recoveryStore() {
  let next=0,fail=false;const records=new Map();
  const context=vm.createContext({uid:()=>String(++next),Date,JSON});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/recovery.js'),'utf8')+'\nthis.recovery=Recovery;',context);
  // Transaction double: stage mutations and only commit after all requests succeed.
  context.recovery.open=async()=>({close(){},transaction(){
    const staged=new Map(records),tx={error:null};
    tx.objectStore=()=>({
      getAll(){
        const req={result:[...staged.values()]};
        queueMicrotask(()=>{
          req.onsuccess?.();
          if(fail){tx.error=new Error('quota');tx.onabort?.();}
          else{records.clear();for(const [key,value] of staged)records.set(key,value);tx.oncomplete?.();}
        });
        return req;
      },delete:id=>staged.delete(id),put:entry=>staged.set(entry.id,entry)
    });
    return tx;
  }});
  return {recovery:context.recovery,records,setFail:value=>{fail=value;}};
}

test('recovery retains five snapshots per account without pruning another account',async()=>{
  const c=recoveryStore();
  await c.recovery.save('OTHER@example.invalid',{tasks:[{id:'private'}]},null,0,'pull');
  for(let i=0;i<7;i++)await c.recovery.save('owner@example.invalid',{tasks:[{id:i}]},{tasks:[]},i,'push');
  assert.equal((await c.recovery.list('owner@example.invalid')).length,5);
  assert.equal((await c.recovery.list('OTHER@example.invalid')).length,1);
  assert.equal((await c.recovery.list('nobody@example.invalid')).length,0);
});

test('failed backup transactions preserve previous recovery points',async()=>{
  const c=recoveryStore();
  for(let i=0;i<5;i++)await c.recovery.save('owner',{tasks:[{id:i}]},null,i,'pull');
  const before=JSON.stringify([...c.records]);c.setFail(true);
  await assert.rejects(c.recovery.save('owner',{tasks:[{id:'new'}]},null,10,'pull'));
  assert.equal(JSON.stringify([...c.records]),before);
});

test('recovery captures immutable local and cloud data including embedded photos',async()=>{
  const c=recoveryStore(),local={tasks:[{photos:['data:image/jpeg;base64,cGhvdG8=']}]},cloud={stock:[{qty:5}]};
  await c.recovery.save('owner',local,cloud,10,'push');
  local.tasks[0].photos=[];cloud.stock[0].qty=0;
  const saved=(await c.recovery.list('owner'))[0];
  assert.equal(saved.local.tasks[0].photos.length,1);assert.equal(saved.cloud.stock[0].qty,5);
});
