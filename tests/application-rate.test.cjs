const {test}=require('node:test');
const assert=require('node:assert/strict');
const rate=require('../js/application-rate.js');

test('structured rates normalize units and do not trust conflicting display text',()=>{
  const dose={amount:'20',unit:'ml',per:'20',basis:'water'};
  assert.deepEqual(rate.materialFields({dose,rate:'forged'}),{dose:{amount:20,unit:'ml',per:20,basis:'water'},rate:'20 มล. (ซีซี) ต่อน้ำ 20 ลิตร'});
  assert.equal(rate.materialFields({rate:'  legacy  '}).rate,'legacy');
  assert.deepEqual(rate.materialFields({dose:{amount:'',unit:'ml',per:'',basis:'water'}}),{});
});

test('rate validation rejects partial, zero, malformed and unsupported ratios',()=>{
  const base={amount:20,unit:'ml',per:20,basis:'water'};
  for(const change of [{amount:''},{per:''},{amount:0},{per:-1},{per:0},{unit:'bottle'},{basis:'tank'},{amount:Infinity},{amount:1e10},{amount:true},{amount:.00001}])assert.throws(()=>rate.cleanDose({...base,...change}));
  for(const dose of [[],true,'rate'])assert.throws(()=>rate.cleanDose(dose));
});

test('water and area totals calculate only compatible bases and never mutate actual quantities',()=>{
  const row={qty:2,unit:'bottle',dose:{amount:20,unit:'ml',per:20,basis:'water'}},before=JSON.stringify(row);
  assert.deepEqual(rate.estimate(row,{waterLitres:200,areaRai:5}),{amount:200,unit:'ml'});
  assert.equal(JSON.stringify(row),before);
  assert.equal(rate.estimate(row,{areaRai:5}),null);
  assert.deepEqual(rate.estimate({dose:{amount:25,unit:'kg',per:1,basis:'area'}},{areaRai:3}),{amount:75,unit:'kg'});
  assert.equal(rate.estimate({rate:'25 kg/rai'},{areaRai:3}),null);
  assert.equal(rate.estimateText(row,{waterLitres:200},'failed'),'');
});

test('optional work totals are bounded, omit blanks and discard untrusted keys',()=>{
  assert.deepEqual(rate.cleanWork({waterLitres:'',areaRai:'3.5',secret:1}),{areaRai:3.5});
  for(const waterLitres of [0,-1,true,NaN,'text',1e10])assert.throws(()=>rate.cleanWork({waterLitres}));
  assert.throws(()=>rate.estimate({dose:{amount:1e9,per:.0001,unit:'ml',basis:'water'}},{waterLitres:1e9}));
  assert.match(rate.workText({waterLitres:200,areaRai:3}),/200 ลิตร.*3 ไร่/);
});
