'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadPrivateEnv,readConfig,receiptCells}=require('../tools/wallet-config.cjs');
const fixture=require('./fixtures/wallet-config.cjs');
test('wallet configuration fails closed without an explicit Base and accepts only Lark HTTPS origins',()=>{
  assert.throws(()=>readConfig({}));
  for(const value of ['http://example.larksuite.com','https://example.invalid','https://user:pass@example.larksuite.com','https://example.larksuite.com/path','https://example.larksuite.com/?secret=value'])assert.throws(()=>readConfig({...fixture,LARK_WALLET_BASE_ORIGIN:value}));
  const config=readConfig(fixture);assert.equal(config.target.app,fixture.LARK_WALLET_BASE_APP);assert.equal(config.owner.id,fixture.LARK_WALLET_OWNER_ID);assert.equal(config.baseUrl,'https://example.larksuite.com/base/appExample?table=tblExample');
});
test('private configuration stays local and overrides preserve existing namespaces and template geometry',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wallet-config-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  assert.deepEqual(loadPrivateEnv({TEST:'value'},directory),{TEST:'value'});
  fs.writeFileSync(path.join(directory,'runtime.json'),JSON.stringify(fixture));
  const env=loadPrivateEnv({LARK_WALLET_OWNER_NAME:'Changed name'},directory),config=readConfig(env);
  assert.equal(config.owner.name,'Changed name');assert.equal(config.target.app,fixture.LARK_WALLET_BASE_APP);
  const before=`farm-wallet-read-v1:${fixture.LARK_WALLET_BASE_APP}:${fixture.LARK_WALLET_TABLE}:${fixture.LARK_WALLET_TEAM}`;
  assert.equal(`farm-wallet-read-v1:${config.target.app}:${config.target.table}:${config.target.team}`,before);
  fs.writeFileSync(path.join(directory,'receipt-cells.json'),JSON.stringify({B2:'Example Company',C29:'Example Person',D4:'Example tax label',secret:'not for browser',D3:{invalid:true}}));
  assert.deepEqual(receiptCells(directory),{B2:'Example Company',D4:'Example tax label',C29:'Example Person'});
});
test('public defaults contain no live connection and authentication still precedes private context',()=>{
  const model=require('../js/wallet-lark-read.js'),template=require('../js/wallet-receipt-template.js');
  assert.equal(model.baseUrl,'');for(const key of ['B2','D3','D4','C29','H29'])assert.equal(template.cells[key].value,'');
  const server=fs.readFileSync(path.join(__dirname,'../tools/wallet-read-server.cjs'),'utf8');
  assert.ok(server.indexOf('if(!pin.valid(token))')<server.indexOf("if(url.pathname==='/__wallet/context')"));
  assert.match(fs.readFileSync(path.join(__dirname,'../.gitignore'),'utf8'),/tools\/\.wallet-private\//);
});
