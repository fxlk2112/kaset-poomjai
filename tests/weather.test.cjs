const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const helper = source.slice(source.indexOf('const WEATHER_REQUESTS ='), source.indexOf('function weatherErrorHtml('));
function client(fetch) {
  const timers = new Map();let id=0;
  const c=vm.createContext({fetch,AbortController,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(helper,c);
  return {c,timers,run:code=>vm.runInContext(code,c)};
}
test('weather request times out even when the connection ignores abort',async()=>{
  let signal;
  const {run,timers}=client((_url,options)=>{signal=options.signal;return new Promise(()=>{});});
  const pending=run('weatherJson("forecast")');await Promise.resolve();
  const timer=[...timers.values()][0];assert.equal(timer.ms,15000);timer.fn();
  await assert.rejects(pending,/weather timeout/);assert.equal(signal.aborted,true);assert.equal(timers.size,0);
  assert.equal(run('WEATHER_REQUESTS.size'),0);
});
test('weather timeout also covers a stalled response body',async()=>{
  const {run,timers}=client(async()=>({ok:true,json:()=>new Promise(()=>{})}));
  const pending=run('weatherJson("forecast")');await Promise.resolve();await Promise.resolve();
  [...timers.values()][0].fn();await assert.rejects(pending,/weather timeout/);
  assert.equal(timers.size,0);
});
test('same URL shares in-flight request and successful completion clears timers',async()=>{
  let calls=0;
  const {run,timers}=client(async()=>{calls++;return {ok:true,json:async()=>({temperature:31})};});
  const a=run('weatherJson("forecast")'),b=run('weatherJson("forecast")');
  assert.equal(a,b);assert.equal((await a).temperature,31);assert.equal(calls,1);assert.equal(timers.size,0);
  assert.equal(run('WEATHER_REQUESTS.size'),0);
});
test('HTTP and network errors clear in-flight entries so retry is possible',async()=>{
  let calls=0;
  const {run,timers}=client(async()=>{calls++;if(calls===1)return {ok:false,status:429};if(calls===2)throw new Error('offline');return {ok:true,json:async()=>({ok:true})};});
  await assert.rejects(run('weatherJson("forecast")'),/429/);
  await assert.rejects(run('weatherJson("forecast")'),/offline/);
  assert.equal((await run('weatherJson("forecast")')).ok,true);assert.equal(timers.size,0);
});
function renderer() {
  const card={innerHTML:'Loading'};
  const p={id:'p',name:'Plot',lat:14.1,lng:100.1};
  const c=vm.createContext({App:{},S:{},route:{plotId:'p'},plotById:()=>p,
    document:{getElementById:id=>id==='weatherCard'?card:null},renderRainRadar(){throw new Error('map failed');},renderWeatherCompare(){},
    WEATHER_CACHE:{},WEATHER_TTL:1800000,fillWeatherAddress(){},esc:String,ic:()=>'',
    weatherJson:async()=>{throw new Error('weather timeout');}});
  vm.runInContext(source.slice(source.indexOf('function plotHasCoordinates('),source.indexOf('function plotCoordinatesHtml(')),c);
  vm.runInContext(source.slice(source.indexOf('function weatherErrorHtml('),source.indexOf('/* การ์ดสภาพอากาศของแปลง')),c);
  vm.runInContext(source.slice(source.indexOf('function renderPlotWeather()'),source.indexOf('/* ---- ที่อยู่/อำเภอจากพิกัด')),c);
  return {c,card,p};
}
test('map errors cannot prevent a cached forecast from being displayed',()=>{
  const {c,card}=renderer();c.WEATHER_CACHE['p|14.1,100.1']={t:Date.now(),html:'Forecast'};
  c.renderPlotWeather();assert.equal(card.innerHTML,'Forecast');
});
test('timeout replaces loading text with a retry action',async()=>{
  const {c,card}=renderer();await c.renderPlotWeather();
  assert.match(card.innerHTML,/15 วินาที/);assert.match(card.innerHTML,/App.retryWeather/);
  assert.doesNotMatch(card.innerHTML,/weather-loading/);
});
test('plot without coordinates does not retain a loading indicator',()=>{
  const {c,card,p}=renderer();p.lat='';c.renderPlotWeather();
  assert.match(card.innerHTML,/GPS/);assert.doesNotMatch(card.innerHTML,/Loading|weather-loading/);
});
