'use strict';
const fs=require('node:fs'),path=require('node:path');
function loadPrivateEnv(env=process.env,directory=path.join(__dirname,'.wallet-private')){
  let local={};try{local=JSON.parse(fs.readFileSync(path.join(directory,'runtime.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('Invalid private wallet configuration');}
  return {...local,...env};
}
function readConfig(env){
  const app=env.LARK_WALLET_BASE_APP,table=env.LARK_WALLET_TABLE,team=env.LARK_WALLET_TEAM;
  let origin;try{const url=new URL(env.LARK_WALLET_BASE_ORIGIN);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!url.hostname.endsWith('.larksuite.com'))throw new Error();origin=url.origin;}catch{throw new Error('Configure LARK_WALLET_BASE_ORIGIN with a Lark HTTPS origin');}
  if(!/^[A-Za-z0-9]+$/.test(app||'')||!/^tbl[A-Za-z0-9]+$/.test(table||'')||typeof team!=='string'||!team.trim()||team.trim()!==team||team.length>120)throw new Error('Configure the wallet Base, table and department');
  const id=env.LARK_WALLET_OWNER_ID,name=env.LARK_WALLET_OWNER_NAME;
  const owner=/^ou_[A-Za-z0-9]+$/.test(id||'')&&typeof name==='string'&&name.trim()?{id,name}:null;
  return {target:{app,table,team},owner,baseUrl:`${origin}/base/${app}?table=${table}`};
}
function receiptCells(directory=path.join(__dirname,'.wallet-private')){
  let cells={};try{cells=JSON.parse(fs.readFileSync(path.join(directory,'receipt-cells.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('Invalid private receipt configuration');}
  return Object.fromEntries(['B2','D3','D4','C29','H29'].filter(key=>typeof cells[key]==='string').map(key=>[key,cells[key]]));
}
module.exports={loadPrivateEnv,readConfig,receiptCells};
