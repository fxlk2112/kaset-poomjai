import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../relay-bench-schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../relay-bench-migrate-queued-index.sql', import.meta.url), 'utf8');
const source = readFileSync(new URL('../relay-bench.js', import.meta.url), 'utf8');
const expire = source.match(/"(UPDATE relay_bench_commands SET status='EXPIRED'.*?)"/)[1];
const claim = source.match(/`(UPDATE relay_bench_commands SET status='CLAIMED'[\s\S]*?)`/)[1];
const index = 'relay_bench_queued_owner_expiry';
const now = 1800000000000;
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec(`DROP INDEX ${index}`); // Only this synthetic memory database.
  db.prepare('INSERT INTO relay_bench_state VALUES(?,?,?,?,?,?,?)').run('demo', now+900000, 7, 7, 'instance', now, '{}');
  const insert = db.prepare('INSERT INTO relay_bench_commands(id,user_id,module,channel,action,created_at,expires_at,stop_seq,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for (let i=0;i<1000;i++) insert.run(`history-${i}`, 'demo', 'RELAY_A', 1, 'PULSE', now-100000-i, now-90000-i, 7, 'OFF_VERIFIED', now);
  for (const [id, channel, action, expires, seq] of [
    ['expired',1,'PULSE',now,7], ['off',2,'OFF',now+8000,7],
    ['pulse',3,'PULSE',now+8000,7], ['old-seq',4,'PULSE',now+8000,6]
  ]) insert.run(id,'demo','RELAY_A',channel,action,now-1000,expires,seq,'QUEUED',now);
  return db;
}
const state = db => ['relay_bench_commands','relay_bench_state'].map(t => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
const detail = (db,q,args) => db.prepare('EXPLAIN QUERY PLAN '+q).all(...args).map(r=>r.detail).join('\n');

test('queued index migration is additive, repeatable and preserves active-channel uniqueness', () => {
  const db=fixture(); const before=state(db);
  const oldIndexes=db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='index' ORDER BY name").all();
  db.exec(migration); db.exec(migration);
  assert.deepEqual(state(db),before);
  assert.deepEqual(db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='index' AND name<>? ORDER BY name").all(index),oldIndexes);
  assert.throws(()=>db.prepare("INSERT INTO relay_bench_commands(id,user_id,module,channel,action,created_at,expires_at,stop_seq,status,updated_at) VALUES('duplicate','demo','RELAY_A',3,'PULSE',0,1,7,'QUEUED',0)").run(), /UNIQUE/);
  db.close();
});

test('expire and claim use queued index and preserve selected commands and guards', () => {
  for (const mode of ['ready','unarmed','unseen','wrong-instance']) {
    const results=[];
    for (const indexed of [false,true]) {
      const db=fixture(); if(indexed) db.exec(migration);
      if(mode==='unarmed') db.exec('UPDATE relay_bench_state SET armed_until=0');
      if(mode==='unseen') db.exec('UPDATE relay_bench_state SET seen_stop_seq=-1');
      const args=['demo',mode==='wrong-instance'?'wrong':'instance',now,7];
      if(indexed) {
        assert.match(detail(db,expire,['demo',now]),/relay_bench_queued_owner_expiry.*user_id=.*expires_at/);
        assert.match(detail(db,claim,args),/relay_bench_queued_owner_expiry.*user_id=.*expires_at/);
      }
      db.prepare(expire).run('demo',now);
      const commands=db.prepare(claim).all(...args).map(r=>r.id).sort();
      assert.deepEqual(commands,mode==='ready'?['off','pulse']:mode==='unarmed'?['off']:[]);
      assert.deepEqual(db.prepare(claim).all(...args),[]);
      results.push({commands,state:state(db)});db.close();
    }
    assert.deepEqual(results[0],results[1]);
  }
});

test('migration matches fresh schema and works with production action column at end', () => {
  const fresh=new DatabaseSync(':memory:'); fresh.exec(schema);
  const expected=fresh.prepare('SELECT sql FROM sqlite_schema WHERE name=?').get(index).sql.replace(/\s+/g,' ').trim();
  const db=new DatabaseSync(':memory:');
  // Production was upgraded by ALTER TABLE: action is the last column.
  db.exec("CREATE TABLE relay_bench_commands(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,module TEXT NOT NULL,channel INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,stop_seq INTEGER NOT NULL,status TEXT NOT NULL,claimed_by TEXT,updated_at INTEGER NOT NULL,action TEXT NOT NULL DEFAULT 'PULSE')");
  db.exec(migration); db.exec(migration);
  assert.equal(db.prepare('SELECT sql FROM sqlite_schema WHERE name=?').get(index).sql.replace(/\s+/g,' ').trim(),expected);
  fresh.close();db.close();
});
