/* शाळा भेट फॉर्म – KP व BEO (office.html).
   वापरते: reg.js (PH, phForm, phPick, phBtns, rOffBack, rEr), mdm.js (mMons, mLb, mDt) आणि office.html (X, api, esc, hdr, save, pprint, T, U, ROLE, LB, CEN, DATA).
   सर्व नावे vz/VZ ने सुरू होतात, म्हणजे office.html च्या नावांशी टक्कर होत नाही. */
var VZ=null,VZL=null,VZM='',VZF='',VZV='L',VZCX=null,VZSP=0,VZSE={ab:'',lv:''},VZTO=null;
var VZOP=[['Y','होय','#15803d'],['P','अंशतः','#b45309'],['N','नाही','#b91c1c'],['X','लागू नाही','#64748b']];
var VZTS=[['P','उपस्थित'],['L','उशिरा आले'],['A','रजेवर'],['T','प्रशिक्षण / कामगिरी'],['U','विनापरवानगी गैरहजर']];
var VZRE=['आजारी','गावी / बाहेरगावी','शेतीकाम / मजुरी','पालकांनी पाठवले नाही','माहीत नाही','इतर'];
var VZVT=['नियोजित भेट','अचानक भेट','पाठपुरावा भेट','विशेष भेट'];
var VZGL={A:'A – उत्कृष्ट',B:'B – चांगली',C:'C – समाधानकारक',D:'D – सुधारणा आवश्यक'};
var VZGC={A:'#15803d',B:'#0f766e',C:'#b45309',D:'#b91c1c'};
var VZLN={l:'भाषा विषय – वाचन स्तर',m:'गणित विषय – स्तर',e:'इंग्रजी – वाचन स्तर'};
var VZLV={
 l:['अक्षर ओळख नाही (वाचता येत नाही)','अक्षरे ओळखतो','शब्द वाचतो','वाक्य / छोटा परिच्छेद वाचतो','गोष्ट / पाठ अस्खलित वाचतो'],
 m:['१ ते ९ संख्या ओळखत नाही','१ ते ९ संख्या ओळखतो','१० ते ९९ संख्या ओळखतो','वजाबाकी करतो','भागाकार करतो'],
 e:['काहीही ओळखत नाही','Capital letters ओळखतो','Small letters ओळखतो','Words वाचतो','Sentences वाचतो']};
var VZQ={
 a:{t:'🌿 परिसर व स्वच्छता',q:[
  ['a1','शाळेचा परिसर स्वच्छ आहे (कचरा / घाण नाही)'],['a2','कचरापेटी / कचरा टाकण्याची सोय आहे व वापरली जाते'],['a3','वर्गखोल्या स्वच्छ असून रोज झाडलोट होते'],
  ['a4','मुलांचे स्वच्छतागृह वापरण्यायोग्य व स्वच्छ'],['a5','मुलींचे स्वच्छतागृह वापरण्यायोग्य व स्वच्छ (पाणी, दरवाजा, कडी)'],
  ['a6','पिण्याच्या पाण्याची सोय आहे; पाणी शुद्ध व झाकलेले'],['a7','हात धुण्याची सोय (पाणी व साबण) आहे'],['a8','संरक्षक भिंत / कुंपण व गेट सुस्थितीत'],
  ['a9','वीज, दिवे व पंखे चालू स्थितीत'],['a10','बाग / झाडे / परसबागेची निगा राखली आहे'],['a11','इमारत सुरक्षित (गळती, तडे, धोकादायक भाग नाहीत)'],
  ['a12','बोलक्या भिंती / शैक्षणिक वातावरण आहे'],['a13','विद्यार्थी स्वच्छ गणवेशात; नखे व केस स्वच्छ'],['a14','प्रथमोपचार पेटी उपलब्ध व साहित्य पुरेसे']]},
 b:{t:'🍚 PM पोषण (शालेय पोषण आहार)',q:[
  ['b1','आजचा आहार शिजवून नियमित वाटप झाले'],['b2','आहार मेनू (आहार तक्ता) प्रमाणे दिला जातो'],['b3','आहाराची चव व प्रमाण योग्य (चाखून पाहिले)'],
  ['b4','स्वयंपाकघर स्वच्छ; इंधन / गॅस उपलब्ध; उंदीर-झुरळ नाहीत'],['b5','भांडी, ताट-वाट्या स्वच्छ'],['b6','धान्य / कडधान्य साठा सुरक्षित, झाकलेला; किडलेले नाही'],
  ['b7','साठा नोंदवही अद्ययावत व प्रत्यक्ष साठ्याशी जुळते'],['b8','दैनिक आहार उपस्थिती नोंदवही अद्ययावत (पटाप्रमाणे)'],['b9','आहार चाखणी नोंदवही अद्ययावत'],
  ['b10','स्वयंपाकी / मदतनीस उपस्थित; स्वच्छतेचे नियम पाळतात'],['b11','शिजवण्यासाठी व पिण्यासाठी शुद्ध पाणी वापरतात'],['b12','विद्यार्थी हात धुऊन रांगेत बसून आहार घेतात'],
  ['b13','पूरक आहार (अंडी / केळी इ.) लागू असल्यास नियमित'],['b14','अन्न वाया जाणे नियंत्रणात; शिल्लक अन्नाची योग्य विल्हेवाट'],['b15','तांदूळ आवक, पावती व देयके नोंदी अद्ययावत']]},
 c:{t:'🗂 शाळेचे रेकॉर्ड (दप्तर)',q:[
  ['c1','विद्यार्थी हजेरी पट रोज अद्ययावत'],['c2','जनरल रजिस्टर (GR) / प्रवेश-निर्गम नोंदी अद्ययावत'],['c3','शिक्षक हजेरी पत्रक व रजा नोंदवही अद्ययावत'],
  ['c4','भेट नोंदवही (अधिकाऱ्यांच्या भेटी) अद्ययावत'],['c5','सरल / UDISE+ माहिती अद्ययावत'],['c6','CCE गुणनोंद, निकाल व प्रगती पुस्तक (HPC) अद्ययावत'],
  ['c7','साहित्य / स्टॉक नोंदवही अद्ययावत'],['c8','पाठ्यपुस्तक, गणवेश व DBT वितरण नोंदी'],['c9','शाळा व्यवस्थापन समिती (SMC) सभा इतिवृत्त'],
  ['c10','पालक सभा / माता-पालक संघ नोंदी'],['c11','आर्थिक नोंदी (शालेय अनुदान, खर्च, रोकड वही) अद्ययावत'],['c12','शाळा विकास आराखडा / शाळा सिद्धी'],
  ['c13','माहिती फलक (शाळेचे नाव, UDISE, पट, हजेरी) लावलेला'],['c14','अभिलेख कपाट व्यवस्थित व सुरक्षित'],['c15','वार्षिक कृती आराखडा / शैक्षणिक दिनदर्शिका'],['c16','शिक्षक कार्यवाटप / वर्गवाटप तक्ता']]}
};
var VZTQ=[
 ['t1','दैनिक टाचण (पाठ टिपण) लिहिलेले'],['t2','मासिक नियोजन आहे'],['t3','वार्षिक नियोजन (अभ्यासक्रम विभाजन) आहे'],['t4','वेळापत्रक (वर्ग / शिक्षक) आहे'],
 ['t5','प्रत्यक्ष अध्यापन सुरू (वर्गात पाहिले)'],['t6','शैक्षणिक साहित्याचा वापर'],['t7','वह्या तपासणी / गृहपाठ नियमित'],['t8','आकारिक मूल्यमापन / CCE नोंदी अद्ययावत'],
 ['t9','वर्गाची हजेरी नोंद अद्ययावत'],['t10','उपचारात्मक / प्रगत विद्यार्थ्यांसाठी नियोजन'],['t11','अभ्यासक्रम प्रगती नियोजनानुसार']];
var VZST=['भेट माहिती','🌿 स्वच्छता','🍚 PM पोषण','🗂 रेकॉर्ड','👨‍🏫 शिक्षक','🧑‍🎓 विद्यार्थी','📝 निरीक्षण'];

(function(){var s=document.createElement('style');s.textContent='.vzb{width:auto!important;margin:3px 4px 3px 0!important;padding:5px 10px!important;border-radius:8px!important;font-size:13px}.vzn button{width:auto;margin:0 4px 6px 0;padding:6px 10px;font-size:13px}.vzr{padding:8px 0;border-bottom:1px solid var(--l)}.vzt td,.vzt th{border:1px solid var(--l)}#vzb label,.vzc label{display:block;margin:8px 0 2px;color:var(--m);font-size:13px}#vzb textarea,.vzc textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--l);background:var(--c);color:var(--i);margin-bottom:8px}';document.head.appendChild(s)})();

/* ---- गुणांकन ---- */
function vzPt(v){return v==='Y'?1:v==='P'?.5:v==='N'?0:null}
function vzPc(s,n){return n?Math.round(100*s/n):null}
function vzGr(p){return p===null||p===undefined?'':p>=85?'A':p>=70?'B':p>=50?'C':'D'}
function vzCalc(d){
 d=d||{};var r={};
 ['a','b','c'].forEach(function(k){var s=0,n=0,a=0;VZQ[k].q.forEach(function(q){var v=(d.k||{})[q[0]],p=vzPt(v);if(v)a++;if(p!==null){s+=p;n++}});r[k]={p:vzPc(s,n),n:n,a:a,m:VZQ[k].q.length}});
 var ts=0,tn=0,tk=d.tc||[],td=0;
 tk.forEach(function(t){if(t.s)td++;if(t.s==='P'||t.s==='L'||t.s==='U'){ts+=t.s==='P'?1:t.s==='L'?.5:0;tn++}
  if(t.s==='P'||t.s==='L')VZTQ.forEach(function(q){var p=vzPt((t.a||{})[q[0]]);if(p!==null){ts+=p;tn++}})});
 r.t={p:vzPc(ts,tn),n:td,m:tk.length};
 var an=0,ap=0;Object.keys(d.at||{}).forEach(function(k){var x=d.at[k],n=+x.n,p=+x.p;if(x.p!==''&&x.p!=null&&n>0){an+=n;ap+=Math.min(p,n)}});
 var ls=0,ln=0,lc=0;Object.keys(d.lv||{}).forEach(function(pen){var x=d.lv[pen],a=0;['l','m','e'].forEach(function(f){if(x[f]!==''&&x[f]!=null){ls+=(+x[f])/4;ln++;a=1}});lc+=a});
 var pa=vzPc(ap,an),pl=ln?Math.round(100*ls/ln):null,pp=[pa,pl].filter(function(v){return v!==null});
 r.s={p:pp.length?Math.round(pp.reduce(function(a,b){return a+b},0)/pp.length):null,att:pa,lv:pl,an:an,ap:ap,lc:lc};
 var al=['a','b','c','t','s'].map(function(k){return r[k].p}).filter(function(v){return v!==null});
 var o=al.length?Math.round(al.reduce(function(a,b){return a+b},0)/al.length):null;r.o={p:o,g:vzGr(o),k:al.length};
 return r}
function vzBadge(g){return g?'<b style="display:inline-block;min-width:22px;text-align:center;padding:1px 8px;border-radius:10px;color:#fff;background:'+VZGC[g]+'">'+g+'</b>':''}
function vzWho(c){return c==='BEO'?'गटशिक्षणाधिकारी (BEO)':'केंद्रप्रमुख – '+(CEN[c]||c)}
function vzAL(v){return v==='Y'?'✔ होय':v==='P'?'◐ अंशतः':v==='N'?'✘ नाही':v==='X'?'लागू नाही':'—'}
function vzNum(s){return String(s==null?'':s).replace(/\D/g,'').slice(0,4)}

/* ---- स्थानिक मसुदा (इंटरनेट गेल्यास माहिती वाचावी) ---- */
function vzLoc(){clearTimeout(VZTO);VZTO=setTimeout(function(){try{if(VZ)localStorage.setItem('vzd_'+U,JSON.stringify({id:VZ.id,u:VZ.u,dt:VZ.dt,tin:VZ.tin,tout:VZ.tout,vt:VZ.vt,d:VZ.d,ts:Date.now()}))}catch(e){}},400)}
function vzLocGet(){try{var s=localStorage.getItem('vzd_'+U);return s?JSON.parse(s):null}catch(e){return null}}
function vzLocDel(){try{localStorage.removeItem('vzd_'+U)}catch(e){}}

/* ---- यादी व सारांश ---- */
function vzGo(){if(!VZM){var d=new Date();VZM=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)}vzLoad()}
function vzLoad(){X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 api('/api/o/vs',{mon:VZM,c:VZF}).then(function(j){if(!j.ok){if(j.$s===401){location.reload();return}X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="er">लोड झाले नाही.</p><button onclick="vzLoad()">पुन्हा प्रयत्न</button></div>';return}VZL=j.rows;vzDraw()})}
function vzDraw(){var kp=ROLE==='KP',L=VZL||[],mine=L.filter(function(x){return x.mine}),dr=mine.filter(function(x){return x.st==='Draft'});
 var h=hdr()+rOffBack()+'<div class="card"><h2>🏫 शाळा भेट</h2><label>कालावधी</label><select onchange="VZM=this.value;vzLoad()">'+mMons().map(function(m){return '<option value="'+m+'"'+(m===VZM?' selected':'')+'>'+esc(mLb(m))+'</option>'}).join('')+'<option value="Y"'+(VZM==='Y'?' selected':'')+'>शैक्षणिक वर्ष (जून पासून)</option></select>'
  +(kp?'':'<label>केंद्र</label><select onchange="VZF=this.value;vzLoad()"><option value="">सर्व केंद्र</option>'+Object.keys(CEN).sort(function(a,b){return String(CEN[a]).localeCompare(String(CEN[b]))}).map(function(c){return '<option value="'+c+'"'+(c===VZF?' selected':'')+'>'+esc(CEN[c])+'</option>'}).join('')+'</select>')
  +'<div class="row"><button onclick="vzNew()">➕ नवीन शाळा भेट</button><button class="g" onclick="vzCsv()">⬇ CSV</button></div>'
  +'<div class="vzn" style="margin-top:6px"><button class="'+(VZV==='L'?'':'g')+'" onclick="VZV=\'L\';vzDraw()">📋 भेटी ('+L.filter(function(x){return x.st==='Final'}).length+')</button><button class="'+(VZV==='S'?'':'g')+'" onclick="VZV=\'S\';vzDraw()">🏫 शाळानिहाय सारांश</button></div></div>';
 var lc=vzLocGet();if(lc&&!VZ)h+='<div class="card" style="background:#fef9c3;border-color:#facc15;color:#713f12">⚠ अपूर्ण भेट फॉर्म फोनमध्ये आहे ('+esc(vzSn(lc.u))+', '+mDt(lc.dt)+')<div class="row" style="margin-top:6px"><button onclick="vzResume()">▶ सुरू ठेवा</button><button class="g" onclick="vzLocDel();vzDraw()">🗑 काढून टाका</button></div></div>';
 if(VZV==='S')h+=vzCov();else{
  if(!L.length)h+='<div class="card"><p class="m">या कालावधीत भेट नोंद नाही.</p></div>';
  L.forEach(function(r){h+='<div class="card"><b>'+mDt(r.dt)+'</b> · '+esc(r.sc||r.u)+' '+vzBadge(r.g)+(r.st==='Draft'?' <span class="no">(मसुदा)</span>':'')+(r.g?' <small class="m">'+r.score+'%</small>':'')+'<br><small class="m">'+esc(r.vt||'')+' · '+esc(vzWho(r.c))+(kp?'':' · '+esc(CEN[r.k]||''))+'</small><div class="row" style="margin-top:6px"><button class="g" onclick="vzView('+r.id+')">👁 पाहा</button>'+(r.mine?'<button class="g" onclick="vzEdit('+r.id+')">✏ बदला</button><button class="g" onclick="vzDel('+r.id+')">🗑 काढा</button>':'')+'</div></div>'})}
 X.innerHTML=h}
function vzSn(u){var r=(window.DATA||[]).filter(function(x){return x.u===u})[0];return r?(r.nm||u):u}
function vzCov(){var kp=ROLE==='KP',S=(window.DATA||[]).filter(function(r){return !VZF||r.c===VZF}),C={};
 (VZL||[]).forEach(function(x){if(x.st!=='Final')return;var o=C[x.u]=C[x.u]||{n:0,l:'',g:''};o.n++;if(x.dt>o.l){o.l=x.dt;o.g=x.g}});
 S=S.slice().sort(function(a,b){return ((C[a.u]?1:0)-(C[b.u]?1:0))||String(a.nm||'').localeCompare(String(b.nm||''))});
 var no=S.filter(function(r){return !C[r.u]}).length;
 return '<div class="card"><p style="margin:0 0 6px"><b>'+(S.length-no)+'</b> शाळांना भेट झाली · <b class="'+(no?'no':'ok')+'">'+no+'</b> शाळा बाकी</p><div class="w"><table><tr><th>शाळा</th>'+(kp?'':'<th>केंद्र</th>')+'<th>भेटी</th><th>शेवटची भेट</th><th></th></tr>'
  +S.map(function(r){var o=C[r.u];return '<tr><td>'+esc(r.nm||r.u)+'</td>'+(kp?'':'<td>'+esc(CEN[r.c]||'')+'</td>')+'<td class="'+(o?'ok':'no')+'">'+(o?o.n:'०')+'</td><td>'+(o?mDt(o.l):'—')+'</td><td>'+(o?vzBadge(o.g):'')+'</td></tr>'}).join('')+'</table></div></div>'}
function vzCsv(){var kp=ROLE==='KP';save('shala_bhet.csv',[['दिनांक','शाळा','UDISE','केंद्र','भेट देणारे','भेट प्रकार','वेळ','गुण %','श्रेणी','स्थिती']].concat((VZL||[]).map(function(r){return [r.dt,r.sc,r.u,CEN[r.k]||r.k,vzWho(r.c),r.vt,(r.tin||'')+(r.tout?' - '+r.tout:''),r.g?r.score:'',r.g,r.st==='Final'?'अंतिम':'मसुदा']})))}
function vzDel(id){if(!confirm('ही भेट नोंद काढायची?'))return;api('/api/o/vsdel',{id:id}).then(function(j){if(j.ok)vzLoad();else alert('काढता आले नाही.')})}

/* ---- नवीन / बदल ---- */
function vzNew(){PH=[];VZ=null;VZCX=null;VZSP=0;VZSE={ab:'',lv:''};
 var kp=ROLE==='KP',S=(window.DATA||[]).filter(function(r){return kp||!VZF||r.c===VZF}).sort(function(a,b){return String(a.nm||'').localeCompare(String(b.nm||''))});
 X.innerHTML=hdr()+'<button class="g" onclick="vzDraw()">← मागे</button><div class="card vzc"><h2>🏫 नवीन शाळा भेट</h2>'
  +(kp?'':'<label>केंद्र</label><select id="vzc" onchange="VZF=this.value;vzNew()"><option value="">सर्व केंद्र</option>'+Object.keys(CEN).sort(function(a,b){return String(CEN[a]).localeCompare(String(CEN[b]))}).map(function(c){return '<option value="'+c+'"'+(c===VZF?' selected':'')+'>'+esc(CEN[c])+'</option>'}).join('')+'</select>')
  +'<label>शाळा</label><select id="vzu"><option value="">— शाळा निवडा —</option>'+S.map(function(r){return '<option value="'+r.u+'">'+esc(r.nm||r.u)+'</option>'}).join('')+'</select>'
  +vzInfoFields({dt:vzToday(),tin:'',tout:'',vt:VZVT[0]})+'<p id="vze" class="er"></p><button onclick="vzStart()">पुढे →</button></div>'}
function vzToday(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function vzInfoFields(v){return '<label>भेटीचा दिनांक</label><input type="date" id="vzd" max="'+vzToday()+'" value="'+esc(v.dt)+'"><div class="row"><div style="flex:1;min-width:120px"><label>वेळ – पासून</label><input type="time" id="vzti" value="'+esc(v.tin||'')+'"></div><div style="flex:1;min-width:120px"><label>वेळ – पर्यंत</label><input type="time" id="vzto" value="'+esc(v.tout||'')+'"></div></div><label>भेटीचा प्रकार</label><select id="vzv">'+VZVT.map(function(x){return '<option'+(x===v.vt?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select>'}
function vzStart(){var u=(document.getElementById('vzu')||{}).value,e=document.getElementById('vze');if(!u){e.textContent='शाळा निवडा.';return}
 var dt=document.getElementById('vzd').value;if(!dt||dt>vzToday()){e.textContent='भेटीचा दिनांक तपासा.';return}
 VZ={id:0,u:u,dt:dt,tin:document.getElementById('vzti').value,tout:document.getElementById('vzto').value,vt:document.getElementById('vzv').value,d:{}};vzCtx(function(){vzInit();vzStep(1)})}
function vzResume(){var l=vzLocGet();if(!l)return;PH=[];VZ={id:l.id,u:l.u,dt:l.dt,tin:l.tin,tout:l.tout,vt:l.vt,d:l.d||{}};vzCtx(function(){vzInit();vzStep(1)})}
function vzEdit(id){X.innerHTML=hdr()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 api('/api/o/vsget',{id:id}).then(function(j){if(!j.ok){alert('नोंद उघडता आली नाही.');vzDraw();return}var v=j.v;PH=[];VZ={id:v.id,u:v.u,dt:v.dt,tin:v.tin,tout:v.tout,vt:v.vt,d:v.d||{},n:v.n};VZSE={ab:'',lv:''};vzCtx(function(){vzInit();vzStep(1)})})}
function vzCtx(cb){X.innerHTML=hdr()+'<div class="card"><p class="m">⏳ शाळेची माहिती (शिक्षक, विद्यार्थी) येत आहे…</p></div>';
 api('/api/o/vsctx',{udise:VZ.u,dt:VZ.dt}).then(function(j){if(!j.ok){X.innerHTML=hdr()+'<div class="card"><p class="er">शाळेची माहिती मिळाली नाही.</p><button onclick="vzDraw()">← मागे</button></div>';return}VZCX=j;cb()})}
function vzCls(){var m={},a=[];(VZCX.ro||[]).forEach(function(x){var k=x.c+'|'+x.v;if(!m[k]){m[k]={k:k,c:x.c,v:x.v,n:0};a.push(m[k])}m[k].n++});return a}
function vzCn(c){return 'इयत्ता '+c.c+(c.v?' '+c.v:'')}
function vzInit(){var d=VZ.d;d.k=d.k||{};d.pm=d.pm||{};d.tc=d.tc||[];d.at=d.at||{};d.ab=d.ab||[];d.lv=d.lv||{};
 var have={};d.tc.forEach(function(t){have[t.id]=1});(VZCX.tc||[]).forEach(function(t){if(!have[t.sh])d.tc.push({id:t.sh,n:t.n,s:'',a:{},r:''})});
 if(!VZCX.ro||!VZCX.ro.length){for(var i=1;i<=8;i++)if(!d.at[i+'|'])d.at[i+'|']={n:'',p:''}}
 else vzCls().forEach(function(c){var o=d.at[c.k]=d.at[c.k]||{p:''};o.n=c.n});
 if(!d.pm.p&&VZCX.pm&&VZCX.pm.p15!=null)d.pm.hint=1}

/* ---- फॉर्मची पाने ---- */
function vzChips(){return '<div class="vzn" style="display:flex;flex-wrap:wrap">'+VZST.map(function(t,i){return '<button class="'+(i===VZSP?'':'g')+'" onclick="vzStep('+i+')">'+(i+1)+'. '+t+'</button>'}).join('')+'</div>'}
function vzCh(cur,fn){return VZOP.map(function(o){var on=cur===o[0];return '<button type="button" class="vzb" style="'+(on?'background:'+o[2]+';color:#fff;border:1px solid '+o[2]:'background:var(--c);color:'+o[2]+';border:1px solid '+o[2])+'" onclick="'+fn.replace('%v',o[0])+'">'+o[1]+'</button>'}).join('')}
function vzStep(n){VZSP=n;var sc=vzSn(VZ.u),h=hdr()+'<div class="card" style="padding:10px"><b>🏫 '+esc(vzSn(VZ.u))+'</b> · '+mDt(VZ.dt)+'</div>'+vzChips()+'<div id="vzb" style="margin-top:8px">'+vzPage(n)+'</div>';
 X.innerHTML=h;window.scrollTo(0,0)}
function vzNav(n){return '<div class="row" style="margin-top:8px">'+(n>0?'<button class="g" onclick="vzStep('+(n-1)+')">← मागील</button>':'')+(n<6?'<button onclick="vzStep('+(n+1)+')">पुढील →</button>':'')+'</div><p style="margin:6px 0 0"><button class="g" onclick="vzSave(0)">💾 मसुदा जतन करा</button></p><p id="vzm" class="m"></p>'}
function vzPage(n){return n===0?vzP0():n<=3?vzPc3(['a','b','c'][n-1]):n===4?vzP4():n===5?vzP5():vzP6()}
function vzP0(){return '<div class="card"><h2>भेट माहिती</h2><p class="m">शाळा: <b>'+esc(vzSn(VZ.u))+'</b></p>'+vzInfoFields(VZ)+'<p class="m">भेट देणारे: '+esc(vzWho(U))+'</p>'
 +(VZCX&&VZCX.prev?'<div class="card" style="background:#fef9c3;border-color:#facc15;color:#713f12"><b>मागील भेटीतील पाठपुरावा ('+mDt(VZCX.prev.dt)+'):</b><br>'+(VZCX.prev.fu?esc(VZCX.prev.fu)+(VZCX.prev.fd?'<br><small>मुदत: '+mDt(VZCX.prev.fd)+'</small>':''):'<small>नोंद नाही.</small>')+'</div>':'')
 +'<button onclick="vzInfoSv()">माहिती जतन करून पुढे →</button></div>'}
function vzInfoSv(){var dt=document.getElementById('vzd').value;if(!dt||dt>vzToday()){alert('भेटीचा दिनांक तपासा.');return}var ch=dt!==VZ.dt;VZ.dt=dt;VZ.tin=document.getElementById('vzti').value;VZ.tout=document.getElementById('vzto').value;VZ.vt=document.getElementById('vzv').value;vzLoc();if(ch)vzCtx(function(){vzInit();vzStep(1)});else vzStep(1)}
function vzRow(k,lb){return '<div class="vzr"><div>'+lb+'</div><div id="vc_'+k+'">'+vzCh(VZ.d.k[k]||'',"vzSet('"+k+"','%v')")+'</div></div>'}
function vzSet(k,v){VZ.d.k[k]=VZ.d.k[k]===v?'':v;var e=document.getElementById('vc_'+k);if(e)e.innerHTML=vzCh(VZ.d.k[k],"vzSet('"+k+"','%v')");vzProg();vzLoc()}
function vzProg(){var e=document.getElementById('vzp'),s=['a','b','c'][VZSP-1];if(!e||!s)return;var c=vzCalc(VZ.d)[s];e.innerHTML='उत्तरे: <b>'+c.a+'/'+c.m+'</b>'+(c.p!==null?' · गुण: <b>'+c.p+'%</b>':'')}
function vzPc3(s){var S=VZQ[s],n=VZSP,h='<div class="card"><h2>'+S.t+'</h2><p class="m" id="vzp"></p>';
 if(s==='b'){var pm=VZCX.pm,d=VZ.d.pm;
  if(pm&&pm.p15!=null)h+='<div class="card" style="background:#ecfdf5;border-color:#6ee7b7;color:#065f46"><small>ॲपमधील शाळेची आजची PM पोषण नोंद ('+mDt(VZ.dt)+'): आहार '+esc(pm.cooked||'')+' · मेनू: '+esc(pm.menu||'—')+' · लाभार्थी: १–५ वी '+(pm.p15||0)+', ६–८ वी '+(pm.p68||0)+'</small></div>';
  else h+='<p class="m">या दिवशी शाळेने ॲपमध्ये PM पोषण नोंद केलेली नाही.</p>';
  h+='<label>प्रत्यक्ष आहाराचा मेनू (भेटीच्या वेळी)</label><input value="'+esc(d.menu||'')+'" oninput="VZ.d.pm.menu=this.value;vzLoc()"><div class="row"><div style="flex:1;min-width:130px"><label>पटावर हजर विद्यार्थी</label><input inputmode="numeric" value="'+esc(d.p||'')+'" oninput="this.value=vzNum(this.value);VZ.d.pm.p=this.value;vzLoc()"></div><div style="flex:1;min-width:130px"><label>आहार घेतलेले विद्यार्थी</label><input inputmode="numeric" value="'+esc(d.e||'')+'" oninput="this.value=vzNum(this.value);VZ.d.pm.e=this.value;vzLoc()"></div></div>'}
 h+=S.q.map(function(q){return vzRow(q[0],q[1])}).join('')+'<label>शेरा / आढळलेल्या बाबी</label><textarea rows="2" oninput="VZ.d.'+s+'_r=this.value;vzLoc()">'+esc(VZ.d[s+'_r']||'')+'</textarea></div>'+vzNav(n);
 setTimeout(vzProg,0);return h}

/* शिक्षक */
function vzTcHtml(i){var t=VZ.d.tc[i],lv=(VZCX.lv||[]).filter(function(x){return x.sh===t.id})[0];
 var h='<b>'+esc(t.n)+'</b>'+(t.m?' <a href="#" style="float:right" onclick="vzTcDel('+i+');return false">✖ काढा</a>':'')+'<br><small style="color:'+(lv?'#15803d':'var(--m)')+'">📝 '+(lv?'रजा अर्ज आहे: '+esc(lv.typ)+' ('+mDt(lv.fd)+' – '+mDt(lv.td)+')':t.m?'':'या दिवशी रजा अर्ज नोंद नाही')+'</small><div style="margin-top:4px">'
  +VZTS.map(function(o){var on=t.s===o[0];return '<button type="button" class="vzb" style="'+(on?'background:var(--a);color:#fff;border:1px solid var(--a)':'background:var(--c);color:var(--a);border:1px solid var(--a)')+'" onclick="vzTSt('+i+',\''+o[0]+'\')">'+o[1]+'</button>'}).join('')+'</div>';
 if(t.s==='P'||t.s==='L')h+=VZTQ.map(function(q){return '<div class="vzr"><div>'+q[1]+'</div><div id="vt_'+i+'_'+q[0]+'">'+vzCh((t.a||{})[q[0]]||'',"vzTSet("+i+",'"+q[0]+"','%v')")+'</div></div>'}).join('');
 if(t.s)h+='<input placeholder="शेरा / सूचना (ऐच्छिक)" value="'+esc(t.r||'')+'" oninput="VZ.d.tc['+i+'].r=this.value;vzLoc()">';
 return h}
function vzP4(){var h='<div class="card"><h2>👨‍🏫 शिक्षक</h2><p class="m">प्रत्येक शिक्षकाची उपस्थिती निवडा. उपस्थित / उशिरा आलेल्या शिक्षकाचे दैनिक टाचण, नियोजन, वेळापत्रक इ. रेकॉर्ड तपासून नोंदवा.</p></div>';
 if(!VZ.d.tc.length)h+='<div class="card"><p class="m">शाळेतील शिक्षकांची नोंद ॲपमध्ये नाही. खाली नाव जोडा.</p></div>';
 VZ.d.tc.forEach(function(t,i){h+='<div class="card" id="vtc_'+i+'">'+vzTcHtml(i)+'</div>'});
 h+='<div class="card"><label>शिक्षक जोडा (ॲपमध्ये नोंद नसलेला)</label><input id="vzan" placeholder="शिक्षकाचे नाव"><button class="g" onclick="vzTcAdd()">➕ जोडा</button></div>'+vzNav(4);return h}
function vzTSt(i,s){var t=VZ.d.tc[i];t.s=t.s===s?'':s;document.getElementById('vtc_'+i).innerHTML=vzTcHtml(i);vzLoc()}
function vzTSet(i,k,v){var t=VZ.d.tc[i];t.a=t.a||{};t.a[k]=t.a[k]===v?'':v;var e=document.getElementById('vt_'+i+'_'+k);if(e)e.innerHTML=vzCh(t.a[k],"vzTSet("+i+",'"+k+"','%v')");vzLoc()}
function vzTcAdd(){var e=document.getElementById('vzan'),n=e.value.trim();if(n.length<2)return;VZ.d.tc.push({id:'m'+Date.now(),n:n,m:1,s:'',a:{},r:''});vzStep(4)}
function vzTcDel(i){if(!confirm('हे नाव काढायचे?'))return;VZ.d.tc.splice(i,1);vzStep(4)}

/* विद्यार्थी */
function vzP5(){var C=vzCls(),d=VZ.d,h='<div class="card"><h2>🧑‍🎓 विद्यार्थी – आजची उपस्थिती</h2><div class="w"><table><tr><th>वर्ग</th><th>पट</th><th>उपस्थित</th></tr>';
 if(C.length)C.forEach(function(c){h+='<tr><td>'+vzCn(c)+'</td><td>'+c.n+'</td><td><input style="margin:0;padding:6px;width:80px" inputmode="numeric" value="'+esc((d.at[c.k]||{}).p||'')+'" oninput="vzAt(\''+c.k+'\',\'p\',this)"></td></tr>'});
 else for(var i=1;i<=8;i++){var k=i+'|',o=d.at[k]||{};h+='<tr><td>इयत्ता '+i+'</td><td><input style="margin:0;padding:6px;width:80px" inputmode="numeric" value="'+esc(o.n||'')+'" oninput="vzAt(\''+k+'\',\'n\',this)"></td><td><input style="margin:0;padding:6px;width:80px" inputmode="numeric" value="'+esc(o.p||'')+'" oninput="vzAt(\''+k+'\',\'p\',this)"></td></tr>'}
 h+='</table></div><p id="vzat" style="margin:6px 0 0"></p></div>';
 h+='<div class="card"><h2>🚫 अनुपस्थित विद्यार्थी</h2>'+(C.length?'<label>वर्ग निवडा</label><select id="vzab" onchange="VZSE.ab=this.value;vzAbL()"><option value="">— वर्ग —</option>'+C.map(function(c){return '<option value="'+c.k+'"'+(c.k===VZSE.ab?' selected':'')+'>'+vzCn(c)+' (पट '+c.n+')</option>'}).join('')+'</select><div id="vzabl"></div>':'<p class="m">शाळेचे विद्यार्थी ॲपमध्ये नोंदवलेले नाहीत; खाली नाव लिहा.</p><div class="row"><input id="vzabn" placeholder="विद्यार्थ्याचे नाव" style="flex:2"><input id="vzabc" placeholder="इयत्ता" style="flex:1" inputmode="numeric"><button class="g" onclick="vzAbM()">➕</button></div>')+'<div id="vzabs"></div></div>';
 h+='<div class="card"><h2>📊 विद्यार्थी स्तर नोंद</h2><p class="m">निवडलेल्या विद्यार्थ्यांची भाषा वाचन, गणित व इंग्रजी वाचन पातळी निवडा. फक्त तपासलेल्या विद्यार्थ्यांचीच नोंद करा.</p>'
  +(C.length?'<label>वर्ग निवडा</label><select id="vzlv" onchange="VZSE.lv=this.value;vzLvL()"><option value="">— वर्ग —</option>'+C.map(function(c){return '<option value="'+c.k+'"'+(c.k===VZSE.lv?' selected':'')+'>'+vzCn(c)+'</option>'}).join('')+'</select><div id="vzlvl"></div>':'<p class="m">स्तर नोंदीसाठी शाळेचे विद्यार्थी ॲपमध्ये असणे आवश्यक आहे.</p>')+'<div id="vzlvs"></div></div>'+vzNav(5);
 setTimeout(function(){vzAtT();vzAbL();vzAbS();vzLvL();vzLvS()},0);return h}
function vzAt(k,f,el){el.value=vzNum(el.value);var o=VZ.d.at[k]=VZ.d.at[k]||{n:'',p:''};o[f]=el.value;vzAtT();vzLoc()}
function vzAtT(){var e=document.getElementById('vzat');if(!e)return;var c=vzCalc(VZ.d).s;e.innerHTML=c.att!==null?'एकूण उपस्थिती: <b>'+c.ap+' / '+c.an+'</b> ('+c.att+'%)':'<span class="m">उपस्थिती भरल्यावर टक्केवारी दिसेल.</span>'}
function vzAbL(){var e=document.getElementById('vzabl');if(!e)return;if(!VZSE.ab){e.innerHTML='';return}var a=VZSE.ab.split('|'),on={};VZ.d.ab.forEach(function(x){on[x.p]=1});
 e.innerHTML='<div style="max-height:320px;overflow:auto;border:1px solid var(--l);border-radius:10px;padding:4px 8px;margin-top:6px">'+(VZCX.ro||[]).filter(function(x){return String(x.c)===a[0]&&x.v===a[1]}).map(function(x){return '<label style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--l);margin:0"><input type="checkbox" style="width:auto;margin:0" '+(on[x.p]?'checked ':'')+'onchange="vzAb(\''+x.p+'\',this.checked)"> '+esc(x.n)+'</label>'}).join('')+'</div>'}
function vzAb(pen,on){var d=VZ.d;if(on){var x=(VZCX.ro||[]).filter(function(r){return r.p===pen})[0];if(x&&!d.ab.some(function(a){return a.p===pen}))d.ab.push({p:pen,n:x.n,c:x.c,v:x.v,r:''})}else d.ab=d.ab.filter(function(a){return a.p!==pen});vzAbS();vzLoc()}
function vzAbM(){var n=document.getElementById('vzabn').value.trim(),c=document.getElementById('vzabc').value.trim();if(n.length<2)return;VZ.d.ab.push({p:'m'+Date.now(),n:n,c:c,v:'',r:''});document.getElementById('vzabn').value='';vzAbS();vzLoc()}
function vzAbS(){var e=document.getElementById('vzabs');if(!e)return;var a=VZ.d.ab;e.innerHTML='<p style="margin:8px 0 4px"><b>अनुपस्थित: '+a.length+'</b></p>'+a.map(function(x,i){return '<div class="vzr"><b>'+esc(x.n)+'</b> <small class="m">(इयत्ता '+esc(x.c)+' '+esc(x.v)+')</small><a href="#" style="float:right" onclick="vzAbX('+i+');return false">✖</a><select style="margin:4px 0 0;padding:6px" onchange="VZ.d.ab['+i+'].r=this.value;vzLoc()"><option value="">कारण (ऐच्छिक)</option>'+VZRE.map(function(r){return '<option'+(x.r===r?' selected':'')+'>'+esc(r)+'</option>'}).join('')+'</select></div>'}).join('')}
function vzAbX(i){VZ.d.ab.splice(i,1);vzAbS();vzAbL();vzLoc()}
function vzLvSel(f,v){return '<select style="margin:0 0 4px;padding:6px" onchange="%FN"><option value="">'+VZLN[f]+' — निवडा</option>'+VZLV[f].map(function(t,i){return '<option value="'+i+'"'+(String(v)===String(i)?' selected':'')+'>'+(i+1)+'. '+esc(t)+'</option>'}).join('')+'</select>'}
function vzLvL(){var e=document.getElementById('vzlvl');if(!e)return;if(!VZSE.lv){e.innerHTML='';return}var a=VZSE.lv.split('|');
 e.innerHTML=(VZCX.ro||[]).filter(function(x){return String(x.c)===a[0]&&x.v===a[1]}).map(function(x){var o=VZ.d.lv[x.p]||{};return '<div class="vzr"><b>'+esc(x.n)+'</b>'+['l','m','e'].map(function(f){return vzLvSel(f,o[f]==null?'':o[f]).replace('%FN',"vzLv('"+x.p+"','"+f+"',this.value)")}).join('')+'</div>'}).join('')}
function vzLv(pen,f,v){var x=(VZCX.ro||[]).filter(function(r){return r.p===pen})[0];if(!x)return;var o=VZ.d.lv[pen]=VZ.d.lv[pen]||{n:x.n,c:x.c,v:x.v,l:'',m:'',e:''};o[f]=v;if(o.l===''&&o.m===''&&o.e==='')delete VZ.d.lv[pen];vzLvS();vzLoc()}
function vzLvTab(d){var P=Object.keys(d.lv||{}),h='';if(!P.length)return '<p class="m">स्तर नोंद नाही.</p>';
 h+='<p style="margin:6px 0 4px">तपासलेले विद्यार्थी: <b>'+P.length+'</b></p>';
 ['l','m','e'].forEach(function(f){var c=[0,0,0,0,0],n=0;P.forEach(function(p){var v=d.lv[p][f];if(v!==''&&v!=null){c[+v]++;n++}});
  h+='<table class="vzt" style="margin-bottom:8px"><tr><th colspan="3" style="text-align:left">'+VZLN[f]+' ('+n+' विद्यार्थी)</th></tr>'+VZLV[f].map(function(t,i){return '<tr><td>'+(i+1)+'. '+esc(t)+'</td><td style="width:42px;text-align:center">'+c[i]+'</td><td style="width:50px;text-align:center">'+(n?Math.round(100*c[i]/n)+'%':'')+'</td></tr>'}).join('')+'</table>'});return h}
function vzLvS(){var e=document.getElementById('vzlvs');if(e)e.innerHTML=vzLvTab(VZ.d)}

/* निरीक्षण व जतन */
function vzP6(){var d=VZ.d,c=vzCalc(d),h='<div class="card"><h2>📝 निरीक्षण व शेरा</h2>'
 +[['good','चांगल्या बाबी'],['bad','आढळलेल्या त्रुटी / अडचणी'],['sug','दिलेल्या सूचना'],['fu','पुढील पाठपुरावा (काय करायचे)']].map(function(f){return '<label>'+f[1]+'</label><textarea rows="2" oninput="VZ.d.'+f[0]+'=this.value;vzLoc()">'+esc(d[f[0]]||'')+'</textarea>'}).join('')
 +'<label>पाठपुरावा मुदत</label><input type="date" value="'+esc(d.fd||'')+'" onchange="VZ.d.fd=this.value;vzLoc()">'+phForm(VZ.n||0,'भेटीचे फोटो')+'</div>'
 +'<div class="card"><h2>📈 एकूण मूल्यांकन</h2>'+vzScoreTab(c)+'</div><div class="card"><p id="vzm" class="er"></p><div class="row"><button class="g" onclick="vzSave(0)">💾 मसुदा जतन</button><button onclick="vzSave(1)">✅ अंतिम सादर करा</button></div><div class="row" style="margin-top:6px"><button class="g" onclick="vzPrintCur()">🖨 प्रिंट</button></div></div>'
 +'<div class="row" style="margin-top:8px"><button class="g" onclick="vzStep(5)">← मागील</button></div>';setTimeout(phShow,0);return h}
function vzScoreTab(c){var rows=[['🌿 परिसर व स्वच्छता',c.a],['🍚 PM पोषण',c.b],['🗂 शाळेचे रेकॉर्ड',c.c],['👨‍🏫 शिक्षक (उपस्थिती व रेकॉर्ड)',c.t],['🧑‍🎓 विद्यार्थी (उपस्थिती व स्तर)',c.s]];
 return '<table class="vzt"><tr><th style="text-align:left">विभाग</th><th>गुण %</th><th>श्रेणी</th></tr>'+rows.map(function(r){var p=r[1].p;return '<tr><td>'+r[0]+(r[1]===c.s&&c.s.att!==null?'<br><small class="m">उपस्थिती '+c.s.att+'%'+(c.s.lv!==null?' · स्तर '+c.s.lv+'%':'')+'</small>':'')+'</td><td style="text-align:center">'+(p===null?'—':p+'%')+'</td><td style="text-align:center">'+(p===null?'':vzBadge(vzGr(p)))+'</td></tr>'}).join('')
  +'<tr><td><b>एकूण</b></td><td style="text-align:center"><b>'+(c.o.p===null?'—':c.o.p+'%')+'</b></td><td style="text-align:center">'+(c.o.g?vzBadge(c.o.g):'')+'</td></tr></table>'+(c.o.g?'<p style="margin:6px 0 0"><b>'+VZGL[c.o.g]+'</b></p>':'')}
function vzSave(fin){var m=document.getElementById('vzm'),c=vzCalc(VZ.d);
 if(fin){var miss=0;['a','b','c'].forEach(function(k){miss+=c[k].m-c[k].a});miss+=c.t.m-c.t.n;
  if(!c.o.k){if(m){m.className='er';m.textContent='मूल्यांकनासाठी किमान एका विभागातील उत्तरे भरा.'}return}
  if(miss>0&&!confirm(miss+' मुद्दे / शिक्षक अजून भरलेले नाहीत. तरीही अंतिम सादर करायचे?'))return;
  if(!confirm('अंतिम सादर केल्यावर BEO / KP ला ही भेट दिसेल. सादर करायचे?'))return}
 if(m){m.className='m';m.textContent='⏳ जतन होत आहे…'}
 api('/api/o/vssave',{id:VZ.id,udise:VZ.u,dt:VZ.dt,tin:VZ.tin,tout:VZ.tout,vt:VZ.vt,d:VZ.d,score:c.o.p||0,g:c.o.g,final:fin?1:0,imgs:PH}).then(function(j){
  m=document.getElementById('vzm');if(!j.ok){if(m){m.className='er';m.textContent=j.e==='big'?'माहिती खूप मोठी आहे.':j.$s===401?'पुन्हा लॉगिन करा.':rEr(j.e)}return}
  VZ.id=j.id;if(PH.length)VZ.n=PH.length;PH=[];vzLocDel();
  if(fin){VZ=null;vzLoad()}else{if(m){m.className='ok';m.textContent='✓ मसुदा जतन झाला'}}})}

/* ---- पाहा / प्रिंट ---- */
function vzView(id){X.innerHTML=hdr()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 api('/api/o/vsget',{id:id}).then(function(j){if(!j.ok){alert('नोंद उघडता आली नाही.');vzDraw();return}var v=j.v;window.VZVW=v;
  X.innerHTML=hdr()+'<button class="g" onclick="vzDraw()">← मागे</button><div class="card"><div class="row"><button class="g" onclick="vzPrintV()">🖨 प्रिंट</button>'+(v.mine?'<button class="g" onclick="vzEdit('+v.id+')">✏ बदला</button>':'')+'</div>'+phBtns('/api/o/vsimg',v.id,v.n,'फोटो')+'</div><div class="card">'+vzRep(v)+'</div>'})}
function vzRep(v){var d=v.d||{},c=vzCalc(d),h='<h3 style="margin:0 0 6px">शाळा भेट अहवाल</h3><table class="vzt"><tr><td><b>शाळा</b></td><td>'+esc(v.sc||vzSn(v.u))+'</td><td><b>UDISE</b></td><td>'+esc(v.u)+'</td></tr><tr><td><b>केंद्र</b></td><td>'+esc(CEN[v.k]||v.k||'')+'</td><td><b>दिनांक / वेळ</b></td><td>'+mDt(v.dt)+(v.tin?' · '+esc(v.tin)+(v.tout?' – '+esc(v.tout):''):'')+'</td></tr><tr><td><b>भेट देणारे</b></td><td>'+esc(vzWho(v.c))+'</td><td><b>भेट प्रकार</b></td><td>'+esc(v.vt||'')+'</td></tr></table>';
 h+='<h4 style="margin:12px 0 4px">📈 एकूण मूल्यांकन</h4>'+vzScoreTab(c);
 ['a','b','c'].forEach(function(s){h+='<h4 style="margin:12px 0 4px">'+VZQ[s].t+'</h4>';
  if(s==='b'&&d.pm&&(d.pm.menu||d.pm.p||d.pm.e))h+='<p style="margin:0 0 4px">मेनू: '+esc(d.pm.menu||'—')+' · पटावर हजर: '+esc(d.pm.p||'—')+' · आहार घेतलेले: '+esc(d.pm.e||'—')+'</p>';
  h+='<table class="vzt">'+VZQ[s].q.map(function(q){return '<tr><td>'+q[1]+'</td><td style="width:84px">'+vzAL((d.k||{})[q[0]])+'</td></tr>'}).join('')+'</table>'+(d[s+'_r']?'<p style="margin:4px 0 0"><b>शेरा:</b> '+esc(d[s+'_r'])+'</p>':'')});
 h+='<h4 style="margin:12px 0 4px">👨‍🏫 शिक्षक</h4>';
 var tn={P:'उपस्थित',L:'उशिरा आले',A:'रजेवर',T:'प्रशिक्षण / कामगिरी',U:'विनापरवानगी गैरहजर'};
 if(!(d.tc||[]).length)h+='<p class="m">नोंद नाही.</p>';
 (d.tc||[]).forEach(function(t){h+='<table class="vzt" style="margin-bottom:8px"><tr><th style="text-align:left">'+esc(t.n)+'</th><th style="width:130px">'+(tn[t.s]||'— नोंद नाही')+'</th></tr>'+((t.s==='P'||t.s==='L')?VZTQ.map(function(q){return '<tr><td>'+q[1]+'</td><td>'+vzAL((t.a||{})[q[0]])+'</td></tr>'}).join(''):'')+(t.r?'<tr><td colspan="2"><b>शेरा:</b> '+esc(t.r)+'</td></tr>':'')+'</table>'});
 h+='<h4 style="margin:12px 0 4px">🧑‍🎓 विद्यार्थी – उपस्थिती</h4><table class="vzt"><tr><th>वर्ग</th><th>पट</th><th>उपस्थित</th><th>%</th></tr>'+Object.keys(d.at||{}).filter(function(k){var x=d.at[k];return x.p!==''&&x.p!=null}).sort().map(function(k){var x=d.at[k],a=k.split('|'),n=+x.n,p=+x.p;return '<tr><td>इयत्ता '+esc(a[0])+' '+esc(a[1])+'</td><td>'+esc(x.n)+'</td><td>'+esc(x.p)+'</td><td>'+(n>0?Math.round(100*Math.min(p,n)/n)+'%':'')+'</td></tr>'}).join('')+'</table>'+(c.s.att!==null?'<p style="margin:4px 0 0"><b>एकूण उपस्थिती: '+c.s.ap+' / '+c.s.an+' ('+c.s.att+'%)</b></p>':'');
 h+='<h4 style="margin:12px 0 4px">🚫 अनुपस्थित विद्यार्थी ('+(d.ab||[]).length+')</h4>'+((d.ab||[]).length?'<table class="vzt"><tr><th>नाव</th><th>वर्ग</th><th>कारण</th></tr>'+d.ab.map(function(x){return '<tr><td>'+esc(x.n)+'</td><td>'+esc(x.c)+' '+esc(x.v)+'</td><td>'+esc(x.r||'')+'</td></tr>'}).join('')+'</table>':'<p class="m">नोंद नाही.</p>');
 h+='<h4 style="margin:12px 0 4px">📊 विद्यार्थी स्तर नोंद</h4>'+vzLvTab(d);
 var P=Object.keys(d.lv||{});if(P.length)h+='<table class="vzt" style="margin-top:6px"><tr><th>विद्यार्थी</th><th>वर्ग</th><th>भाषा वाचन</th><th>गणित</th><th>इंग्रजी वाचन</th></tr>'+P.map(function(p){var x=d.lv[p];return '<tr><td>'+esc(x.n)+'</td><td>'+esc(x.c)+' '+esc(x.v)+'</td>'+['l','m','e'].map(function(f){return '<td style="text-align:center">'+(x[f]===''||x[f]==null?'—':(+x[f]+1))+'</td>'}).join('')+'</tr>'}).join('')+'</table><p class="m" style="margin:4px 0 0">स्तर क्रमांक १ (सर्वात कमी) ते ५ (सर्वात जास्त).</p>';
 h+='<h4 style="margin:12px 0 4px">📝 निरीक्षण</h4>'+[['good','चांगल्या बाबी'],['bad','आढळलेल्या त्रुटी / अडचणी'],['sug','दिलेल्या सूचना'],['fu','पुढील पाठपुरावा']].map(function(f){return '<p style="margin:2px 0;white-space:pre-wrap"><b>'+f[1]+':</b> '+(esc(d[f[0]]||'')||'—')+'</p>'}).join('')+(d.fd?'<p style="margin:2px 0"><b>पाठपुरावा मुदत:</b> '+mDt(d.fd)+'</p>':'');
 return h}
function vzPrintHtml(v){return vzRep(v)+'<table style="margin-top:46px;border:0"><tr><td style="border:0;text-align:left;width:50%">मुख्याध्यापक<br>सही / शिक्का</td><td style="border:0;text-align:right">भेट देणारे अधिकारी<br>'+esc(vzWho(v.c))+'<br>सही</td></tr></table>'}
function vzPrintV(){var v=window.VZVW;if(!v)return;var o=window.PDFT;window.PDFT='शाळा भेट - '+(v.sc||v.u)+' - '+mDt(v.dt).replace(/\//g,'-');pprint(vzPrintHtml(v));window.PDFT=o}
function vzPrintCur(){var c=vzCalc(VZ.d),v={u:VZ.u,sc:vzSn(VZ.u),k:((window.DATA||[]).filter(function(x){return x.u===VZ.u})[0]||{}).c,dt:VZ.dt,tin:VZ.tin,tout:VZ.tout,vt:VZ.vt,c:U,d:VZ.d};var o=window.PDFT;window.PDFT='शाळा भेट - '+v.sc+' - '+mDt(v.dt).replace(/\//g,'-');pprint(vzPrintHtml(v));window.PDFT=o}
