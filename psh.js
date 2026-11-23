/* शिक्षण परिषद – शिक्षक (teacher.html).
   शिक्षक लॉगिन केल्यावर "शिक्षण परिषद" मध्ये आपल्या केंद्राची परिषद दिसते. परिषदेच्या वेळेत व KP ने ठरवलेल्या ठिकाणाच्या अंतरात असेल तरच
   GPS तपासणी होऊन सही करण्याची चौकट उघडते; सही व स्थान सर्व्हरवर जतन होते. अंतर व वेळ सर्व्हरवरच तपासली जाते (/api/t/pr, /api/t/prsign).
   वापरते: teacher.html (d, post, E, home). सर्व नावे psh ने सुरू होतात. */
var PSH={cur:null,pos:null,ok:0,sg:0};
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
 if(e==='nf')return 'परिषद सापडली नाही.';
 if(e==='net'||j&&j.$s===0)return 'इंटरनेट तपासा.';
 if(j&&j.$s===401)return 'सत्र संपले. पुन्हा लॉगिन करा.';
 return 'काम झाले नाही. पुन्हा प्रयत्न करा.'}
function pshGo(){
 d.innerHTML='<button class="g" onclick="home()">← मागे</button><div class="card"><h2>🧑‍🏫 शिक्षण परिषद</h2><p>⏳ लोड होत आहे…</p></div>';
 post('/api/t/pr',{}).then(function(j){
  var h='<button class="g" onclick="home()">← मागे</button><div class="card"><h2>🧑‍🏫 शिक्षण परिषद</h2>';
  if(!j.ok){d.innerHTML=h+'<p class="er">'+pshErr(j)+'</p><button onclick="pshGo()">पुन्हा प्रयत्न</button></div>';return}
  PSH.rows=j.rows;
  if(!j.rows.length)h+='<p>तुमच्या केंद्राची शिक्षण परिषद अजून ठरवलेली नाही. केंद्रप्रमुखांनी परिषद ठरवल्यावर येथे दिसेल.</p>';
  h+='<small style="display:block;margin-bottom:6px">परिषदेच्या दिवशी परिषदेच्या ठिकाणी जाऊन येथे सही करा. फोनचे Location (GPS) चालू ठेवा.</small></div>';
  j.rows.forEach(function(r){
   var st;
   if(r.m)st='<div style="color:#15803d;font-weight:600">✔ उपस्थिती नोंदली'+(r.m==='kp'?' (केंद्रप्रमुखांनी नोंदवली)':' · '+pshTm(r.ts)+' ला तुमची सही')+'</div>';
   else if(r.w==='ok')st='<button onclick="pshSign('+r.id+')">✍ उपस्थिती / सही करा</button>';
   else if(r.w==='early')st='<small>'+(r.dt===j.now.dt?'सही '+r.tf+' च्या ३० मिनिटे आधीपासून सुरू होईल.':'परिषदेच्या दिवशी सही करता येईल.')+'</small>';
   else if(r.w==='late')st='<small style="color:#b91c1c">वेळ संपली – उपस्थिती नोंदली नाही. केंद्रप्रमुखांना सांगा.</small>';
   else st='<small>परिषद बंद झाली.</small>';
   h+='<div class="card"><b>'+pshDm(r.dt)+(r.dt===j.now.dt?' · आज':'')+' · '+E(r.tf)+'–'+E(r.tt)+'</b><div>'+E(r.place)+'</div>'+(r.agenda?'<small style="display:block;white-space:pre-wrap;margin-top:4px">विषय: '+E(r.agenda)+'</small>':'')+'<div style="margin-top:8px">'+st+'</div></div>'});
  d.innerHTML=h})}

/* ===== सही करण्याची स्क्रीन: आधी GPS तपासणी, मग सही ===== */
function pshSign(id){
 PSH.cur=id;PSH.pos=null;PSH.ok=0;PSH.sg=0;
 d.innerHTML='<button class="g" onclick="pshGo()">← मागे</button><div class="card"><h2>✍ परिषद उपस्थिती</h2><div id="pshs"></div>'
 +'<div id="pshc" style="display:none"><canvas id="pshv" width="400" height="160" style="width:100%;height:auto;aspect-ratio:400/160;background:#fff;border:2px dashed #94a3b8;border-radius:10px;touch-action:none"></canvas><small>वरच्या चौकटीत बोटाने सही करा.</small><p id="pshe" class="er"></p><div class="r"><button onclick="pshOk()">✔ सही जतन करा</button> <button class="g" onclick="pshClr()">🧽 पुसा</button></div></div></div>';
 pshChk()}
function pshSt(h){var e=document.getElementById('pshs');if(e)e.innerHTML=h}
function pshChk(){
 PSH.ok=0;var c=document.getElementById('pshc');if(c)c.style.display='none';
 pshSt('<p>📍 तुमचे स्थान तपासत आहे… (Location ची परवानगी द्या)</p>');
 if(!navigator.geolocation){pshSt('<p class="er">या फोनमध्ये स्थान सुविधा उपलब्ध नाही.</p>');return}
 navigator.geolocation.getCurrentPosition(function(p){
  PSH.pos={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0)};
  post('/api/t/prsign',{id:PSH.cur,chk:1,lat:PSH.pos.lat,lng:PSH.pos.lng,acc:PSH.pos.acc}).then(function(j){
   if(j.ok&&j.chk){PSH.ok=1;pshSt('<p style="color:#15803d;font-weight:600">✅ तुम्ही परिषदेच्या ठिकाणी आहात (अंतर सुमारे '+j.dist+' मी).</p>');pshPad();return}
   pshSt('<p class="er">'+pshErr(j)+'</p>'+(j.e==='far'||j.e==='acc'?'<button onclick="pshChk()">🔄 पुन्हा तपासा</button>':''))
  }).catch(function(){pshSt('<p class="er">इंटरनेट तपासा.</p><button onclick="pshChk()">🔄 पुन्हा तपासा</button>')})
 },function(er){
  pshSt('<p class="er">'+(er&&er.code===1?'स्थानाची परवानगी नाकारली आहे. ब्राउझरच्या सेटिंगमध्ये "Location" ला अनुमती द्या व पुन्हा प्रयत्न करा.':'स्थान मिळाले नाही. GPS / Location चालू करून, मोकळ्या जागेत पुन्हा प्रयत्न करा.')+'</p><button onclick="pshChk()">🔄 पुन्हा प्रयत्न</button>')
 },{enableHighAccuracy:true,timeout:20000,maximumAge:0})}
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
 if(PSH.sg<3){er.textContent='आधी चौकटीत सही करा.';return}
 var o=document.createElement('canvas');o.width=300;o.height=120;var x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,120);x.drawImage(c,0,0,300,120);
 er.textContent='⏳ जतन होत आहे…';
 post('/api/t/prsign',{id:PSH.cur,lat:PSH.pos.lat,lng:PSH.pos.lng,acc:PSH.pos.acc,sign:o.toDataURL('image/png')}).then(function(j){
  if(j.ok){d.innerHTML='<div class="card"><h2>✔ उपस्थिती नोंदली</h2><p>तुमची सही व स्थान नोंदले गेले आहे.</p><button onclick="pshGo()">ठीक आहे</button></div>';return}
  if(j.e==='far'||j.e==='acc'){PSH.ok=0;document.getElementById('pshc').style.display='none';pshSt('<p class="er">'+pshErr(j)+'</p><button onclick="pshChk()">🔄 पुन्हा तपासा</button>');return}
  er.textContent=pshErr(j)}).catch(function(){er.textContent='इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.'})}
