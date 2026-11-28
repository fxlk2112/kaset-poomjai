'use strict';
const WalletAccess=(()=>{
  let token='',vault=null,unlocked=false,lastActive=0,lastPing=0,expiresAt=0,idleMs=300000,submitting=false,accessEpoch=0;
  function ensureCurrent(epoch){if(epoch!==accessEpoch)throw Object.assign(new Error('ยกเลิกการเปิดกระเป๋าแล้ว'),{cancelled:true});}
  const memberMode=new URL(location.href).searchParams.get('mode')==='lark';
  const pinPath=memberMode?'/__wallet/member/pin/':'/__wallet/pin/';
  let context=null,legacyContext=null;
  const profileKey=()=>context?.profileKey||'farm-wallet-receipt-profile-v1';
  const scopeHeaders=()=>context?{'X-Wallet-Scope':context.storageBase}:{};
  const $=id=>document.getElementById(id),channel=typeof BroadcastChannel==='function'?new BroadcastChannel('farm-wallet-lock-v1'):null;
  function screen(message=''){
    document.body.classList.add('wallet-locked');
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    for(const form of document.querySelectorAll('#walletGate form'))form.reset();
    if($('recoverySaved')){panel('pinForm');$('recoveryCode').textContent='';$('codeDownload').onclick=null;}
    $('pinError').textContent=message;
  }
  async function request(action,payload={}){
    const res=await fetch(pinPath+action,{method:'POST',headers:{'Content-Type':'application/json','X-Wallet-Preview':'1',...scopeHeaders(),...(token?{'X-Wallet-Session':token}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
    const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'เชื่อมต่อไม่สำเร็จ'),{status:res.status});return data;
  }
  async function lock(broadcast=true){
    if(!unlocked&&!token&&!submitting)return;accessEpoch++;unlocked=false;submitting=false;screen();vault?.clear();
    if(broadcast)channel?.postMessage('lock');
    const oldToken=token;token='';
    // Leave no wallet DOM, object URLs, in-memory data or printable snapshot behind.
    for(const el of [...document.body.children])if(el.id!=='walletGate')el.remove();
    try{await fetch(pinPath+'lock',{method:'POST',headers:{'X-Wallet-Preview':'1','X-Wallet-Session':oldToken,...scopeHeaders()},signal:AbortSignal.timeout(2500)});}catch{}
    location.reload();
  }
  async function authorizedFetch(url,options={}){
    if(!unlocked||Date.now()-lastActive>=idleMs||Date.now()>=expiresAt){void lock();throw new Error('กรุณาปลดล็อกกระเป๋าอีกครั้ง');}
    if(memberMode)url=url.replace(/^\/__wallet\//,'/__wallet/member/');
    const res=await fetch(url,{...options,headers:{...options.headers,...scopeHeaders(),'X-Wallet-Session':token}});
    if(res.status===401){void lock();throw new Error('กรุณาปลดล็อกกระเป๋าอีกครั้ง');}return res;
  }
  function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(new Error('โหลดหน้ากระเป๋าไม่สำเร็จ กรุณารีเฟรช'));document.body.append(el);});}
  function panel(id){for(const name of ['pinForm','recoverForm','recoveryManage','recoverySaved','larkLogin'])if($(name))$(name).hidden=name!==id;$('walletGate').setAttribute('aria-labelledby',({pinForm:'pinTitle',recoverForm:'recoverTitle',recoveryManage:'manageTitle',recoverySaved:'savedTitle',larkLogin:'larkTitle'})[id]);document.body.classList.add('wallet-locked');}
  function saveCode(code){
    panel('recoverySaved');$('recoveryCode').textContent=code;$('codeSaved').checked=false;$('codeContinue').disabled=true;$('codeDownload').focus();
    $('codeSaved').onchange=()=>{$('codeContinue').disabled=!$('codeSaved').checked;};
    $('codeDownload').onclick=()=>{
      const url=URL.createObjectURL(new Blob(['FarmUltimate wallet recovery code\n'+code+'\nKeep private. Replaced after each recovery.'],{type:'text/plain'}));
      const a=document.createElement('a');a.href=url;a.download='farm-wallet-recovery.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    return new Promise(resolve=>{$('codeContinue').onclick=()=>{if(!$('codeSaved').checked)return;$('recoveryCode').textContent='';$('codeDownload').onclick=null;code='';resolve();};});
  }
  async function enter(result,epoch){
    ensureCurrent(epoch);
    token=result.token;expiresAt=result.expiresAt;idleMs=result.idleMs;lastActive=Date.now();
    const configResponse=await fetch(memberMode?'/__wallet/member/config':'/__wallet/context',{method:'POST',headers:{'X-Wallet-Preview':'1','X-Wallet-Session':token,...scopeHeaders()},signal:AbortSignal.timeout(20000)});
    if(!configResponse.ok)throw new Error('โหลดการตั้งค่ากระเป๋าไม่สำเร็จ');
    const config=await configResponse.json();ensureCurrent(epoch);
    if(!memberMode)legacyContext=config;
    for(const key of ['B2','D3','D4','C29','H29'])if(typeof config.receiptCells?.[key]==='string')WalletReceiptTemplate.cells[key].value=config.receiptCells[key];
    const openedVault=await WalletVault.create(result.key,localStorage);result.key='';
    if(epoch!==accessEpoch){openedVault.clear();ensureCurrent(epoch);}vault=openedVault;
    const target=legacyContext?.target||WalletLarkRead.target;
    const base=context?.storageBase||`farm-wallet-read-v1:${target.app}:${target.table}:${target.team}`;
    await vault.load([base,base.replace('-v1:','-v2:'),profileKey()]);
    ensureCurrent(epoch);
    await WalletEvidence.secure(vault,base.replace('-v1:','-v2:')+':');
    ensureCurrent(epoch);
    if(result.recoveryCode){const code=result.recoveryCode;result.recoveryCode='';await saveCode(code);ensureCurrent(epoch);await request('touch');ensureCurrent(epoch);lastActive=Date.now();}
    unlocked=true;await script('js/wallet-read-ui.js');
    ensureCurrent(epoch);
    document.body.classList.remove('wallet-locked');$('lockWallet').onclick=()=>lock();
    const button=document.createElement('button');button.className='icon-btn';button.title='รหัสกู้คืน PIN';button.setAttribute('aria-label','รหัสกู้คืน PIN');button.innerHTML='<i data-lucide="key-round"></i>';
    button.onclick=()=>{panel('recoveryManage');$('manageError').textContent='';$('managePin').focus();};document.querySelector('.top-actions').prepend(button);window.lucide?.createIcons();
    if(memberMode){const logoutButton=document.createElement('button');logoutButton.className='text-btn';logoutButton.textContent='ออกจากบัญชี Lark';logoutButton.onclick=logoutLark;document.querySelector('.top-actions').append(logoutButton);}
  }
  async function oauth(action){const res=await fetch('/__wallet/'+action,{method:'POST',headers:{'X-Wallet-Preview':'1'},signal:AbortSignal.timeout(20000)});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'เชื่อมต่อ Lark ไม่สำเร็จ'),{status:res.status});return data;}
  async function logoutLark(){
    accessEpoch++;submitting=false;screen();vault?.clear();unlocked=false;token='';channel?.postMessage('lock');
    try{await oauth('oauth/logout');location.replace('/wallet-preview.html?mode=lark');}
    catch{$('pinError').textContent='ออกจากบัญชีไม่สำเร็จ กรุณาลองใหม่';$('pinRetry').hidden=false;}
  }
  async function prepareLark(){
    $('pinForm').insertAdjacentHTML('afterend',`<section id="larkLogin" hidden aria-labelledby="larkTitle"><i data-lucide="wallet" class="pin-symbol" aria-hidden="true"></i><h1 id="larkTitle">กระเป๋าเงินของฉัน</h1><p>เข้าสู่ระบบด้วยบัญชี Lark ของคุณ</p><button id="larkSignIn" type="button" class="action-btn receive" disabled><i data-lucide="log-in" aria-hidden="true"></i> เข้าสู่ระบบด้วย Lark</button><p id="larkLoginError" class="error" role="alert"></p><p id="larkLoginStatus" role="status">กำลังตรวจการเชื่อมต่อ…</p><details id="larkSetup" hidden><summary>การตั้งค่าสำหรับผู้ดูแล</summary><p>เพิ่ม Redirect URL นี้ในแอป Lark เดิมที่อ่าน Base และเปิดสิทธิ์ข้อมูลพื้นฐานผู้ใช้</p><code id="larkCallback"></code><p>ตั้งค่าองค์กรที่อนุญาตและเปิด Lark Login บนเซิร์ฟเวอร์ก่อนทดลอง</p></details><a class="text-btn" href="/wallet-preview.html">กลับกระเป๋าเดิม</a></section>`);
    panel('larkLogin');window.lucide?.createIcons();
    $('larkSignIn').onclick=async()=>{try{$('larkSignIn').disabled=true;$('larkLoginError').textContent='';const result=await oauth('oauth/start');location.assign(result.url);}catch(error){$('larkLoginError').textContent=error.message;$('larkSignIn').disabled=false;}};
    try{
      const config=await oauth('oauth/config');$('larkSignIn').disabled=!config.enabled;$('larkSetup').hidden=config.enabled;$('larkCallback').textContent=config.callback;
      $('larkLoginStatus').textContent=config.enabled?'เฉพาะรายการที่คุณเป็นผู้จ่ายใน FIN-EXPENSE':'ยังไม่ได้เปิด Lark Login สำหรับพรีวิวนี้';
      if(new URL(location.href).searchParams.has('authError'))$('larkLoginError').textContent='เข้าสู่ระบบไม่สำเร็จหรือคำขอหมดอายุ กรุณาลองใหม่';
      if(!config.enabled)return false;
      try{context=await oauth('member/context');}catch(error){if(error.status!==401)$('larkLoginError').textContent=error.message;return false;}
      channel?.postMessage({type:'lark-identity',id:context.owner.id});
      const label=document.createElement('p');label.className='lark-account-label';label.textContent=context.owner.name+' · บัญชี Lark';$('pinTitle').after(label);
      const change=document.createElement('button');change.type='button';change.className='text-btn';change.textContent='เปลี่ยนบัญชี Lark';change.onclick=logoutLark;$('pinForm').append(change);
      panel('pinForm');return true;
    }catch{$('larkLoginStatus').textContent='ติดต่อเซิร์ฟเวอร์ไม่ได้';const retry=document.createElement('button');retry.className='text-btn';retry.textContent='ลองใหม่';retry.onclick=()=>location.reload();$('larkLogin').append(retry);return false;}
  }
  function recoveryUI(){
    $('pinForm').insertAdjacentHTML('beforeend','<button id="forgotPin" class="text-btn" type="button" hidden>ลืม PIN</button>');
    $('pinForm').insertAdjacentHTML('afterend',`
      <form id="recoverForm" hidden aria-labelledby="recoverTitle"><h1 id="recoverTitle">ตั้ง PIN ใหม่</h1><p>ใช้รหัสกู้คืนที่บันทึกไว้ ข้อมูลเงินและรูปเดิมจะยังอยู่ครบ</p>
      <label>รหัสกู้คืน<input id="recoverCode" type="password" autocomplete="off" spellcheck="false" maxlength="80" required></label>
      <label>PIN ใหม่ 6 หลัก<input id="recoverPin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required></label>
      <label>ยืนยัน PIN ใหม่<input id="recoverConfirm" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required></label>
      <p id="recoverError" class="error" role="alert"></p><button id="recoverSubmit" class="action-btn receive" type="submit">ตั้ง PIN ใหม่</button><button id="recoverBack" class="text-btn" type="button">กลับไปใส่ PIN</button>
      <p class="recovery-note">ยังไม่มีรหัสกู้คืน? หากจำ PIN ได้ ให้ปลดล็อกแล้วเปิด “รหัสกู้คืน PIN” เพื่อสร้างไว้ก่อน ระบบไม่สามารถข้ามการยืนยันหากลืมทั้งสองอย่าง</p></form>
      <form id="recoveryManage" hidden aria-labelledby="manageTitle"><h1 id="manageTitle">รหัสกู้คืน PIN</h1><p>ยืนยัน PIN ปัจจุบันเพื่อสร้างรหัสกู้คืนใหม่ รหัสกู้คืนเดิมจะใช้ไม่ได้อีก</p><label>PIN ปัจจุบัน<input id="managePin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="current-password" required></label><p id="manageError" class="error" role="alert"></p><button id="manageSubmit" class="action-btn receive" type="submit">สร้างรหัสกู้คืน</button><button id="manageBack" class="text-btn" type="button">กลับกระเป๋าเงิน</button></form>
      <section id="recoverySaved" hidden aria-labelledby="savedTitle"><h1 id="savedTitle">เก็บรหัสกู้คืนนี้ไว้</h1><p>แสดงครั้งนี้เท่านั้น ใช้ตั้ง PIN ใหม่ได้โดยข้อมูลไม่หาย ห้ามส่งให้ผู้อื่นหรือส่งในแชต</p><code id="recoveryCode"></code><button id="codeDownload" class="text-btn" type="button"><i data-lucide="download" aria-hidden="true"></i> ดาวน์โหลดรหัสกู้คืน</button><label class="recovery-check"><input id="codeSaved" type="checkbox"> ฉันเก็บรหัสไว้ในที่ปลอดภัยแล้ว</label><button id="codeContinue" class="action-btn receive" type="button" disabled>เปิดกระเป๋าเงิน</button><p class="recovery-note">ควรเก็บแยกจากเครื่องนี้ รหัสกู้คืนเก่าจะถูกแทนที่เมื่อใช้กู้คืนหรือสร้างรหัสใหม่</p></section>`);
    $('forgotPin').onclick=()=>{if(submitting)return;$('pinForm').reset();panel('recoverForm');$('recoverCode').focus();};
    $('recoverBack').onclick=()=>{if(submitting)return;$('recoverForm').reset();$('recoverError').textContent='';panel('pinForm');$('pinInput').focus();};
    $('manageBack').onclick=()=>{if(submitting)return;$('recoveryManage').reset();document.body.classList.remove('wallet-locked');};
    $('recoveryManage').onsubmit=async e=>{
      e.preventDefault();if(submitting)return;submitting=true;const epoch=accessEpoch;$('manageSubmit').disabled=true;$('manageError').textContent='';
      try{const result=await request('recovery',{pin:$('managePin').value});ensureCurrent(epoch);$('recoveryManage').reset();await saveCode(result.recoveryCode);ensureCurrent(epoch);result.recoveryCode='';document.body.classList.remove('wallet-locked');}
      catch(error){if(epoch!==accessEpoch)return;$('recoveryManage').reset();$('manageError').textContent=error.message;}
      finally{if(epoch===accessEpoch){submitting=false;$('manageSubmit').disabled=false;}}
    };
    $('recoverForm').onsubmit=async e=>{
      e.preventDefault();if(submitting)return;
      if($('recoverPin').value!==$('recoverConfirm').value){$('recoverError').textContent='PIN ทั้งสองช่องไม่ตรงกัน';$('recoverConfirm').focus();return;}
      submitting=true;const epoch=++accessEpoch;$('recoverSubmit').disabled=true;$('recoverError').textContent='';
      try{const result=await request('recover',{code:$('recoverCode').value,pin:$('recoverPin').value});ensureCurrent(epoch);$('recoverForm').reset();channel?.postMessage('lock');await enter(result,epoch);}
      catch(error){if(epoch!==accessEpoch)return;$('recoverForm').reset();if(token){vault?.clear();unlocked=false;await request('lock').catch(()=>{});token='';panel('pinForm');$('pinError').textContent='ตั้ง PIN ใหม่แล้ว แต่เปิดข้อมูลไม่สำเร็จ กรุณารีเฟรชและใช้ PIN ใหม่';$('pinRetry').hidden=false;}else $('recoverError').textContent=error.message;}
      finally{if(epoch===accessEpoch){submitting=false;$('recoverSubmit').disabled=false;}}
    };
  }
  async function start(){
    recoveryUI();
    if(memberMode&&!(await prepareLark()))return;
    if(!memberMode){const link=document.createElement('a');link.className='text-btn';link.href='/wallet-preview.html?mode=lark';link.textContent='กระเป๋าส่วนตัวด้วย Lark';$('walletGate').append(link);}
    window.lucide?.createIcons();
    let configured;
    try{const state=await request('status');configured=state.configured;$('pinTitle').textContent=configured?'ปลดล็อกกระเป๋าเงิน':'ตั้ง PIN กระเป๋าเงิน';$('pinConfirmLabel').hidden=configured;$('pinConfirm').required=!configured;$('pinInput').autocomplete=configured?'current-password':'new-password';$('pinSubmit').textContent=configured?'ปลดล็อก':'ตั้ง PIN และเปิดกระเป๋า';$('pinSubmit').disabled=false;$('pinInput').focus();}
    catch{$('pinError').textContent='ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่';$('pinRetry').hidden=false;return;}
    $('pinForm').onsubmit=async e=>{
      e.preventDefault();if(submitting)return;
      if(!configured&&$('pinInput').value!==$('pinConfirm').value){$('pinError').textContent='PIN ทั้งสองช่องไม่ตรงกัน';$('pinConfirm').focus();return;}
      submitting=true;const epoch=++accessEpoch;$('pinSubmit').disabled=true;$('pinError').textContent='';
      try{
        const result=await request(configured?'unlock':'setup',{pin:$('pinInput').value});
        ensureCurrent(epoch);$('pinForm').reset();await enter(result,epoch);
      }catch(error){
        if(epoch!==accessEpoch)return;
        panel('pinForm');$('pinForm').reset();$('pinError').textContent=token?'เปิดข้อมูลเข้ารหัสไม่สำเร็จ ข้อมูลเดิมยังเก็บอยู่ กรุณารีเฟรชเพื่อลองใหม่':error.message;
        if(token){unlocked=false;vault?.clear();await request('lock').catch(()=>{});token='';$('pinRetry').hidden=false;}
        else if(error.status===409||(memberMode&&error.status===401)){$('pinRetry').hidden=false;}
      }finally{if(epoch===accessEpoch){submitting=false;$('pinSubmit').disabled=unlocked;}}
    };
    $('forgotPin').hidden=!configured;
  }
  document.addEventListener('DOMContentLoaded',()=>{$('pinRetry').onclick=()=>location.reload();start();});
  for(const name of ['pointerdown','keydown','touchstart','wheel'])document.addEventListener(name,event=>{
    if(!unlocked||!event.isTrusted)return;
    const now=Date.now();if(now-lastActive>=idleMs||now>=expiresAt){void lock();return;}lastActive=now;
    if(now-lastPing>15000){lastPing=now;request('touch').catch(()=>lock());}
  },{passive:true});
  setInterval(()=>{if(unlocked&&(Date.now()-lastActive>=idleMs||Date.now()>=expiresAt))void lock();},1000);
  setInterval(()=>{if(token&&!unlocked&&(Date.now()-lastActive>=idleMs||Date.now()>=expiresAt)){accessEpoch++;token='';submitting=false;vault?.clear();$('recoveryCode').textContent='';location.reload();}},1000);
  document.addEventListener('visibilitychange',()=>{if(unlocked&&!document.hidden&&(Date.now()-lastActive>=idleMs||Date.now()>=expiresAt))void lock();});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  if(channel)channel.onmessage=event=>{if(event.data==='lock'||(memberMode&&event.data?.type==='lark-identity'&&context&&event.data.id!==context.owner.id)){if(unlocked||token||submitting)void lock(false);else if(memberMode){accessEpoch++;location.reload();}}};
  return {fetch:authorizedFetch,lock,get context(){return context;},get legacyContext(){return legacyContext;},get profileKey(){return profileKey();},get storage(){if(!unlocked)throw new Error('กรุณาปลดล็อก');return vault;}};
})();
