'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/wallet-lark-read.js');
const expense=(id,team,cents,date='2026-10-14')=>({id,title:id,team,cents,date,payerIds:['ou_alice']});
const income=(id,cents,date='2026-10-14')=>({id,title:id,cents,date,photos:[{id:'test-photo'}]});
const fresh=()=>({opening:null,income:[],expenses:[expense('recRD','R&D',50000),expense('recSale','Sales',30000),expense('recUnknown',null,9000)],syncedAt:'2026-10-14T00:00:00Z'});

test('department field accepts a single exact team and rejects ambiguous values',()=>{
  for(const value of ['R&D',['R&D'],[{text:'R&D'}],[{name:'R&D'}]])assert.equal(M.expenseTeam(value),'R&D');
  for(const value of [undefined,null,{},12,[],['R&D','Sales'],'',' R&D','R&D ','a'.repeat(121),'Sales\nR&D'])assert.equal(M.expenseTeam(value),null);
  const record={record_id:'recTest',fields:{[M.payerField]:[{id:'ou_alice',name:'Alice'}],'รายการค่าใช้จ่าย':'Test','จำนวนเงิน (THB)':1,'วันที่ขอ (Date)':Date.parse('2026-10-14T00:00:00Z'),'ทีม/แผนก':'Sales'}};
  assert.equal(M.normalize([record],'ou_alice',null)[0].team,'Sales');
  record.fields['ทีม/แผนก']=['R&D','Sales'];assert.equal(M.normalize([record],'ou_alice',null)[0].team,null);
});

test('no selection never deducts all personal expenses or uses old income automatically',()=>{
  const s={...fresh(),opening:{cents:100000,date:'2026-10-01'},income:[income('old',80000)]};
  assert.equal(M.departmentFunds(s).team,null);const t=M.departmentTotals(s);
  assert.equal(t.paid,0);assert.equal(t.received,0);assert.equal(t.balance,0);assert.deepEqual(t.expenses,[]);
  const next=M.selectDepartment(s,'R&D');assert.equal(next.opening,s.opening);assert.equal(next.income,s.income);
  assert.equal(M.departmentTotals(next).balance,-50000);assert.equal(s.departments,undefined);
});

test('own, other and unassigned expenses partition exactly and only own department deducts',()=>{
  const t=M.departmentTotals(M.selectDepartment(fresh(),'R&D'));
  assert.equal(t.paid,50000);assert.equal(t.otherPaid,30000);assert.equal(t.unassignedPaid,9000);assert.equal(t.balance,-50000);
  assert.deepEqual(t.expenses.map(r=>r.id),['recRD']);assert.deepEqual(t.otherExpenses.map(r=>r.id),['recSale']);assert.deepEqual(t.unassignedExpenses.map(r=>r.id),['recUnknown']);
  assert.equal(t.paid+t.otherPaid+t.unassignedPaid,89000);
});

test('department switch preserves separate openings, income and photos through a storage round trip',()=>{
  let s=M.selectDepartment(fresh(),'R&D');
  s=M.updateDepartmentFunds(s,{opening:{cents:100000,date:'2026-10-01'},income:[income('rd',20000)]});
  assert.equal(M.departmentTotals(s).balance,70000);
  s=M.selectDepartment(s,'Sales');assert.equal(M.departmentTotals(s).balance,-30000);
  s=M.updateDepartmentFunds(s,{income:[income('sales',40000)]});assert.equal(M.departmentTotals(s).balance,10000);
  s=JSON.parse(JSON.stringify(s));assert.equal(M.validDepartments(s.departments),true);assert.equal(s.departments.selected,'Sales');
  s=M.selectDepartment(s,'R&D');assert.equal(M.departmentTotals(s).balance,70000);assert.equal(M.departmentFunds(s).income[0].photos[0].id,'test-photo');assert.equal(s.departments.wallets.length,2);
});

test('opening date limits all displayed expense groups without changing another department',()=>{
  let s=fresh();s.expenses.push(expense('recOld','R&D',10000,'2026-10-01'),expense('recOldSales','Sales',5000,'2026-10-01'));
  s=M.updateDepartmentFunds(M.selectDepartment(s,'R&D'),{opening:{cents:0,date:'2026-10-14'}});
  assert.equal(M.departmentTotals(s).paid,50000);assert.equal(M.departmentTotals(s).otherPaid,30000);
  s=M.selectDepartment(s,'Sales');assert.equal(M.departmentTotals(s).paid,35000);
});

test('sync replaces edited department once; missing records preserve known debit without guessing old schema',()=>{
  let s=M.selectDepartment(fresh(),'R&D');
  s={...s,expenses:M.reconcile(s.expenses,[expense('recRD','Sales',50000),expense('recSale','Sales',30000)])};
  assert.equal(M.departmentTotals(s).paid,0);assert.equal(M.departmentTotals(s).otherPaid,80000);assert.equal(M.departmentTotals(s).unassignedPaid,9000);
  const missing=M.reconcile([expense('recKeep','R&D',12000)],[]);s={...s,expenses:missing};assert.equal(M.departmentTotals(s).paid,12000);assert.equal(missing[0].missing,true);
  s={...s,expenses:[expense('recOld',undefined,12000)]};assert.equal(M.departmentTotals(s).paid,0);assert.equal(M.departmentTotals(s).unassignedPaid,12000);
});

test('invalid department storage and writes fail without modifying existing wallet',()=>{
  const s=M.selectDepartment(fresh(),'R&D'),before=JSON.stringify(s);
  for(const invalid of [null,{},[],{selected:'R&D',wallets:[]},{selected:null,wallets:[{team:'R&D',opening:null,income:[]},{team:'R&D',opening:null,income:[]}]},{selected:'R&D',wallets:[{team:'R&D',opening:null,income:[income('x',-1)]}]}])assert.equal(M.validDepartments(invalid),false);
  assert.throws(()=>M.updateDepartmentFunds(fresh(),{income:[]}));assert.throws(()=>M.selectDepartment(s,''));assert.throws(()=>M.updateDepartmentFunds(s,{income:[income('x',-1)]}));assert.equal(JSON.stringify(s),before);
  const unusual=M.selectDepartment(s,'__proto__');assert.equal(M.departmentFunds(unusual).team,'__proto__');assert.equal({}.polluted,undefined);
});

test('department amounts remain independent between payer books and print passes the active group',()=>{
  const alice=M.updateDepartmentFunds(M.selectDepartment(fresh(),'R&D'),{income:[income('alice',90000)]});
  const bob=M.selectDepartment(fresh(),'R&D');assert.equal(M.departmentTotals(bob).received,0);assert.equal(M.departmentTotals(alice).received,90000);
  const fs=require('node:fs'),ui=fs.readFileSync(require('node:path').join(__dirname,'../js/wallet-read-ui.js'),'utf8');
  assert.match(ui,/WalletReceipt\.open\(\{expenses:shownExpenses\(\)/);assert.match(ui,/:department:/);assert.match(ui,/formScope!==photoScope\(\)/);
});
