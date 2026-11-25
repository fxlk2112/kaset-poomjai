/* Minimal OOXML/ZIP writer. No service, credentials or third-party document upload. */
"use strict";
function projectXml(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');}
function projectZip(files){
  const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  const header=(size)=>{const a=new Uint8Array(size);return {a,v:new DataView(a.buffer)};};
  for(const [name,value] of Object.entries(files)){
    const bytes=typeof value==='string'?enc.encode(value):value,n=enc.encode(name),sum=crc(bytes),h=header(30+n.length),c=header(46+n.length);
    h.v.setUint32(0,0x04034b50,true);h.v.setUint16(4,20,true);h.v.setUint16(6,0x0800,true);h.v.setUint32(14,sum,true);h.v.setUint32(18,bytes.length,true);h.v.setUint32(22,bytes.length,true);h.v.setUint16(26,n.length,true);h.a.set(n,30);
    c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x0800,true);c.v.setUint32(16,sum,true);c.v.setUint32(20,bytes.length,true);c.v.setUint32(24,bytes.length,true);c.v.setUint16(28,n.length,true);c.v.setUint32(42,offset,true);c.a.set(n,46);
    chunks.push(h.a,bytes);central.push(c.a);offset+=h.a.length+bytes.length;
  }
  const end=header(22),centralSize=central.reduce((n,a)=>n+a.length,0);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,central.length,true);end.v.setUint16(10,central.length,true);end.v.setUint32(12,centralSize,true);end.v.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end.a],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
async function projectDocx(snap){
  snap={...snap,config:projectReportConfig({reportConfig:snap.config}),records:snap.records || [],events:snap.events || [],photos:snap.photos || projectReportPhotos(snap)};
  const files={},relationships=[],images=new Map();
  for(const [i,ph] of (snap.photos || []).entries()){
    let src=ph.src;
    if(src.includes('#team-photo=')){
      const img=[...document.querySelectorAll('img[data-private-photo]')].find(el=>src.endsWith(el.dataset.privatePhoto));
      if(!img || img.src===src)throw new Error('เปิดรูปส่วนตัวให้สำเร็จก่อนส่งออก');src=img.src;
    }
    const res=await fetch(src);if(!res.ok)throw new Error('อ่านรูปประกอบไม่ได้');
    const blob=await res.blob();let ext={'image/png':'png','image/jpeg':'jpg','image/gif':'gif'}[blob.type],bytes;
    if(ext)bytes=new Uint8Array(await blob.arrayBuffer());
    else{const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));bytes=new Uint8Array(await png.arrayBuffer());ext='png';}
    const id='rImage'+(i+1),name='image'+(i+1)+'.'+ext;files['word/media/'+name]=bytes;
    relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
    const bitmap=await createImageBitmap(blob),scale=Math.min(5486400/bitmap.width,7315200/bitmap.height),cx=Math.round(bitmap.width*scale),cy=Math.round(bitmap.height*scale);bitmap.close();
    images.set(ph.id,`<w:p><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${i+1}" name="${name}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i+1}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
  }
  const paragraph=(text,heading=false)=>String(text || '').split('\n').map(line=>`<w:p>${heading?'<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>':''}<w:r><w:t xml:space="preserve">${projectXml(line)}</w:t></w:r></w:p>`).join('');
  const table=rows=>`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:color="DCE6E4"/>`).join('')}</w:tblBorders></w:tblPr>${rows.map(row=>`<w:tr>${row.map(cell=>`<w:tc>${paragraph(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
  let body='';
  for(const key of projectReportOrder(snap)){
    const title=projectReportTitle(snap,key),text=snap.config.texts[key];
    if(body)body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    body+=paragraph(key==='cover'?snap.name:title,true);
    if(key==='cover'){body+=paragraph('รายงานโครงการ · '+snap.code)+paragraph(snap.objective);if(snap.photos[0])body+=images.get(snap.photos[0].id);body+=paragraph('ข้อมูล ณ '+new Date(snap.createdAt).toLocaleDateString('th-TH'));}
    if(key==='objective')body+=paragraph(text ?? snap.objective);
    if(key==='conclusion')body+=paragraph(text ?? snap.conclusion);
    if(key==='work'){body+=paragraph(text);for(const t of snap.tasks){body+=paragraph(t.title,true)+paragraph((t.date || 'ยังไม่กำหนดวัน')+' · '+t.status)+paragraph(t.note);for(const r of snap.records.filter(r=>r.taskId===t.id))body+=paragraph(r.workNote)+paragraph(r.note);}}
    if(['results','raw'].includes(key) && snap.hasExperiment!==false)body+=paragraph(text)+table([['วันที่','ตัวอย่าง','ค่าวัด','ผล','หมายเหตุ'],...snap.results.map(o=>[o.date,o.unitLabel,o.metric,o.value+' '+o.unit,o.note || ''])]);
    if(key==='raw' && snap.hasExperiment===false)body+=paragraph(text);
    if(key==='raw' && snap.attachments?.length){body+=paragraph('เอกสารประกอบโครงการ',true);for(const file of snap.attachments)body+=paragraph(file.name+(file.caption?' — '+file.caption:''));body+=paragraph('ไฟล์ต้นฉบับเก็บในข้อมูลโครงการ');}
    if(key==='photos'){body+=paragraph(text);for(const ph of snap.photos)body+=images.get(ph.id)+paragraph((ph.unitLabel || '')+' · '+ph.caption);}
    if(key==='costs')body+=paragraph(text)+paragraph('ต้นทุนรวม '+snap.cost+' บาท')+table([['กิจกรรม','ต้นทุน (บาท)'],...snap.tasks.filter(t=>t.status==='done').map(t=>[t.title,String(t.cost)])]);
    if(key==='events'){body+=paragraph(text);for(const e of snap.events)body+=paragraph((e.oldDate?e.oldDate+' → '+e.newDate:e.date)+' · '+e.reason+' · '+e.by);}
  }
  files['[Content_Types].xml']='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  files['_rels/.rels']='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  files['word/_rels/document.xml.rels']='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+relationships.join('')+'</Relationships>';
  files['word/styles.xml']='<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Sarabun" w:hAnsi="Sarabun" w:cs="Sarabun"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:color w:val="00856F"/><w:sz w:val="32"/></w:rPr></w:style></w:styles>';
  files['word/document.xml']='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';
  return projectZip(files);
}
