/* शिक्षण परिषद – शिक्षक (teacher.html).
   शिक्षक लॉगिन केल्यावर "शिक्षण परिषद" मध्ये आपल्या केंद्राची परिषद दिसते. परिषदेच्या वेळेत व KP ने ठरवलेल्या ठिकाणाच्या अंतरात असेल तरच
   GPS तपासणी होऊन सही करण्याची चौकट उघडते; सही व स्थान सर्व्हरवर जतन होते. अंतर व वेळ सर्व्हरवरच तपासली जाते (/api/t/pr, /api/t/prsign).
   वापरते: teacher.html (d, post, E, home). सर्व नावे psh ने सुरू होतात. */
var PSH={cur:null,pos:null,ok:0,sg:0,photo:null,stream:null,off:0,dist:0,place:''};
function pshDm(s){var m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:(s||'')}
function pshTm(ts){try{var x=new Date(new Date(ts).getTime()+19800000);return ('0'+x.getUTCHours()).slice(-2)+':'+('0'+x.getUTCMinutes()).slice(-2)}catch(e){return ''}}
function pshErr(j){
 var e=j&&j.e;
 if(e==='far')return '❌ तुम्ही परिषदेच्या ठिकाणापासून सुमारे '+j.dist+' मीटर दूर आहात (परवानगी '+j.rad+' मीटर). परिषदेच्या ठिकाणी पोहोचल्यावर पुन्हा प्रयत्न करा.';
 if(e==='acc')return '⚠️ फोनचे GPS नीट लागत नाही (अचूकता ±'+j.acc+' मीटर). मोकळ्या जागेत जा, फोनचे Location चालू करा आणि पुन्हा प्रयत्न करा.';
 if(e==='early')return 'सही परिषदेच्या ३० मिनिटे आधीपासून करता येईल ('+pshDm(j.dt)+', '+j.tf+').';
 if(e==='late')return 'सही करण्याची वेळ संपली आहे. केंद्रप्रमुखांना सांगा, ते तुमची उपस्थिती नोंदवू शकतात.';
 if(e==='closed')return 'ही परिषद बंद झाली आहे. केंद्रप्रमुखांना सांगा.';
 if(e==='done')return '✔ तुमची उपस्थिती आधीच नोंदली आहे.';
 if(e==='sign')return 'आधी चौकटीत सही करा.';
 if(e==='photo')return 'आधी सेल्फी फोटो काढा.';
 if(e==='noimg')return 'फोटो साठवण्याची सुविधा सध्या बंद आहे. केंद्रप्रमुखांना सांगा.';
 if(e==='nf')return 'परिषद सापडली नाही.';
 if(e==='net'||j&&j.$s===0)return 'इंटरनेट तपासा.';
 if(j&&j.$s===401)return 'सत्र संपले. पुन्हा लॉगिन करा.';
 return 'काम झाले नाही. पुन्हा प्रयत्न करा.'}
function pshGo(){
 pshStop();
 d.innerHTML='<button class="g" onclick="home()">← मागे</button><div class="card"><h2>🧑‍🏫 शिक्षण परिषद</h2><p>⏳ लोड होत आहे…</p></div>';
 post('/api/t/pr',{}).then(function(j){
  var h='<button class="g" onclick="home()">← मागे</button><div class="card"><h2>🧑‍🏫 शिक्षण परिषद</h2>';
  if(!j.ok){d.innerHTML=h+'<p class="er">'+pshErr(j)+'</p><button onclick="pshGo()">पुन्हा प्रयत्न</button></div>';return}
  PSH.rows=j.rows;
  if(!j.rows.length)h+='<p>तुमच्या केंद्राची शिक्षण परिषद अजून ठरवलेली नाही. केंद्रप्रमुखांनी परिषद ठरवल्यावर येथे दिसेल.</p>';
  h+='<small style="display:block;margin-bottom:6px">परिषदेच्या दिवशी परिषदेच्या ठिकाणी जाऊन येथे सेल्फी काढून सही करा. फोनचे Location (GPS) चालू ठेवा. सेल्फी फोटो शैक्षणिक वर्ष संपल्यावर (जूनमध्ये) आपोआप हटवला जातो; उपस्थिती व सही कायम राहते.</small></div>';
  j.rows.forEach(function(r){
   var st;
   if(r.m)st='<div style="color:#15803d;font-weight:600">✔ उपस्थिती नोंदली'+(r.m==='kp'?' (केंद्रप्रमुखांनी नोंदवली)':' · '+pshTm(r.ts)+' ला तुमची सही')+'</div>';
   else if(r.w==='ok')st='<button onclick="pshSign('+r.id+')">✍ उपस्थिती / सही करा</button>';
   else if(r.w==='early')st='<small>'+(r.dt===j.now.dt?'सही '+r.tf+' च्या ३० मिनिटे आधीपासून सुरू होईल.':'परिषदेच्या दिवशी सही करता येईल.')+'</small>';
   else if(r.w==='late')st='<small style="color:#b91c1c">वेळ संपली – उपस्थिती नोंदली नाही. केंद्रप्रमुखांना सांगा.</small>';
   else st='<small>परिषद बंद झाली.</small>';
   h+='<div class="card"><b>'+pshDm(r.dt)+(r.dt===j.now.dt?' · आज':'')+' · '+E(r.tf)+'–'+E(r.tt)+'</b><div>'+E(r.place)+'</div>'+(r.agenda?'<small style="display:block;white-space:pre-wrap;margin-top:4px">विषय: '+E(r.agenda)+'</small>':'')+'<div style="margin-top:8px">'+st+'</div></div>'});
  d.innerHTML=h})}

/* ===== सही करण्याची स्क्रीन: १) GPS तपासणी  २) सेल्फी  ३) सही ===== */
function pshStop(){try{if(PSH.stream)PSH.stream.getTracks().forEach(function(t){t.stop()})}catch(e){}PSH.stream=null}
function pshSign(id){
 PSH.cur=id;PSH.pos=null;PSH.ok=0;PSH.sg=0;PSH.photo=null;
 d.innerHTML='<button class="g" onclick="pshGo()">← मागे</button><div class="card"><h2>✍ परिषद उपस्थिती</h2><div id="pshs"></div>'
 +'<div id="pshc" style="display:none"><b>सेल्फी फोटो</b><div style="text-align:center;margin:6px 0"><video id="pshvid" playsinline autoplay muted style="width:100%;max-width:240px;aspect-ratio:3/4;object-fit:cover;background:#000;border-radius:10px;transform:scaleX(-1)"></video><img id="pshimg" alt="" style="display:none;width:100%;max-width:240px;border-radius:10px;margin:0 auto"></div>'
 +'<div class="r"><button id="pshsh" onclick="pshShot()">📸 फोटो काढा</button> <button id="pshrt" class="g" style="display:none" onclick="pshRetake()">🔄 पुन्हा काढा</button></div><p id="pshce" class="er"></p>'
 +'<label id="pshfb" style="display:none;padding:8px 12px;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;margin:4px 0">📷 कॅमेरा चालत नसेल तर येथून फोटो काढा<input type="file" accept="image/*" capture="user" style="display:none" onchange="pshFile(this)"></label>'
 +'<hr style="border:0;border-top:1px solid #e2e8f0;margin:10px 0"><b>सही</b><canvas id="pshv" width="400" height="160" style="width:100%;height:auto;aspect-ratio:400/160;background:#fff;border:2px dashed #94a3b8;border-radius:10px;touch-action:none;margin-top:6px"></canvas><small>वरच्या चौकटीत बोटाने सही करा.</small><p id="pshe" class="er"></p><div class="r"><button onclick="pshOk()">✔ उपस्थिती जतन करा</button> <button class="g" onclick="pshClr()">🧽 सही पुसा</button></div></div></div>';
 pshChk()}
function pshSt(h){var e=document.getElementById('pshs');if(e)e.innerHTML=h}
function pshChk(){
 PSH.ok=0;PSH.photo=null;pshStop();var c=document.getElementById('pshc');if(c)c.style.display='none';
 pshSt('<p>📍 तुमचे स्थान तपासत आहे… (Location ची परवानगी द्या)</p>');
 if(!navigator.geolocation){pshSt('<p class="er">या फोनमध्ये स्थान सुविधा उपलब्ध नाही.</p>');return}
 navigator.geolocation.getCurrentPosition(function(p){
  PSH.pos={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0)};
  post('/api/t/prsign',{id:PSH.cur,chk:1,lat:PSH.pos.lat,lng:PSH.pos.lng,acc:PSH.pos.acc}).then(function(j){
   if(j.ok&&j.chk){PSH.ok=1;PSH.dist=j.dist;PSH.place=j.pl||'';PSH.off=(j.ts||Date.now())-Date.now();pshSt('<p style="color:#15803d;font-weight:600">✅ तुम्ही परिषदेच्या ठिकाणी आहात (अंतर सुमारे '+j.dist+' मी).</p>');pshPad();pshCamStart();return}
   pshSt('<p class="er">'+pshErr(j)+'</p>'+(j.e==='far'||j.e==='acc'?'<button onclick="pshChk()">🔄 पुन्हा तपासा</button>':''))
  }).catch(function(){pshSt('<p class="er">इंटरनेट तपासा.</p><button onclick="pshChk()">🔄 पुन्हा तपासा</button>')})
 },function(er){
  pshSt('<p class="er">'+(er&&er.code===1?'स्थानाची परवानगी नाकारली आहे. ब्राउझरच्या सेटिंगमध्ये "Location" ला अनुमती द्या व पुन्हा प्रयत्न करा.':'स्थान मिळाले नाही. GPS / Location चालू करून, मोकळ्या जागेत पुन्हा प्रयत्न करा.')+'</p><button onclick="pshChk()">🔄 पुन्हा प्रयत्न</button>')
 },{enableHighAccuracy:true,timeout:20000,maximumAge:0})}

/* ---- सेल्फी: लाईव्ह कॅमेरा; फोटोवर तारीख, वेळ, ठिकाण व अंतर छापले जाते ---- */
function pshCamStart(){
 var v=document.getElementById('pshvid'),im=document.getElementById('pshimg'),sh=document.getElementById('pshsh'),rt=document.getElementById('pshrt'),ce=document.getElementById('pshce'),fb=document.getElementById('pshfb');if(!v)return;
 v.style.display='';im.style.display='none';sh.style.display='';rt.style.display='none';ce.textContent='';
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){v.style.display='none';sh.style.display='none';fb.style.display='inline-block';ce.textContent='या ब्राउझरमध्ये कॅमेरा थेट उघडत नाही.';return}
 navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:640}},audio:false}).then(function(st){PSH.stream=st;v.srcObject=st;var q=v.play();if(q&&q.catch)q.catch(function(){})}).catch(function(){v.style.display='none';sh.style.display='none';fb.style.display='inline-block';ce.textContent='कॅमेराची परवानगी मिळाली नाही. ब्राउझरच्या सेटिंगमध्ये "Camera" ला अनुमती द्या, किंवा खालील बटणाने फोटो काढा.'})}
function pshStamp(src,sw,sh2){
 var c=document.createElement('canvas');c.width=240;c.height=320;var x=c.getContext('2d'),a=.75,cw,ch,sx,sy;
 if(sw/sh2>a){ch=sh2;cw=sh2*a;sx=(sw-cw)/2;sy=0}else{cw=sw;ch=sw/a;sx=0;sy=(sh2-ch)/2}
 x.drawImage(src,sx,sy,cw,ch,0,0,240,320);
 var t=new Date(Date.now()+PSH.off+19800000),p2=function(n){return ('0'+n).slice(-2)},l1=p2(t.getUTCDate())+'/'+p2(t.getUTCMonth()+1)+'/'+t.getUTCFullYear()+'  '+p2(t.getUTCHours())+':'+p2(t.getUTCMinutes()),pl=String(PSH.place||'');if(pl.length>28)pl=pl.slice(0,27)+'…';
 x.fillStyle='rgba(0,0,0,.6)';x.fillRect(0,320-38,240,38);x.fillStyle='#fff';x.font='bold 13px sans-serif';x.fillText(l1,6,320-22);x.font='12px sans-serif';x.fillText(pl+' · '+PSH.dist+' मी',6,320-6);
 return c.toDataURL('image/jpeg',.6)}
function pshShow(url){var v=document.getElementById('pshvid'),im=document.getElementById('pshimg');PSH.photo=url;im.src=url;im.style.display='block';v.style.display='none';document.getElementById('pshsh').style.display='none';document.getElementById('pshrt').style.display='';document.getElementById('pshce').textContent='';pshStop()}
function pshShot(){var v=document.getElementById('pshvid'),ce=document.getElementById('pshce');if(!v||!v.videoWidth){ce.textContent='कॅमेरा अजून तयार होत आहे. थोडा थांबून पुन्हा दाबा.';return}pshShow(pshStamp(v,v.videoWidth,v.videoHeight))}
function pshRetake(){PSH.photo=null;pshCamStart()}
function pshFile(inp){var f=inp.files&&inp.files[0];if(!f)return;var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){document.getElementById('pshfb').style.display='none';pshShow(pshStamp(im,im.width,im.height))};im.src=r.result};r.readAsDataURL(f)}

/* ---- सही ---- */
function pshPad(){
 var w=document.getElementById('pshc'),c=document.getElementById('pshv');if(!c)return;w.style.display='block';
 var x=c.getContext('2d'),dr=false;PSH.sg=0;x.clearRect(0,0,c.width,c.height);x.lineWidth=2.6;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#111';
 function pt(ev){var r=c.getBoundingClientRect();return[(ev.clientX-r.left)*c.width/r.width,(ev.clientY-r.top)*c.height/r.height]}
 c.onpointerdown=function(ev){dr=true;try{c.setPointerCapture(ev.pointerId)}catch(z){}var q=pt(ev);x.beginPath();x.moveTo(q[0],q[1]);x.lineTo(q[0]+.1,q[1]+.1);x.stroke();PSH.sg++;ev.preventDefault()};
 c.onpointermove=function(ev){if(!dr)return;var q=pt(ev);x.lineTo(q[0],q[1]);x.stroke();x.beginPath();x.moveTo(q[0],q[1]);PSH.sg++;ev.preventDefault()};
 c.onpointerup=c.onpointercancel=function(){dr=false}}
function pshClr(){var c=document.getElementById('pshv');if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);PSH.sg=0}}
function pshOk(){
 var c=document.getElementById('pshv'),er=document.getElementById('pshe');if(!c||!PSH.ok||!PSH.pos)return;
 if(!PSH.photo){er.textContent='आधी सेल्फी फोटो काढा.';return}
 if(PSH.sg<3){er.textContent='आधी चौकटीत सही करा.';return}
 var o=document.createElement('canvas');o.width=300;o.height=120;var x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,120);x.drawImage(c,0,0,300,120);
 er.textContent='⏳ जतन होत आहे…';
 post('/api/t/prsign',{id:PSH.cur,lat:PSH.pos.lat,lng:PSH.pos.lng,acc:PSH.pos.acc,sign:o.toDataURL('image/png'),photo:PSH.photo}).then(function(j){
  if(j.ok){pshStop();d.innerHTML='<div class="card"><h2>✔ उपस्थिती नोंदली</h2><p>तुमचा फोटो, सही व स्थान नोंदले गेले आहे.</p><button onclick="pshGo()">ठीक आहे</button></div>';return}
  if(j.e==='far'||j.e==='acc'){PSH.ok=0;document.getElementById('pshc').style.display='none';pshStop();pshSt('<p class="er">'+pshErr(j)+'</p><button onclick="pshChk()">🔄 पुन्हा तपासा</button>');return}
  er.textContent=pshErr(j)}).catch(function(){er.textContent='इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.'})}
