/* शिक्षण परिषद – KP (office.html).
   KP मासिक परिषद ठरवतो (तारीख, वेळ, ठिकाण + GPS स्थान + परवानगीचे अंतर). शिक्षक आपल्या लॉगिनमधून त्या ठिकाणाहून GPS + स्वाक्षरीने उपस्थिती नोंदवतात (psh.js).
   KP स्वतः उपस्थित असल्यामुळे तो शिक्षकाची उपस्थिती हाताने नोंदवू शकतो, स्वतःची सही / उपस्थिती नोंदवू शकतो, इतिवृत्त लिहू शकतो,
   उपस्थिती पत्रक (प्रिंट / PDF) काढू शकतो. परिषद बंद केल्यावर मासिक डायरीत "केंद्र परिषद" ची नोंद आपोआप होते.
   वापरते: office.html (X, api, esc, hdr, pprint, LB, U, ROLE, DATA), reg.js (rOffBack), geo.js (geoNow, gmLoad, gmLL, gmRow, geoDm).
   सर्व नावे prc ने सुरू होतात. सर्व्हर: /api/o/prlist, prget, prsave, prdel, prmark, prkp, prsig (worker.js; तक्ते kp_pr, kp_pr_att). */
var PRC={rows:[],tot:0,today:'',cur:null,f:null,msg:''};
function prcDm(s){var m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:(s||'')}
function prcTm(ts){try{var d=new Date(new Date(ts).getTime()+19800000);return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2)}catch(e){return ''}}
function prcErr(j){return j&&j.e==='net'?'इंटरनेट तपासा.':j&&j.$s===401?'पुन्हा लॉगिन करा.':'काम झाले नाही'+(j&&j.e?' ('+esc(j.e)+')':'')+'. पुन्हा प्रयत्न करा.'}
function prcNm(u){var r=(window.DATA||[]).filter(function(x){return x.u===u})[0];return r&&r.nm?r.nm:u}

/* ===== यादी ===== */
function prcGo(){PRC.msg='';prcLoad()}
function prcLoad(){
 X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 return api('/api/o/prlist',{}).then(function(j){
  if(!j.ok){if(j.$s===401){location.reload();return}X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="er">'+prcErr(j)+(j.e!=='net'?' सर्व्हर (worker.js) नवीन आवृत्तीवर चढवला आहे का ते तपासा.':'')+'</p><button onclick="prcLoad()">पुन्हा प्रयत्न</button></div>';return}
  PRC.rows=j.rows;PRC.tot=j.tot;PRC.today=j.today;prcList()})}
function prcList(){
 var h=hdr()+rOffBack()+'<div class="card"><h2>📋 शिक्षण परिषद</h2><p class="m">मासिक परिषद ठरवा. शिक्षक परिषदेच्या ठिकाणाहून आपल्या लॉगिनमध्ये GPS + सहीने उपस्थिती नोंदवतात. तुम्ही स्वतः हाताने उपस्थिती नोंदवू शकता.</p>'+(PRC.msg?'<p class="m">'+esc(PRC.msg)+'</p>':'')+'<button onclick="prcForm(0)">➕ नवीन परिषद</button></div>';
 if(!PRC.rows.length)h+='<div class="card"><p class="m">अजून एकही परिषद ठरवलेली नाही.</p></div>';
 PRC.rows.forEach(function(r){
  var tg=r.st==='closed'?'<span class="m">🔒 बंद</span>':r.dt===PRC.today?'<span class="ok">● आजची</span>':r.dt>PRC.today?'<span class="m">पुढील</span>':'<span class="no">खुली (जुनी)</span>';
  h+='<div class="card" style="cursor:pointer" onclick="prcOpen('+r.id+')"><div style="display:flex;justify-content:space-between;gap:8px"><b>'+prcDm(r.dt)+' · '+esc(r.tf)+'–'+esc(r.tt)+'</b>'+tg+'</div><div>'+esc(r.place)+'</div><small>उपस्थित शिक्षक: <b>'+r.n+'</b> / '+PRC.tot+'</small></div>'});
 X.innerHTML=h;window.scrollTo(0,0)}

/* ===== परिषद ठरवणे / बदलणे ===== */
function prcForm(id){
 var p=id&&PRC.cur&&PRC.cur.p&&PRC.cur.p.id===id?PRC.cur.p:null,d=new Date(Date.now()+19800000).toISOString().slice(0,10);
 PRC.f={id:id||0,lat:p?p.lat:null,lng:p?p.lng:null,src:p?'आधी ठरवलेले स्थान':'',st:p?p.st:'open',minutes:p?p.minutes:''};
 var sc=(window.DATA||[]).map(function(r){return r.u}).sort(function(a,b){return prcNm(a).localeCompare(prcNm(b))});
 X.innerHTML=hdr()+'<button class="g" onclick="'+(id?'prcShow()':'prcLoad()')+'">← मागे</button><div class="card"><h2>'+(id?'✏ परिषद बदला':'➕ नवीन शिक्षण परिषद')+'</h2>'
 +'<label>तारीख</label><input id="prd" type="date" value="'+(p?p.dt:d)+'">'
 +'<div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>सुरू होण्याची वेळ</label><input id="prf" type="time" value="'+(p?p.tf:'10:00')+'"></div><div style="flex:1"><label>संपण्याची वेळ</label><input id="prt2" type="time" value="'+(p?p.tt:'13:00')+'"></div></div>'
 +'<small>शिक्षक सही सुरू होण्याच्या ३० मिनिटे आधीपासून ते संपण्याच्या वेळेपर्यंत करू शकतात.</small>'
 +'<label style="margin-top:8px">परिषदेची शाळा (ऐच्छिक – निवडल्यावर तिचे नकाशावरील स्थान घेतले जाते)</label><select id="pru" onchange="prcPick(this.value)"><option value="">— निवडा —</option>'+sc.map(function(u){return '<option value="'+u+'"'+(p&&p.udise===u?' selected':'')+'>'+esc(prcNm(u))+'</option>'}).join('')+'</select>'
 +'<label>ठिकाणाचे नाव</label><input id="prp" maxlength="80" placeholder="उदा. जि.प. शाळा गिरगाव" value="'+esc(p?p.place:'')+'">'
 +'<label>परिषदेचे स्थान (GPS)</label><div id="prl" class="m"></div><button class="g" onclick="prcHere()">📍 मी परिषदेच्या ठिकाणी आहे – आत्ताचे स्थान घ्या</button>'
 +'<label>सही करण्यासाठी परवानगी असलेले अंतर</label><select id="prr">'+[100,200,300,500,1000].map(function(v){return '<option value="'+v+'"'+((p?p.rad:300)===v?' selected':'')+'>'+(v<1000?v+' मीटर':'१ किमी')+'</option>'}).join('')+'</select>'
 +'<small>शिक्षक या अंतरात असेल तरच सही करू शकतो. डोंगराळ भागात GPS ५०–१०० मी चुकू शकतो, म्हणून २००–३०० मी ठेवणे योग्य.</small>'
 +'<label style="margin-top:8px">विषयसूची (ऐच्छिक)</label><textarea id="pra" rows="4" maxlength="1500" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border-radius:10px;border:1px solid var(--l);background:var(--c);color:var(--i)">'+esc(p?p.agenda:'')+'</textarea>'
 +'<p id="pre" class="er"></p><button onclick="prcSave()">💾 जतन करा</button></div>';
 prcLoc();window.scrollTo(0,0)}
function prcLoc(){var e=document.getElementById('prl');if(!e)return;var f=PRC.f;e.innerHTML=f.lat!=null?'✅ स्थान नोंदले ('+esc(f.src)+') · <a href="'+geoLink(f.lat,f.lng)+'" target="_blank">नकाशावर पाहा</a>':'<span class="no">स्थान अजून ठरवलेले नाही – शाळा निवडा किंवा खालील बटण दाबा.</span>'}
function prcPick(u){if(!u)return;var p=document.getElementById('prp');if(p&&!p.value.trim())p.value=prcNm(u);
 try{gmLoad(function(){var r=gmRow(u),q=r&&gmLL(r);if(q){PRC.f.lat=q[0];PRC.f.lng=q[1];PRC.f.src='शाळेचे स्थान'+(r.lat==null?' – अंदाजे, सरकारी यादी':'');prcLoc()}else{var e=document.getElementById('prl');if(e&&PRC.f.lat==null)e.innerHTML='<span class="no">या शाळेचे स्थान उपलब्ध नाही. परिषदेच्या ठिकाणी जाऊन "आत्ताचे स्थान घ्या" दाबा.</span>'}})}catch(e){}}
function prcHere(){var e=document.getElementById('prl');if(e)e.textContent='⏳ स्थान घेत आहे…';
 geoNow(function(g){if(g.e){if(e)e.innerHTML='<span class="er">'+esc(g.e)+'</span>';return}PRC.f.lat=g.lat;PRC.f.lng=g.lng;PRC.f.src='आत्ताचे स्थान, अचूकता ±'+g.acc+' मी';prcLoc()})}
function prcSave(){
 var f=PRC.f,v=function(i){return document.getElementById(i).value},er=document.getElementById('pre');
 if(!v('prd')||!v('prf')||!v('prt2')){er.textContent='तारीख व दोन्ही वेळा भरा.';return}
 if(v('prt2')<=v('prf')){er.textContent='संपण्याची वेळ सुरू होण्याच्या वेळेनंतर हवी.';return}
 if(!v('prp').trim()){er.textContent='ठिकाणाचे नाव भरा.';return}
 if(f.lat==null){er.textContent='परिषदेचे GPS स्थान ठरवा (शाळा निवडा किंवा "आत्ताचे स्थान घ्या").';return}
 er.textContent='⏳ जतन होत आहे…';
 api('/api/o/prsave',{id:f.id,dt:v('prd'),tf:v('prf'),tt:v('prt2'),place:v('prp').trim(),udise:v('pru'),lat:f.lat,lng:f.lng,rad:+v('prr'),agenda:v('pra'),minutes:f.minutes||'',st:f.st||'open'}).then(function(j){
  if(!j.ok){er.textContent=j.e==='loc'?'स्थान चुकीचे आहे.':j.e==='max'?'परिषदांची संख्या मर्यादेपर्यंत पोहोचली.':prcErr(j);return}
  PRC.msg='✓ परिषद जतन झाली';prcOpen(j.id)})}

/* ===== परिषद उघडणे (उपस्थिती) ===== */
function prcOpen(id){
 X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 return api('/api/o/prget',{id:id}).then(function(j){
  if(!j.ok){X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="er">'+prcErr(j)+'</p><button onclick="prcLoad()">यादीकडे</button></div>';return}
  PRC.cur=j;prcShow()})}
function prcShow(){
 var j=PRC.cur,p=j.p,am={};j.at.forEach(function(a){am[a.w]=a});
 var tch=j.ros,n=tch.filter(function(t){return am[t.sh]}).length,kpa=am.KP,closed=p.st==='closed';
 var h=hdr()+'<button class="g" onclick="prcLoad()">← परिषद यादी</button><div class="card"><h2>📋 '+prcDm(p.dt)+' · '+esc(p.tf)+'–'+esc(p.tt)+'</h2><div>'+esc(p.place)+(closed?' · <b>🔒 बंद</b>':'')+'</div>'
 +(p.agenda?'<small style="display:block;white-space:pre-wrap;margin-top:4px">विषय: '+esc(p.agenda)+'</small>':'')
 +'<small style="display:block;margin-top:4px">सही परवानगी अंतर: '+p.rad+' मी · <a href="'+geoLink(p.lat,p.lng)+'" target="_blank">📍 स्थान</a></small>'
 +(PRC.msg?'<p class="m">'+esc(PRC.msg)+'</p>':'')
 +'<div class="kp" style="margin-top:10px"><div><small>उपस्थित शिक्षक</small><b class="ok">'+n+'</b></div><div><small>अनुपस्थित</small><b class="'+(tch.length-n?'no':'')+'">'+(tch.length-n)+'</b></div><div><small>एकूण शिक्षक</small><b>'+tch.length+'</b></div></div>'
 +'<div class="row"><button class="g" onclick="prcOpen('+p.id+')">🔄 रिफ्रेश</button><button class="g" onclick="prcForm('+p.id+')">✏ बदला</button><button class="g" onclick="prcPrint()">🖨 उपस्थिती पत्रक (प्रिंट / PDF)</button></div></div>';
 /* केंद्रप्रमुखाची स्वतःची उपस्थिती */
 h+='<div class="card"><b>🏢 केंद्रप्रमुख (मी)</b><div style="margin:6px 0">'+(kpa?'<span class="ok">✔ उपस्थित · '+prcTm(kpa.ts)+(kpa.s?' · सही केली':'')+'</span>':'<span class="m">अजून नोंद नाही</span>')+'</div>'
 +'<div class="row">'+(kpa?'<button class="g" onclick="prcKpOff()">✖ माझी उपस्थिती काढा</button>':'<button onclick="prcKpSign()">✍ माझी सही करा</button><button class="g" onclick="prcKpMark()">✔ फक्त उपस्थित नोंदवा</button>')+'</div></div>';
 /* शिक्षक यादी */
 h+='<div class="card"><b>👨‍🏫 शिक्षक</b><small style="display:block;margin:2px 0 6px">शिक्षकाने स्वतः GPS + सेल्फी + सहीने नोंदवले तर ✔ दिसते; 📷 दाबून सेल्फी पाहा. सेल्फी फोटो शैक्षणिक वर्ष संपल्यावर (१ जूनला) आपोआप हटतो; उपस्थिती व सही कायम राहते. तुम्ही प्रत्यक्ष पाहून "उपस्थित" नोंदवू शकता – ती नोंद पत्रकात "केंद्रप्रमुखाने नोंदवले" अशी दिसेल.</small>';
 if(!tch.length)h+='<p class="m">या केंद्रात मंजूर शिक्षक नाहीत.</p>';
 var last='';
 tch.forEach(function(t,i){var a=am[t.sh];
  if(t.u!==last){last=t.u;h+='<div style="margin:10px 0 2px;font-weight:600;color:var(--m)">'+esc(t.sc||t.u)+'</div>'}
  h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--l)"><div style="flex:1;min-width:0">'+esc(t.n)+'<br>'+(a?'<small class="ok">✔ '+(a.m==='kp'?'तुम्ही नोंदवले':'स्वतः सही केली · '+prcTm(a.ts)+(a.d!=null?' · '+a.d+' मी':''))+'</small>':'<small class="no">अनुपस्थित / नोंद नाही</small>')+'</div>'
  +(a&&a.f?'<button class="g" style="width:auto;margin:0;padding:6px 10px" onclick="prcPhoto('+i+')" title="सेल्फी">📷</button>':'')+(a?'<button class="g" style="width:auto;margin:0;padding:6px 10px" onclick="prcMark('+i+',0)">✖</button>':'<button style="width:auto;margin:0;padding:6px 10px" onclick="prcMark('+i+',1)">✔ उपस्थित</button>')+'</div>'});
 h+='</div>';
 /* इतिवृत्त व बंद करणे */
 h+='<div class="card"><b>📝 इतिवृत्त / निर्णय</b><textarea id="prm" rows="5" maxlength="3000" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border-radius:10px;border:1px solid var(--l);background:var(--c);color:var(--i);margin-top:6px" placeholder="परिषदेतील चर्चा व निर्णय">'+esc(p.minutes)+'</textarea><div class="row"><button class="g" onclick="prcMinutes()">💾 इतिवृत्त जतन करा</button></div>'
 +'<hr style="border:0;border-top:1px solid var(--l);margin:10px 0"><div class="row">'+(closed?'<button class="g" onclick="prcClose(0)">🔓 पुन्हा उघडा (शिक्षकांना सही करता येईल)</button>':'<button onclick="prcClose(1)">🔒 परिषद बंद करा</button>')+'<button class="g" style="color:#b91c1c;border-color:#b91c1c" onclick="prcDel()">🗑 परिषद हटवा</button></div>'
 +'<small>परिषद बंद केल्यावर शिक्षकांना सही करता येत नाही आणि मासिक डायरीत "केंद्र परिषद" ची नोंद आपोआप होते.</small></div>';
 X.innerHTML=h;window.scrollTo(0,0)}
function prcMark(i,on){var t=PRC.cur.ros[i];if(!t)return;api('/api/o/prmark',{id:PRC.cur.p.id,sh:t.sh,on:on}).then(function(j){if(!j.ok){alert(prcErr(j));return}PRC.msg='';prcOpen(PRC.cur.p.id)})}
function prcKpMark(){api('/api/o/prkp',{id:PRC.cur.p.id}).then(function(j){if(!j.ok){alert(prcErr(j));return}PRC.msg='';prcOpen(PRC.cur.p.id)})}
function prcKpOff(){api('/api/o/prkp',{id:PRC.cur.p.id,off:1}).then(function(j){if(!j.ok){alert(prcErr(j));return}PRC.msg='';prcOpen(PRC.cur.p.id)})}
function prcMinutes(){var p=PRC.cur.p;prcPut({minutes:document.getElementById('prm').value},'✓ इतिवृत्त जतन झाले')}
function prcClose(c){var msg=c?'परिषद बंद करायची? यानंतर शिक्षकांना सही करता येणार नाही आणि मासिक डायरीत नोंद होईल.':'परिषद पुन्हा उघडायची?';if(!confirm(msg))return;prcPut({st:c?'closed':'open',minutes:document.getElementById('prm').value},c?'✓ परिषद बंद झाली. मासिक डायरीत नोंद केली.':'✓ परिषद पुन्हा उघडली')}
function prcPut(o,m){var p=PRC.cur.p;api('/api/o/prsave',{id:p.id,dt:p.dt,tf:p.tf,tt:p.tt,place:p.place,udise:p.udise,lat:p.lat,lng:p.lng,rad:p.rad,agenda:p.agenda,minutes:o.minutes!=null?o.minutes:p.minutes,st:o.st||p.st}).then(function(j){if(!j.ok){alert(prcErr(j));return}PRC.msg=m;prcOpen(p.id)})}
function prcDel(){if(!confirm('ही परिषद व तिची सर्व उपस्थिती कायमची हटवायची?'))return;api('/api/o/prdel',{id:PRC.cur.p.id}).then(function(j){if(!j.ok){alert(prcErr(j));return}PRC.msg='परिषद हटवली';prcLoad()})}

/* ===== शिक्षकाचा सेल्फी पाहणे (फोटो शैक्षणिक वर्ष संपल्यावर हटतो) ===== */
function prcPhoto(i){var t=PRC.cur.ros[i],a=t&&PRC.cur.at.filter(function(z){return z.w===t.sh})[0];if(!a)return;
 var e=document.createElement('div');e.id='prcph';e.style.cssText='position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.85);padding:12px;overflow:auto;text-align:center;color:#fff';
 e.innerHTML='<div style="max-width:420px;margin:0 auto"><p style="margin:6px 0"><b>'+esc(t.n)+'</b><br><small>'+prcTm(a.ts)+(a.d!=null?' · परिषदेपासून '+a.d+' मी':'')+(a.a!=null?' · GPS ±'+a.a+' मी':'')+'</small></p><p id="prcpi" style="min-height:120px">⏳ फोटो येत आहे…</p>'+(a.la!=null?'<p><a style="color:#93c5fd" href="'+geoLink(a.la,a.ln)+'" target="_blank">📍 सही केलेले स्थान नकाशावर पाहा</a></p>':'')+'<button class="g" style="background:#fff" onclick="document.getElementById(\'prcph\').remove()">बंद करा</button></div>';
 document.body.appendChild(e);
 fetch('/api/o/prpho',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:T,u:U,id:PRC.cur.p.id,w:t.sh})}).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){var p=document.getElementById('prcpi');if(p)p.innerHTML='<img alt="" style="max-width:100%;border-radius:10px" src="'+URL.createObjectURL(b)+'">'}).catch(function(){var p=document.getElementById('prcpi');if(p)p.textContent='फोटो उपलब्ध नाही (वर्ष संपल्यावर हटवला जातो).'})}

/* ===== KP ची स्वतःची सही ===== */
var PRCSG=0;
function prcKpSign(){
 var e=document.createElement('div');e.id='prcsg';e.style.cssText='position:fixed;inset:0;z-index:300;background:var(--bg);padding:12px;overflow:auto';
 e.innerHTML='<div style="max-width:560px;margin:0 auto"><div class="card"><h2>✍ केंद्रप्रमुख — स्वाक्षरी</h2><p class="m">खालील चौकटीत बोटाने सही करा.</p><canvas id="prcsc" width="400" height="160" style="width:100%;height:auto;aspect-ratio:400/160;background:#fff;border:2px dashed var(--l);border-radius:10px;touch-action:none"></canvas><p id="prcse" class="er"></p><div class="row"><button onclick="prcKpOk()">✔ जतन करा</button><button class="g" onclick="prcKpClr()">🧽 पुसा</button><button class="g" onclick="prcKpX()">रद्द</button></div></div></div>';
 document.body.appendChild(e);var c=document.getElementById('prcsc'),x=c.getContext('2d'),dr=false;PRCSG=0;x.lineWidth=2.6;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#111';
 function pt(ev){var r=c.getBoundingClientRect();return[(ev.clientX-r.left)*c.width/r.width,(ev.clientY-r.top)*c.height/r.height]}
 c.onpointerdown=function(ev){dr=true;try{c.setPointerCapture(ev.pointerId)}catch(z){}var q=pt(ev);x.beginPath();x.moveTo(q[0],q[1]);x.lineTo(q[0]+.1,q[1]+.1);x.stroke();PRCSG++;ev.preventDefault()};
 c.onpointermove=function(ev){if(!dr)return;var q=pt(ev);x.lineTo(q[0],q[1]);x.stroke();x.beginPath();x.moveTo(q[0],q[1]);PRCSG++;ev.preventDefault()};
 c.onpointerup=c.onpointercancel=function(){dr=false}}
function prcKpClr(){var c=document.getElementById('prcsc');if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);PRCSG=0}}
function prcKpX(){var e=document.getElementById('prcsg');if(e)e.remove()}
function prcKpOk(){var c=document.getElementById('prcsc'),er=document.getElementById('prcse');if(!c)return;if(PRCSG<3){er.textContent='आधी सही करा.';return}
 var o=document.createElement('canvas');o.width=300;o.height=120;var x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,120);x.drawImage(c,0,0,300,120);var sg=o.toDataURL('image/png');
 er.textContent='⏳ जतन होत आहे…';
 var go=function(g){api('/api/o/prkp',{id:PRC.cur.p.id,sign:sg,lat:g&&g.lat,lng:g&&g.lng,acc:g&&g.acc}).then(function(j){if(!j.ok){er.textContent=prcErr(j);return}prcKpX();PRC.msg='';prcOpen(PRC.cur.p.id)})};
 try{geoNow(function(g){go(g&&!g.e?g:null)})}catch(e){go(null)}}

/* ===== उपस्थिती पत्रक (प्रिंट / PDF) ===== */
function prcPrint(){
 var j=PRC.cur,p=j.p;
 api('/api/o/prsig',{id:p.id}).then(function(s){
  var sg=s.ok?s.sig:{},am={};j.at.forEach(function(a){am[a.w]=a});
  var td='border:1px solid #444;padding:4px 6px;vertical-align:middle',th='border:1px solid #444;padding:4px 6px;background:#eee',rows='',i=0;
  var row=function(nm,sc,a,key){i++;var sig=a&&sg[key]?'<img src="'+sg[key]+'" style="height:34px;max-width:130px">':'';
   return '<tr><td style="'+td+';text-align:center">'+i+'</td><td style="'+td+'">'+esc(nm)+'</td><td style="'+td+'">'+esc(sc)+'</td><td style="'+td+';text-align:center">'+(a?prcTm(a.ts):'')+'</td><td style="'+td+';text-align:center;height:40px">'+sig+'</td><td style="'+td+'">'+(a?(a.m==='kp'&&key!=='KP'?'केंद्रप्रमुखाने नोंदवले':''):'अनुपस्थित')+'</td></tr>'};
  var kpa=am.KP;rows+=row(kpa?kpa.n:'केंद्रप्रमुख','केंद्रप्रमुख',kpa,'KP');
  j.ros.forEach(function(t){rows+=row(t.n,t.sc||'',am[t.sh],t.sh)});
  var n=j.ros.filter(function(t){return am[t.sh]}).length;
  pprint('<h2 style="text-align:center;margin:0 0 4px">शिक्षण परिषद – उपस्थिती पत्रक</h2><p style="text-align:center;margin:0 0 8px">'+esc(LB)+'</p><p style="margin:0 0 4px"><b>दिनांक:</b> '+prcDm(p.dt)+' &nbsp; <b>वेळ:</b> '+esc(p.tf)+'–'+esc(p.tt)+' &nbsp; <b>ठिकाण:</b> '+esc(p.place)+'</p>'+(p.agenda?'<p style="margin:0 0 8px;white-space:pre-wrap"><b>विषय:</b> '+esc(p.agenda)+'</p>':'')
   +'<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="'+th+'">अ.क्र.</th><th style="'+th+'">नाव</th><th style="'+th+'">शाळा</th><th style="'+th+'">वेळ</th><th style="'+th+'">स्वाक्षरी</th><th style="'+th+'">शेरा</th></tr>'+rows+'</table>'
   +'<p style="margin:8px 0 0">उपस्थित शिक्षक: <b>'+n+'</b> / '+j.ros.length+(p.minutes?'</p><p style="white-space:pre-wrap"><b>इतिवृत्त / निर्णय:</b><br>'+esc(p.minutes):'')+'</p><p style="margin-top:36px;text-align:right">केंद्रप्रमुख<br>'+esc(LB)+'</p>')})}
