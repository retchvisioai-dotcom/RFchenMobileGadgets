(function(root){
  const dateFormatter=(method,locale,options)=>value=>new Date(value)[method](locale,options);
  const dayOf=dateFormatter('toLocaleDateString','en-CA',{timeZone:'Asia/Manila'});
  const shared={
    peso:n=>'₱'+Number(n||0).toLocaleString('en-PH'),
    $:id=>document.getElementById(id),
    esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    fmt:dateFormatter('toLocaleString','en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'}),
    fdate:dateFormatter('toLocaleDateString','en-PH',{year:'numeric',month:'short',day:'numeric',timeZone:'Asia/Manila'}),
    ftime:dateFormatter('toLocaleTimeString','en-PH',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'}),
    dayOf,
    today:()=>dayOf(Date.now()),
    num:v=>Number(v||0),
    resizeImage(file,max=900){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);c.toBlob(b=>res(b),'image/jpeg',.82)};im.onerror=rej;im.src=r.result};r.onerror=rej;r.readAsDataURL(file)})},
    dl(name,txt,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},
    csv:rows=>rows.map(r=>r.map(c=>{c=String(c??'');if(/^[=+\-@]/.test(c))c="'"+c;return '"'+c.replace(/"/g,'""')+'"'}).join(',')).join('\n')
  };
  root.RFGShared=Object.freeze(shared);
})(globalThis);
