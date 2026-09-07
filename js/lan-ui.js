/* Transport indicator and local cookie login. Cloud never discovers a private endpoint. */
(function(root){
  "use strict";
  const local=FarmUltimateRuntime.isLan;
  let signedIn=false,cloud=false,busy=false;
  const messages={LOGIN_FAILED:"อีเมลหรือรหัสผ่านไม่ถูกต้อง",LOGIN_RATE_LIMIT:"ลองหลายครั้งแล้ว กรุณารอ 5 นาที",OWNER_NOT_READY:"ยังเตรียมบัญชี LAN ไม่ครบ"};
  function banner(){
    let el=document.getElementById("farm-transport");
    if(!el){el=document.createElement("aside");el.id="farm-transport";el.className="farm-transport";document.body.prepend(el);}
    el.innerHTML=local?`<div><b>LAN · ภายในฟาร์ม</b><span>${cloud?"Cloud เชื่อมต่ออยู่":"Cloud ไม่เชื่อมต่อ · ใช้งาน LAN ได้"}</span></div><button onclick="FarmLan.${signedIn?"logout()":"openLogin()"}">${signedIn?"ออกจาก LAN":"เข้าสู่ระบบ LAN"}</button>`:`<b>CLOUD · เว็บออนไลน์</b><a href="/lan-setup.html">เว็บสำรอง LAN</a>`;
  }
  function updateSession(value){
    if(signedIn===value)return;
    signedIn=value;
    Auth.session=value?{token:"lan-cookie-session",email:"owner@lan.invalid",name:"เจ้าของฟาร์ม"}:null;
    SensorTelemetry.syncSession();
    if(typeof render==="function")render();
  }
  async function status(){
    if(busy)return;busy=true;
    try{const r=await fetch("/api/lan/status",{cache:"no-store",signal:AbortSignal.timeout(8000)});const p=await r.json();if(!r.ok||!p.ok)throw Error();cloud=p.data.cloud_connected===true;updateSession(p.data.authenticated===true);banner();}
    catch{cloud=false;banner();const label=document.querySelector("#farm-transport span");if(label)label.textContent="ติดต่อ Pi 5 ไม่ได้ · ตรวจ Wi-Fi ภายในฟาร์ม";}
    finally{busy=false;}
  }
  function openLogin(){
    if(document.getElementById("lan-login-dialog"))return;
    const dialog=document.createElement("dialog");dialog.id="lan-login-dialog";dialog.className="lan-login-dialog";
    dialog.innerHTML=`<form id="lan-login-form"><h2>เข้าสู่ระบบในฟาร์ม</h2><p>ใช้บัญชีเจ้าของเซ็นเซอร์ที่เตรียมไว้บน Pi 5<br>ตรวจสอบรหัสผ่านใน LAN ได้แม้ไม่มีอินเทอร์เน็ต</p><label>อีเมล<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><p id="lan-login-message" role="status"></p><div><button type="button" onclick="document.getElementById('lan-login-dialog').close()">ยกเลิก</button><button type="submit">เข้าสู่ระบบ LAN</button></div></form>`;
    document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove());
    dialog.querySelector("form").addEventListener("submit",async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
      const fields=new FormData(form),password=form.elements.password;
      try{const response=await fetch("/api/lan/login",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000),body:JSON.stringify({email:fields.get("email"),password:fields.get("password")})});password.value="";const p=await response.json();if(!response.ok||!p.ok){document.getElementById("lan-login-message").textContent=messages[p.error]||"เข้าสู่ระบบไม่ได้ กรุณาลองใหม่";return;}dialog.close();await status();await SensorTelemetry.refresh(true);}
      catch{password.value="";document.getElementById("lan-login-message").textContent="ติดต่อ Pi 5 ไม่ได้ กรุณาตรวจการเชื่อมต่อ LAN";}
      finally{button.disabled=false;}
    });dialog.showModal();dialog.querySelector("input").focus();
  }
  async function logout(){
    try{const response=await fetch("/api/lan/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();updateSession(false);banner();}
    catch{toast("ยังยืนยันการออกจาก LAN ไม่ได้ กรุณาตรวจสถานะรีเลย์");}
  }
  root.FarmLan={openLogin,logout,status};
  banner();
  if(local){
    document.body.classList.add("farm-lan-mode");
    Auth.session=null;
    Auth.saveNow=async()=>{};Auth.loadNow=async()=>{};
    const nav=App.nav;
    App.nav=function(view){return nav.call(App,"iot");};
    App.openSensorLogin=openLogin;
    App.openRelayLogin=openLogin;
    App.nav("iot");status();
    setInterval(()=>{if(!document.hidden)status();},5000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)status();});
  }
})(globalThis);
