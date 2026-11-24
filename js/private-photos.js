/* Team photo references contain no access credentials. Resolve only on demand. */
(function(){
  const prefix='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#team-photo=';
  let call,identity,observer,scheduled=false,active=0;
  const queue=[],seen=new WeakSet();
  const id=src=>typeof src==='string' && src.startsWith(prefix) && /^[a-f0-9]{64}$/.test(src.slice(prefix.length))?src.slice(prefix.length):null;
  function scan(){
    scheduled=false;
    document.querySelectorAll('img').forEach(img=>{
      const key=id(img.getAttribute('src'));if(!key || seen.has(img))return;
      seen.add(img);img.dataset.privatePhoto=key;img.classList.add('private-photo-loading');
      if(observer)observer.observe(img);else enqueue(img);
    });
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
  function enqueue(img){queue.push(img);pump();}
  function pump(){
    while(active<3 && queue.length){
      const img=queue.shift();if(!img.isConnected)continue;
      const account=identity(),key=img.dataset.privatePhoto;active++;
      call('team_photo_get',{id:key}).then(result=>{
        if(img.isConnected && identity()===account && id(img.getAttribute('src'))===key){img.src=result.src;img.classList.remove('private-photo-loading');}
      }).catch(()=>{if(img.isConnected){img.classList.remove('private-photo-loading');img.alt='เปิดรูปไม่ได้ กดรีเฟรชเพื่อลองใหม่';img.dataset.photoFailed='1';}}).finally(()=>{active--;pump();});
    }
  }
  window.PrivatePhotos={
    configure(api,session){
      call=api;identity=session;
      if('IntersectionObserver' in window)observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);enqueue(e.target);}}),{rootMargin:'150px'});
      new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});schedule();
    },
    retry(){document.querySelectorAll('img[data-photo-failed]').forEach(img=>{delete img.dataset.photoFailed;enqueue(img);});},
    open(src){
      let dialog=document.getElementById('privatePhotoDialog');if(dialog)dialog.remove();
      dialog=document.createElement('dialog');dialog.id='privatePhotoDialog';dialog.className='private-photo-dialog';
      const close=document.createElement('button');close.textContent='ปิดรูป';close.onclick=()=>dialog.close();
      const img=document.createElement('img');img.alt='รูปประกอบบันทึก';img.src=src;
      dialog.append(close,img);document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove());schedule();
    }
  };
})();
