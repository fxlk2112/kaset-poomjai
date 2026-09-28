const {DatabaseSync}=require('node:sqlite');
// Exercise real SQLite constraints and transactions, not SQL string mocks.
function localD1() {
  const sqlite=new DatabaseSync(':memory:');
  const db={
    prepare(sql){return {bind(...args){return statement(sql,args);},...statement(sql,[])};},
    async exec(sql){sqlite.exec(sql);},
    async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},
    close(){sqlite.close();}
  };
  function statement(sql,args){return {
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
  };}
  return db;
}
module.exports={localD1};
