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
 l:['अक्षर ओळख नाही (वाचता येत नाही)','अक्षरे ओळखतो','शब्द वाचतो','वाक्य / छोटा परिच्छेद वाचतो','गोष्ट / पाठ अस्खलित वाचतो','इयत्ता स्तर – इयत्तेच्या पातळीचा उतारा अर्थासह वाचतो'],
 m:['१ ते ९ संख्या ओळखत नाही','१ ते ९ संख्या ओळखतो','१० ते ९९ संख्या ओळखतो','वजाबाकी करतो','भागाकार करतो','इयत्ता स्तर – इयत्तेनुसार मोठ्या संख्या वाचतो (उदा. ५ वी: ७ अंकी)'],
 e:['काहीही ओळखत नाही','Capital letters ओळखतो','Small letters ओळखतो','Words वाचतो','Sentences वाचतो','इयत्ता स्तर – इयत्तेच्या पातळीचा उतारा अर्थासह वाचतो']};
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
 ['t9','वर्गाची हजेरी नोंद अद्ययावत'],['t10','उपचारात्मक / प्रगत विद्यार्थ्यांसाठी नियोजन'],['t11','अभ्यासक्रम प्रगती नियोजनानुसार'],
 ['t12','गणित पेटीचा वापर करत आहेत का?'],['t13','विज्ञान पेटीचा वापर करत आहेत का?'],['t14','इंग्रजी पेटीचा वापर करत आहेत का?'],['t15','भाषा पेटीचा वापर करत आहेत का?'],
 ['t16','VSK वर विद्यार्थी उपस्थिती रोज भरतात का?'],['t17','आतापर्यंतचे सर्व पेपर तपासले आहेत का?'],['t18','पालक भेट रजिस्टर ठेवले आहे का?']];
var VZST=['🏫 शाळा / मुख्याध्यापक','👨‍🏫 शिक्षक व विद्यार्थी'];

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
function vzWho(c){return c==='BEO'?'गटशिक्षणाधिकारी (BEO)':/^AEO[1-3]$/.test(c)?c:'केंद्रप्रमुख – '+(CEN[c]||c)}
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
 VZ={id:0,u:u,dt:dt,tin:document.getElementById('vzti').value,tout:document.getElementById('vzto').value,vt:document.getElementById('vzv').value,d:{}};vzCtx(function(){vzInit();vzStep(0)})}
function vzResume(){var l=vzLocGet();if(!l)return;PH=[];VZ={id:l.id,u:l.u,dt:l.dt,tin:l.tin,tout:l.tout,vt:l.vt,d:l.d||{}};vzCtx(function(){vzInit();vzStep(0)})}
function vzEdit(id){X.innerHTML=hdr()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 api('/api/o/vsget',{id:id}).then(function(j){if(!j.ok){alert('नोंद उघडता आली नाही.');vzDraw();return}var v=j.v;PH=[];VZ={id:v.id,u:v.u,dt:v.dt,tin:v.tin,tout:v.tout,vt:v.vt,d:v.d||{},n:v.n};VZSE={ab:'',lv:''};vzCtx(function(){vzInit();vzStep(0)})})}
function vzCtx(cb){X.innerHTML=hdr()+'<div class="card"><p class="m">⏳ शाळेची माहिती (शिक्षक, विद्यार्थी) येत आहे…</p></div>';
 api('/api/o/vsctx',{udise:VZ.u,dt:VZ.dt}).then(function(j){if(!j.ok){X.innerHTML=hdr()+'<div class="card"><p class="er">शाळेची माहिती मिळाली नाही.</p><button onclick="vzDraw()">← मागे</button></div>';return}VZCX=j;cb()})}
function vzCls(){var m={},a=[];(VZCX.ro||[]).forEach(function(x){var k=x.c+'|'+x.v;if(!m[k]){m[k]={k:k,c:x.c,v:x.v,n:0};a.push(m[k])}m[k].n++});return a}
function vzCn(c){return 'इयत्ता '+c.c+(c.v?' '+c.v:'')}
function vzInit(){var d=VZ.d;d.k=d.k||{};d.pm=d.pm||{};d.tc=d.tc||[];d.at=d.at||{};d.ab=d.ab||[];d.lv=d.lv||{};
 var have={};d.tc.forEach(function(t){have[t.id]=1});(VZCX.tc||[]).forEach(function(t){if(!have[t.sh])d.tc.push({id:t.sh,n:t.n,s:'',a:{},r:''})});
 if(!VZCX.ro||!VZCX.ro.length){for(var i=1;i<=8;i++)if(!d.at[i+'|'])d.at[i+'|']={n:'',p:''}}
 else vzCls().forEach(function(c){var o=d.at[c.k]=d.at[c.k]||{p:''};o.n=c.n});
 d.xc=d.xc||[];var ks={};vzKeys().forEach(function(c){ks[c.k]=1});
 d.tc.forEach(function(t){if(t.cl===undefined){var m=((VZCX.tcl||{})[t.id]||[]).filter(function(k){return ks[k]});t.cl=m}t.cl=(t.cl||[]).filter(function(k){return ks[k]})});
 var used={};d.tc.forEach(function(t){t.cl.forEach(function(k){used[k]=1})});d.xc.forEach(function(k){used[k]=1});
 Object.keys(ks).forEach(function(k){if(used[k])return;var o=d.at[k],has=(o&&o.p!==''&&o.p!=null)||d.ab.some(function(a){return String(a.c)+'|'+(a.v||'')===k})||Object.keys(d.lv).some(function(p){var x=d.lv[p];return String(x.c)+'|'+(x.v||'')===k});if(has){d.xc.push(k);used[k]=1}});
 if(!d.pm.p&&VZCX.pm&&VZCX.pm.p15!=null)d.pm.hint=1}

/* ---- फॉर्मची पाने ---- */
function vzChips(){return '<div class="vzn" style="display:flex;gap:6px;margin-bottom:6px">'+VZST.map(function(t,i){return '<button class="'+(i===VZSP?'':'g')+'" style="flex:1;min-width:0;margin:0;padding:9px 4px;font-size:13px;line-height:1.3" onclick="vzStep('+i+')">'+(i+1)+'. '+t+'</button>'}).join('')+'</div>'}
function vzCh(cur,fn){return VZOP.map(function(o){var on=cur===o[0];return '<button type="button" class="vzb" style="'+(on?'background:'+o[2]+';color:#fff;border:1px solid '+o[2]:'background:var(--c);color:'+o[2]+';border:1px solid '+o[2])+'" onclick="'+fn.replace('%v',o[0])+'">'+o[1]+'</button>'}).join('')}
function vzStep(n){VZSP=n;var sc=vzSn(VZ.u),h=hdr()+'<div class="card" style="padding:10px"><b>🏫 '+esc(vzSn(VZ.u))+'</b> · '+mDt(VZ.dt)+'</div>'+vzChips()+'<div id="vzb" style="margin-top:8px">'+vzPage(n)+'</div>';
 X.innerHTML=h;window.scrollTo(0,0)}
function vzRow(k,lb){return '<div class="vzr"><div>'+lb+'</div><div id="vc_'+k+'">'+vzCh(VZ.d.k[k]||'',"vzSet('"+k+"','%v')")+'</div></div>'}
function vzSet(k,v){VZ.d.k[k]=VZ.d.k[k]===v?'':v;var e=document.getElementById('vc_'+k);if(e)e.innerHTML=vzCh(VZ.d.k[k],"vzSet('"+k+"','%v')");vzProg();vzLoc()}
/* ---- दोन टॅब: १) शिक्षक व विद्यार्थी  २) शाळा / मुख्याध्यापक (भेट माहिती, स्वच्छता, PM पोषण, रेकॉर्ड, निरीक्षण) ---- */
function vzPage(n){return n===0?vzP1():vzP4()}
function vzAct(){return '<div class="card"><p id="vzm" class="er"></p><div class="row"><button class="g" onclick="vzSave(0)">💾 मसुदा जतन</button><button onclick="vzSave(1)">✅ अंतिम सादर करा</button></div><div class="row" style="margin-top:6px"><button class="g" onclick="vzPrintCur()">🖨 प्रिंट</button><button class="g" onclick="vzPdfShare(\'cur\')">📤 PDF – WhatsApp</button></div><p id="vzpm" class="m"></p></div>'}
function vzSec(id,t,body,sum){return '<details class="card" id="vsec_'+id+'"'+(VZCO['s_'+id]?' open':'')+' ontoggle="VZCO[\'s_'+id+'\']=this.open"><summary style="cursor:pointer"><b style="font-size:16px">'+t+'</b>'+(sum?' <span class="m" id="vzp_'+id+'" style="margin-left:6px"></span>':'')+'</summary><div style="margin-top:8px">'+body+'</div></details>'}
function vzSecQ(s){var S=VZQ[s],h='';
 if(s==='b'){var pm=VZCX.pm,d=VZ.d.pm;
  if(pm&&pm.p15!=null)h+='<div class="card" style="background:#ecfdf5;border-color:#6ee7b7;color:#065f46"><small>ॲपमधील शाळेची आजची PM पोषण नोंद ('+mDt(VZ.dt)+'): आहार '+esc(pm.cooked||'')+' · मेनू: '+esc(pm.menu||'—')+' · लाभार्थी: १–५ वी '+(pm.p15||0)+', ६–८ वी '+(pm.p68||0)+'</small></div>';
  else h+='<p class="m">या दिवशी शाळेने ॲपमध्ये PM पोषण नोंद केलेली नाही.</p>';
  h+='<label>प्रत्यक्ष आहाराचा मेनू (भेटीच्या वेळी)</label><input value="'+esc(d.menu||'')+'" oninput="VZ.d.pm.menu=this.value;vzLoc()"><div class="row"><div style="flex:1;min-width:130px"><label>पटावर हजर विद्यार्थी</label><input inputmode="numeric" value="'+esc(d.p||'')+'" oninput="this.value=vzNum(this.value);VZ.d.pm.p=this.value;vzLoc()"></div><div style="flex:1;min-width:130px"><label>आहार घेतलेले विद्यार्थी</label><input inputmode="numeric" value="'+esc(d.e||'')+'" oninput="this.value=vzNum(this.value);VZ.d.pm.e=this.value;vzLoc()"></div></div>'}
 return h+S.q.map(function(q){return vzRow(q[0],q[1])}).join('')+'<label>शेरा / आढळलेल्या बाबी</label><textarea rows="2" oninput="VZ.d.'+s+'_r=this.value;vzLoc()">'+esc(VZ.d[s+'_r']||'')+'</textarea>'}
function vzProg(){['a','b','c'].forEach(function(s){var e=document.getElementById('vzp_'+s);if(!e)return;var c=vzCalc(VZ.d)[s];e.innerHTML='उत्तरे: <b>'+c.a+'/'+c.m+'</b>'+(c.p!==null?' · गुण: <b>'+c.p+'%</b>':'')});var e2=document.getElementById('vzscore');if(e2)e2.innerHTML=vzScoreTab(vzCalc(VZ.d))}
function vzP1(){var d=VZ.d,h='<div class="card"><h2>🏫 भेट माहिती</h2><p class="m">शाळा: <b>'+esc(vzSn(VZ.u))+'</b></p>'+vzInfoFields(VZ)+'<p class="m">भेट देणारे: '+esc(vzWho(U))+'</p>'
 +(VZCX&&VZCX.prev?'<div class="card" style="background:#fef9c3;border-color:#facc15;color:#713f12"><b>मागील भेटीतील पाठपुरावा ('+mDt(VZCX.prev.dt)+'):</b><br>'+(VZCX.prev.fu?esc(VZCX.prev.fu)+(VZCX.prev.fd?'<br><small>मुदत: '+mDt(VZCX.prev.fd)+'</small>':''):'<small>नोंद नाही.</small>')+'</div>':'')
 +'<button onclick="vzInfoSv()">💾 माहिती जतन करा</button> <span id="vzis" class="ok"></span></div>'+gvzHtml();
 h+=vzSec('a',VZQ.a.t,vzSecQ('a'),1)+vzSec('b',VZQ.b.t,vzSecQ('b'),1)+vzSec('c',VZQ.c.t,vzSecQ('c'),1);
 h+=vzSec('o','📝 निरीक्षण व शेरा',[['good','चांगल्या बाबी'],['bad','आढळलेल्या त्रुटी / अडचणी'],['sug','दिलेल्या सूचना'],['fu','पुढील पाठपुरावा (काय करायचे)']].map(function(f){return '<label>'+f[1]+'</label><textarea rows="2" oninput="VZ.d.'+f[0]+'=this.value;vzLoc()">'+esc(d[f[0]]||'')+'</textarea>'}).join('')+'<label>पाठपुरावा मुदत</label><input type="date" value="'+esc(d.fd||'')+'" onchange="VZ.d.fd=this.value;vzLoc()">'+phForm(VZ.n||0,'भेटीचे फोटो'),0);
 h+='<div class="card"><h2>📈 एकूण मूल्यांकन</h2><div id="vzscore">'+vzScoreTab(vzCalc(d))+'</div></div>'+vzAct();
 setTimeout(function(){vzProg();phShow()},0);return h}
function vzInfoSv(){var dt=document.getElementById('vzd').value;if(!dt||dt>vzToday()){alert('भेटीचा दिनांक तपासा.');return}var ch=dt!==VZ.dt;VZ.dt=dt;VZ.tin=document.getElementById('vzti').value;VZ.tout=document.getElementById('vzto').value;VZ.vt=document.getElementById('vzv').value;vzLoc();if(ch)vzCtx(function(){vzInit();vzStep(0)});else{var e=document.getElementById('vzis');if(e)e.textContent='✔ जतन झाले'}}

/* शिक्षक */
function vzTcBody(i){var t=VZ.d.tc[i],lv=(VZCX.lv||[]).filter(function(x){return x.sh===t.id})[0];
 var h=(t.m?'<a href="#" style="float:right" onclick="vzTcDel('+i+');return false">✖ काढा</a>':'')+'<small style="color:'+(lv?'#15803d':'var(--m)')+'">📝 '+(lv?'रजा अर्ज आहे: '+esc(lv.typ)+' ('+mDt(lv.fd)+' – '+mDt(lv.td)+')':t.m?'':'या दिवशी रजा अर्ज नोंद नाही')+'</small><div style="margin-top:4px">'
  +VZTS.map(function(o){var on=t.s===o[0];return '<button type="button" class="vzb" style="'+(on?'background:var(--a);color:#fff;border:1px solid var(--a)':'background:var(--c);color:var(--a);border:1px solid var(--a)')+'" onclick="vzTSt('+i+',\''+o[0]+'\')">'+o[1]+'</button>'}).join('')+'</div>';
 if(t.s==='P'||t.s==='L')h+=VZTQ.map(function(q){return '<div class="vzr"><div>'+q[1]+'</div><div id="vt_'+i+'_'+q[0]+'">'+vzCh((t.a||{})[q[0]]||'',"vzTSet("+i+",'"+q[0]+"','%v')")+'</div></div>'}).join('');
 if(t.s)h+='<input placeholder="शेरा / सूचना (ऐच्छिक)" value="'+esc(t.r||'')+'" oninput="VZ.d.tc['+i+'].r=this.value;vzLoc()">'+vzSgHtml(i);
 h+='<div style="margin-top:12px;padding-top:8px;border-top:2px dashed var(--l)"><b>🧑‍🎓 विद्यार्थी माहिती</b></div>'+vzTcCl(i);
 return h}
var VZTO=-1;
function vzTcHtml(i){var t=VZ.d.tc[i],open=VZTO===i,st=VZTS.filter(function(o){return o[0]===t.s})[0],cl=(t.cl||[]);
 var bdg=st?'<span style="display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600;background:'+(t.s==='P'||t.s==='L'?'#dcfce7;color:#166534':'#fee2e2;color:#991b1b')+'">'+st[1]+'</span>':'<span style="display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;background:#f3f4f6;color:#6b7280">भरायचे आहे</span>';
 var h='<div onclick="vzTcTg('+i+')" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="flex:0 0 32px;height:32px;line-height:30px;text-align:center;border-radius:50%;border:2px solid var(--a);color:var(--a);font-size:22px;font-weight:700">'+(open?'−':'+')+'</span><div style="flex:1;min-width:0"><b>'+esc(t.n)+'</b><div>'+bdg+(cl.length?' <small class="m">वर्ग: '+cl.map(function(k){return String(k).split('|').join(' ').trim()}).join(', ')+'</small>':' <small class="m">वर्ग निवडलेले नाहीत</small>')+'</div></div></div>';
 return h+(open?'<div style="margin-top:10px;border-top:1px solid var(--l);padding-top:8px">'+vzTcBody(i)+'</div>':'')}
function vzTcTg(i){var p=VZTO;VZTO=p===i?-1:i;if(p>=0&&p!==i)vzTcRe(p);vzTcRe(i);if(VZTO===i){var e=document.getElementById('vtc_'+i);if(e&&e.scrollIntoView)e.scrollIntoView({block:'start',behavior:'smooth'})}}
function vzP4(){if(VZTO>=VZ.d.tc.length)VZTO=-1;var h='<div class="card"><h2>👨‍🏫 शिक्षक व विद्यार्थी</h2><p class="m">प्रत्येक शिक्षकाची उपस्थिती निवडा. उपस्थित / उशिरा आलेल्या शिक्षकाचे रेकॉर्ड तपासून नोंदवा, त्याचे अध्यापनाचे वर्ग निवडा (त्या वर्गाची विद्यार्थी उपस्थिती, अनुपस्थित व स्तर नोंद तिथेच उघडते) आणि शेवटी शिक्षकाची स्वाक्षरी घ्या.</p></div>';
 if(!VZ.d.tc.length)h+='<div class="card"><p class="m">शाळेतील शिक्षकांची नोंद ॲपमध्ये नाही. खाली नाव जोडा.</p></div>';
 VZ.d.tc.forEach(function(t,i){h+='<div class="card" id="vtc_'+i+'">'+vzTcHtml(i)+'</div>'});
 h+=vzXc()+'<div class="card"><label>शिक्षक जोडा (ॲपमध्ये नोंद नसलेला)</label><input id="vzan" placeholder="शिक्षकाचे नाव"><button class="g" onclick="vzTcAdd()">➕ जोडा</button></div>'+vzAct();return h}
function vzTSt(i,s){var t=VZ.d.tc[i];t.s=t.s===s?'':s;document.getElementById('vtc_'+i).innerHTML=vzTcHtml(i);vzLoc()}
function vzTSet(i,k,v){var t=VZ.d.tc[i];t.a=t.a||{};t.a[k]=t.a[k]===v?'':v;var e=document.getElementById('vt_'+i+'_'+k);if(e)e.innerHTML=vzCh(t.a[k],"vzTSet("+i+",'"+k+"','%v')");vzLoc()}
function vzTcAdd(){var e=document.getElementById('vzan'),n=e.value.trim();if(n.length<2)return;VZ.d.tc.push({id:'m'+Date.now(),n:n,m:1,s:'',a:{},r:'',cl:[]});vzStep(1)}
function vzTcDel(i){if(!confirm('हे नाव काढायचे?'))return;VZ.d.tc.splice(i,1);vzStep(1)}

/* विद्यार्थी */
function vzAt(k,f,el){el.value=vzNum(el.value);var o=VZ.d.at[k]=VZ.d.at[k]||{n:'',p:''};o[f]=el.value;if(f==='p')o.man=1;if(f==='n')vzAtSync(k);vzAtT();vzLoc()}
function vzAtSync(k,f){var o=VZ.d.at[k];if(!o)return;var cnt=VZ.d.ab.filter(function(a){return a.c+'|'+(a.v||'')===k}).length;
 if(+o.n>0&&(f||!o.man)){o.p=String(Math.max(0,+o.n-cnt));o.man=0}
 [].forEach.call(document.querySelectorAll('input[data-pk]'),function(i){if(i.getAttribute('data-pk')===k)i.value=o.p||''})}
function vzAtT(){var e=document.getElementById('vzat');if(!e)return;var c=vzCalc(VZ.d).s;e.innerHTML=c.att!==null?'एकूण उपस्थिती: <b>'+c.ap+' / '+c.an+'</b> ('+c.att+'%)':'<span class="m">उपस्थिती भरल्यावर टक्केवारी दिसेल.</span>'}
function vzAb(pen,on){var d=VZ.d,old=d.ab.filter(function(a){return a.p===pen})[0];if(on){var x=(VZCX.ro||[]).filter(function(r){return r.p===pen})[0];if(x&&!d.ab.some(function(a){return a.p===pen}))d.ab.push({p:pen,n:x.n,c:x.c,v:x.v,r:''})}else d.ab=d.ab.filter(function(a){return a.p!==pen});var ne=d.ab.filter(function(a){return a.p===pen})[0]||old;if(ne){var kk=ne.c+'|'+(ne.v||'');vzAtSync(kk,1);vzCbRe(kk)}vzAtT();vzLoc()}
function vzLvSel(f,v,pen){return '<div style="display:flex;gap:6px;margin:0 0 4px"><select style="margin:0;padding:6px;flex:1;min-width:0;font-size:14px" onchange="%FN"><option value="">'+VZLN[f]+' — निवडा</option>'+VZLV[f].map(function(t,i){return '<option value="'+i+'"'+(String(v)===String(i)?' selected':'')+'>'+(i+1)+'. '+esc(t)+'</option>'}).join('')+'</select><button type="button" class="g" style="width:auto;margin:0;padding:6px 10px;white-space:nowrap" onclick="lvtGo(\''+pen+'\',\''+f+'\')">📝 टेस्ट</button></div>'}
function vzLv(pen,f,v){var x=(VZCX.ro||[]).filter(function(r){return r.p===pen})[0];if(!x)return;var o=VZ.d.lv[pen]=VZ.d.lv[pen]||{n:x.n,c:x.c,v:x.v,l:'',m:'',e:''};o[f]=v;if(o.l===''&&o.m===''&&o.e==='')delete VZ.d.lv[pen];vzLvS();vzLoc()}
function vzLvTab(d){var P=Object.keys(d.lv||{}),h='';if(!P.length)return '<p class="m">स्तर नोंद नाही.</p>';
 h+='<p style="margin:6px 0 4px">तपासलेले विद्यार्थी: <b>'+P.length+'</b></p>';
 ['l','m','e'].forEach(function(f){var c=VZLV[f].map(function(){return 0}),n=0;P.forEach(function(p){var v=d.lv[p][f];if(v!==''&&v!=null){c[+v]++;n++}});
  h+='<table class="vzt" style="margin-bottom:8px"><tr><th colspan="3" style="text-align:left">'+VZLN[f]+' ('+n+' विद्यार्थी)</th></tr>'+VZLV[f].map(function(t,i){return '<tr><td>'+(i+1)+'. '+esc(t)+'</td><td style="width:42px;text-align:center">'+c[i]+'</td><td style="width:50px;text-align:center">'+(n?Math.round(100*c[i]/n)+'%':'')+'</td></tr>'}).join('')+'</table>'});return h}
function vzLvS(){var e=document.getElementById('vzlvs');if(e)e.innerHTML=vzLvTab(VZ.d)}

/* ---- शिक्षकाच्या कार्डात: अध्यापनाचे वर्ग → त्या वर्गाचे विद्यार्थी (उपस्थिती, अनुपस्थित, स्तर) ---- */
var VZCO={};
function vzKeys(){var C=vzCls();if(C.length)return C;var a=[];for(var i=1;i<=8;i++)a.push({k:i+'|',c:i,v:'',n:0});return a}
function vzClN(k){var a=String(k).split('|');return 'इयत्ता '+a[0]+(a[1]?' '+a[1]:'')}
function vzHas(k){var d=VZ.d,o=d.at[k];return (o&&o.p!==''&&o.p!=null)||d.ab.some(function(a){return String(a.c)+'|'+(a.v||'')===k})||Object.keys(d.lv).some(function(p){var x=d.lv[p];return String(x.c)+'|'+(x.v||'')===k})}
function vzUsed(k){return VZ.d.xc.indexOf(k)>=0||VZ.d.tc.some(function(t){return (t.cl||[]).indexOf(k)>=0})}
function vzCbInner(k){var d=VZ.d,a=k.split('|'),C=vzCls(),ro=C.length>0,cc=C.filter(function(x){return x.k===k})[0],o=d.at[k]=d.at[k]||{n:'',p:''},
 stu=(VZCX.ro||[]).filter(function(x){return String(x.c)===a[0]&&(x.v||'')===(a[1]||'')}),
 ab=d.ab.filter(function(x){return String(x.c)+'|'+(x.v||'')===k}),inp='style="margin:0;padding:6px;width:80px" inputmode="numeric"',
 rs=function(sel,fn){return '<select style="margin:4px 0 0;padding:6px" onchange="'+fn+'"><option value="">कारण (ऐच्छिक)</option>'+VZRE.map(function(r){return '<option'+(sel===r?' selected':'')+'>'+esc(r)+'</option>'}).join('')+'</select>'};
 if(ro&&cc&&(o.p===''||o.p==null)){o.p=String(Math.max(0,cc.n-ab.length));o.man=0}
 var h='<b>🧑‍🎓 '+vzClN(k)+'</b><div style="margin:6px 0">पट: '+(ro?'<b>'+(cc?cc.n:o.n)+'</b>':'<input '+inp+' value="'+esc(o.n||'')+'" oninput="vzAt(\''+k+'\',\'n\',this)">')+' &nbsp; उपस्थित: <input data-pk="'+k+'" '+inp+' value="'+esc(o.p||'')+'" oninput="vzAt(\''+k+'\',\'p\',this)"></div>';
 if(ro){
  var bt=function(on,col,lb,fn,dis){return '<button type="button" class="vzb"'+(dis?' disabled':'')+' style="flex:1 1 0;min-width:0;white-space:nowrap;padding:8px 2px!important;margin:0!important;font-size:13px!important;'+(dis?'opacity:.4;background:var(--c);color:var(--m);border:1px solid var(--l)':on?'background:'+col+';color:#fff;border:1px solid '+col:'background:var(--c);color:'+col+';border:1px solid '+col)+'" onclick="'+fn+'">'+lb+'</button>'};
  h+='<p class="m" style="margin:4px 0">सर्व विद्यार्थी डिफॉल्ट <b>उपस्थित</b> आहेत. गैरहजर असेल त्याला "गैरहजर" दाबा; उपस्थित विद्यार्थ्याची "चाचणी" (भाषा, गणित, इंग्रजी स्तर) घेता येते.</p><div style="border:1px solid var(--l);border-radius:10px;padding:2px 8px">'+stu.map(function(x){var ex=ab.filter(function(y){return y.p===x.p})[0],lv=d.lv[x.p],op=!ex&&VZCO['t'+x.p],q="'"+x.p+"'";
   var done=lv?['l','m','e'].filter(function(f){return lv[f]!==''&&lv[f]!=null}).length:0;
   return '<div style="padding:6px 0;border-bottom:1px solid var(--l)"><div><b>'+esc(x.n)+'</b>'+(done?' <small style="color:#15803d">✔ स्तर '+done+'/3</small>':'')+'</div><div style="display:flex;gap:6px;flex-wrap:nowrap;margin-top:4px">'+bt(!ex,'#15803d','✔ उपस्थित','vzAb('+q+',false)')+bt(!!ex,'#b91c1c','✘ गैरहजर','vzAb('+q+',true)')+bt(op,'#0f766e','📝 चाचणी','vzStT('+q+')',!!ex)+'</div>'+(ex?rs(ex.r,"vzAbR("+q+",this.value)"):'')
    +(op?'<div style="margin-top:6px;padding:6px;border:1px dashed var(--l);border-radius:10px">'+['l','m','e'].map(function(f){var v=lv&&lv[f]!=null?lv[f]:'';return vzLvSel(f,v,x.p).replace('%FN',"vzLv('"+x.p+"','"+f+"',this.value)")}).join('')+'</div>':'')+'</div>'}).join('')+'</div>';
 }else{
  h+='<details'+(VZCO[k+'a']?' open':'')+' ontoggle="VZCO[\''+k+'a\']=this.open"><summary><b>🚫 अनुपस्थित विद्यार्थी ('+ab.length+')</b></summary><div class="row" style="margin-top:6px"><input class="abn" placeholder="विद्यार्थ्याचे नाव" style="flex:2;margin:0"><button class="g" style="min-width:0;flex:0 0 auto;margin:0" onclick="vzAbMan(this)">➕</button></div>'+ab.map(function(x){var i=d.ab.indexOf(x);return '<div class="vzr"><b>'+esc(x.n)+'</b><a href="#" style="float:right" onclick="vzAbXI('+i+');return false">✖</a>'+rs(x.r,"VZ.d.ab["+i+"].r=this.value;vzLoc()")+'</div>'}).join('')+'</details>';
 }
 return h}
function vzStT(pen){VZCO['t'+pen]=!VZCO['t'+pen];vzLvRe(pen)}
function vzCbBox(k){return '<div class="vzcb" data-k="'+k+'" style="border:1px solid var(--l);border-radius:12px;padding:8px;margin-top:8px">'+vzCbInner(k)+'</div>'}
function vzCbRe(k){[].forEach.call(document.querySelectorAll('.vzcb'),function(e){if(e.getAttribute('data-k')===k)e.innerHTML=vzCbInner(k)})}
function vzLvRe(pen){var x=(VZCX.ro||[]).filter(function(r){return r.p===pen})[0];if(x)vzCbRe(x.c+'|'+(x.v||''))}
function vzAbR(pen,v){var x=VZ.d.ab.filter(function(a){return a.p===pen})[0];if(x){x.r=v;vzLoc()}}
function vzAbMan(btn){var bx=btn.closest('.vzcb'),k=bx.getAttribute('data-k'),a=k.split('|'),i=bx.querySelector('input.abn'),n=i.value.trim();if(n.length<2)return;VZ.d.ab.push({p:'m'+Date.now(),n:n,c:a[0],v:a[1]||'',r:''});vzAtSync(k,1);vzAtT();vzCbRe(k);vzLoc()}
function vzAbXI(i){var x=VZ.d.ab.splice(i,1)[0];if(x){var k=x.c+'|'+(x.v||'');vzAtSync(k,1);vzAtT();vzCbRe(k)}vzLoc()}
function vzTcRe(i){var e=document.getElementById('vtc_'+i);if(e)e.innerHTML=vzTcHtml(i)}
function vzClSel(rest,fn){return rest.length?'<select style="margin:4px 0 0" onchange="'+fn+'"><option value="">➕ वर्ग जोडा…</option>'+rest.map(function(c){return '<option value="'+c.k+'">'+vzClN(c.k)+'</option>'}).join('')+'</select>':''}
function vzTcCl(i){var t=VZ.d.tc[i],all=vzKeys(),sel=t.cl||[],chip='display:inline-block;background:var(--a);color:#fff;border-radius:14px;padding:3px 10px;margin:2px 4px 2px 0';
 return '<div class="vzr"><div><b>अध्यापनाचे वर्ग</b> <span class="m">(इयत्ता निवडा — त्या वर्गाचे विद्यार्थी खाली उघडतात)</span></div><div>'+sel.map(function(k){return '<span style="'+chip+'">'+vzClN(k)+' <a href="#" style="color:#fff;margin-left:4px" onclick="vzTcClSet('+i+',\''+k+'\',0);return false">✖</a></span>'}).join('')+'</div>'+vzClSel(all.filter(function(c){return sel.indexOf(c.k)<0}),"vzTcClSet("+i+",this.value,1)")+'</div>'+sel.map(vzCbBox).join('')}
function vzTcClSet(i,k,on){if(!k)return;var t=VZ.d.tc[i],d=VZ.d;t.cl=t.cl||[];
 if(on){if(t.cl.indexOf(k)<0)t.cl.push(k);d.xc=d.xc.filter(function(x){return x!==k})}
 else{t.cl=t.cl.filter(function(x){return x!==k});if(!vzUsed(k)&&vzHas(k))d.xc.push(k)}
 vzTcRe(i);var xe=document.getElementById('vxc');if(xe)xe.innerHTML=vzXcIn();vzLoc()}
function vzXcIn(){var d=VZ.d,all=vzKeys(),used={};d.tc.forEach(function(t){(t.cl||[]).forEach(function(k){used[k]=1})});d.xc.forEach(function(k){used[k]=1});
 return '<h2>🧑‍🎓 इतर वर्ग (शिक्षकाशिवाय)</h2><p class="m">शिक्षकाच्या नोंदीत नसलेल्या वर्गाची विद्यार्थी उपस्थिती / अनुपस्थित / स्तर येथे नोंदवा.</p>'+d.xc.map(function(k){return '<div><a href="#" style="float:right;margin-top:10px" onclick="vzXcSet(\''+k+'\',0);return false">✖ काढा</a>'+vzCbBox(k)+'</div>'}).join('')+vzClSel(all.filter(function(c){return !used[c.k]}),"vzXcSet(this.value,1)")}
function vzXc(){return '<div class="card" id="vxc">'+vzXcIn()+'</div>'}
function vzXcSet(k,on){if(!k)return;var d=VZ.d;if(on){if(d.xc.indexOf(k)<0)d.xc.push(k)}else d.xc=d.xc.filter(function(x){return x!==k});var e=document.getElementById('vxc');if(e)e.innerHTML=vzXcIn();vzLoc()}

/* ---- शिक्षकाची स्वाक्षरी (मोबाईलवर बोटाने) ---- */
function vzSgHtml(i){var t=VZ.d.tc[i];return '<div class="vzr"><b>✍ शिक्षकाची स्वाक्षरी</b><div style="margin-top:4px">'+(t.sig?'<img src="'+t.sig+'" style="height:60px;background:#fff;border:1px solid var(--l);border-radius:8px;display:block;margin-bottom:6px"><button type="button" class="g vzb" onclick="vzSg('+i+')">✍ पुन्हा घ्या</button><button type="button" class="g vzb" onclick="vzSgDel('+i+')">✖ काढा</button>':'<button type="button" class="vzb" style="background:var(--a)!important;color:#fff!important" onclick="vzSg('+i+')">✍ स्वाक्षरी घ्या</button>')+'</div></div>'}
function vzSgDel(i){delete VZ.d.tc[i].sig;vzTcRe(i);vzLoc()}
var VZSGM=0;
function vzSg(i){var t=VZ.d.tc[i],e=document.createElement('div');e.id='vzsg';e.style.cssText='position:fixed;inset:0;z-index:300;background:var(--bg);padding:12px;overflow:auto';
 e.innerHTML='<div style="max-width:560px;margin:0 auto"><div class="card"><h2>✍ '+esc(t.n)+' — स्वाक्षरी</h2><p class="m">खालील चौकटीत बोटाने सही करा.</p><canvas id="vzsc" width="400" height="160" style="width:100%;height:auto;aspect-ratio:400/160;background:#fff;border:2px dashed var(--l);border-radius:10px;touch-action:none"></canvas><p id="vzse" class="er"></p><div class="row"><button onclick="vzSgOk('+i+')">✔ जतन करा</button><button class="g" onclick="vzSgClr()">🧽 पुसा</button><button class="g" onclick="vzSgX()">रद्द</button></div></div></div>';
 document.body.appendChild(e);var c=document.getElementById('vzsc'),x=c.getContext('2d'),dr=false;VZSGM=0;x.lineWidth=2.6;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#111';
 function pt(ev){var r=c.getBoundingClientRect();return[(ev.clientX-r.left)*c.width/r.width,(ev.clientY-r.top)*c.height/r.height]}
 c.onpointerdown=function(ev){dr=true;try{c.setPointerCapture(ev.pointerId)}catch(z){}var p=pt(ev);x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(p[0]+.1,p[1]+.1);x.stroke();VZSGM++;ev.preventDefault()};
 c.onpointermove=function(ev){if(!dr)return;var p=pt(ev);x.lineTo(p[0],p[1]);x.stroke();x.beginPath();x.moveTo(p[0],p[1]);VZSGM++;ev.preventDefault()};
 c.onpointerup=c.onpointercancel=function(){dr=false}}
function vzSgClr(){var c=document.getElementById('vzsc');if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);VZSGM=0}}
function vzSgX(){var e=document.getElementById('vzsg');if(e)e.remove()}
function vzSgOk(i){var c=document.getElementById('vzsc');if(!c)return;if(VZSGM<3){document.getElementById('vzse').textContent='आधी सही करा.';return}VZ.d.tc[i].sig=c.toDataURL('image/png');vzSgX();vzTcRe(i);vzLoc()}

/* ---- PDF बनवून WhatsApp वर पाठवा ---- */
function vzJs(src){return new Promise(function(ok,no){if(document.querySelector('script[data-lib="'+src+'"]'))return ok();var s=document.createElement('script');s.src=src;s.setAttribute('data-lib',src);s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
function vzCurV(){return {u:VZ.u,sc:vzSn(VZ.u),k:((window.DATA||[]).filter(function(x){return x.u===VZ.u})[0]||{}).c,dt:VZ.dt,tin:VZ.tin,tout:VZ.tout,vt:VZ.vt,c:U,d:VZ.d}}
function vzCut(cv,y,lo){var x=cv.getContext('2d'),w=cv.width;for(var yy=y;yy>lo;yy-=2){var d=x.getImageData(0,yy,w,1).data,w8=1;for(var i=0;i<d.length;i+=24)if(d[i]<235||d[i+1]<235||d[i+2]<235){w8=0;break}if(w8)return yy}return y}
function vzPdfMake(v){return Promise.all([window.html2canvas?1:vzJs('lib/html2canvas.min.js'),window.jspdf?1:vzJs('lib/jspdf.umd.min.js')]).then(function(){
 var el=document.createElement('div');el.style.cssText='position:absolute;left:-12000px;top:0;width:794px;box-sizing:border-box;padding:28px 30px;background:#fff;color:#111;font:14px/1.5 "Noto Sans Devanagari",system-ui,sans-serif;--l:#9ca3af;--c:#fff;--i:#111;--m:#475569;--bg:#fff';el.innerHTML=vzPrintHtml(v);document.body.appendChild(el);
 return html2canvas(el,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false}).then(function(cv){document.body.removeChild(el);
  var J=window.jspdf.jsPDF,doc=new J({unit:'mm',format:'a4'}),PW=210,PH=297,M=8,uw=PW-2*M,k=uw/cv.width,ph=Math.floor((PH-2*M)/k),y=0,first=1;
  while(y<cv.height-2){var e2=Math.min(cv.height,y+ph);if(e2<cv.height)e2=vzCut(cv,e2,Math.max(y+Math.floor(ph*.6),y+1));var h=e2-y,sc=document.createElement('canvas');sc.width=cv.width;sc.height=h;var cx=sc.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,sc.width,h);cx.drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
   if(!first)doc.addPage();first=0;doc.addImage(sc.toDataURL('image/jpeg',.82),'JPEG',M,M,uw,h*k);y=e2}
  return doc.output('blob')})})}
function vzDl(blob,fn,st){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();a.remove();st.className='ok';st.innerHTML='✔ PDF फोनमध्ये उतरवली (<b>'+esc(fn)+'</b>). WhatsApp उघडून 📎 → Document मधून पाठवा. <a href="https://wa.me/" target="_blank" rel="noopener">WhatsApp उघडा</a>'}
function vzPdfShare(src){var v=src==='cur'?vzCurV():window.VZVW,st=document.getElementById('vzpm');if(!v||!st)return;st.className='m';st.textContent='⏳ PDF बनत आहे… (काही सेकंद लागतील)';
 vzPdfMake(v).then(function(blob){var fn='Shala_Bhet_'+(v.u||'')+'_'+(v.dt||'')+'.pdf',f=new File([blob],fn,{type:'application/pdf'}),tx='शाळा भेट अहवाल – '+(v.sc||'')+' – '+mDt(v.dt);
  if(navigator.canShare&&navigator.canShare({files:[f]}))return navigator.share({files:[f],title:tx,text:tx}).then(function(){st.className='ok';st.textContent='✔ शेअर झाले'}).catch(function(e){if(e&&e.name==='AbortError'){st.textContent='';return}vzDl(blob,fn,st)});
  vzDl(blob,fn,st)}).catch(function(){st.className='er';st.textContent='PDF बनवता आली नाही. इंटरनेट तपासा किंवा 🖨 प्रिंट वापरा.'})}

/* निरीक्षण व जतन */
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
  X.innerHTML=hdr()+'<button class="g" onclick="vzDraw()">← मागे</button><div class="card"><div class="row"><button class="g" onclick="vzPrintV()">🖨 प्रिंट</button><button class="g" onclick="vzPdfShare(\'view\')">📤 PDF – WhatsApp</button>'+(v.mine?'<button class="g" onclick="vzEdit('+v.id+')">✏ बदला</button>':'')+'</div>'+'<p id="vzpm" class="m"></p>'+phBtns('/api/o/vsimg',v.id,v.n,'फोटो')+'</div><div class="card">'+vzRep(v)+'</div>'})}
function vzRep(v){var d=v.d||{},c=vzCalc(d),h='<h3 style="margin:0 0 6px">शाळा भेट अहवाल</h3><table class="vzt"><tr><td><b>शाळा</b></td><td>'+esc(v.sc||vzSn(v.u))+'</td><td><b>UDISE</b></td><td>'+esc(v.u)+'</td></tr><tr><td><b>केंद्र</b></td><td>'+esc(CEN[v.k]||v.k||'')+'</td><td><b>दिनांक / वेळ</b></td><td>'+mDt(v.dt)+(v.tin?' · '+esc(v.tin)+(v.tout?' – '+esc(v.tout):''):'')+'</td></tr><tr><td><b>भेट देणारे</b></td><td>'+esc(vzWho(v.c))+'</td><td><b>भेट प्रकार</b></td><td>'+esc(v.vt||'')+'</td></tr>'+geoRep(d)+'</table>';
 h+='<h4 style="margin:12px 0 4px">📈 एकूण मूल्यांकन</h4>'+vzScoreTab(c);
 ['a','b','c'].forEach(function(s){h+='<h4 style="margin:12px 0 4px">'+VZQ[s].t+'</h4>';
  if(s==='b'&&d.pm&&(d.pm.menu||d.pm.p||d.pm.e))h+='<p style="margin:0 0 4px">मेनू: '+esc(d.pm.menu||'—')+' · पटावर हजर: '+esc(d.pm.p||'—')+' · आहार घेतलेले: '+esc(d.pm.e||'—')+'</p>';
  h+='<table class="vzt">'+VZQ[s].q.map(function(q){return '<tr><td>'+q[1]+'</td><td style="width:84px">'+vzAL((d.k||{})[q[0]])+'</td></tr>'}).join('')+'</table>'+(d[s+'_r']?'<p style="margin:4px 0 0"><b>शेरा:</b> '+esc(d[s+'_r'])+'</p>':'')});
 h+='<h4 style="margin:12px 0 4px">👨‍🏫 शिक्षक</h4>';
 var tn={P:'उपस्थित',L:'उशिरा आले',A:'रजेवर',T:'प्रशिक्षण / कामगिरी',U:'विनापरवानगी गैरहजर'};
 if(!(d.tc||[]).length)h+='<p class="m">नोंद नाही.</p>';
 (d.tc||[]).forEach(function(t){h+='<table class="vzt" style="margin-bottom:8px"><tr><th style="text-align:left">'+esc(t.n)+'</th><th style="width:130px">'+(tn[t.s]||'— नोंद नाही')+'</th></tr>'+((t.s==='P'||t.s==='L')?VZTQ.map(function(q){return '<tr><td>'+q[1]+'</td><td>'+vzAL((t.a||{})[q[0]])+'</td></tr>'}).join(''):'')+(t.s&&(t.cl||[]).length?'<tr><td colspan="2"><b>अध्यापनाचे वर्ग:</b> '+t.cl.map(vzClN).join(', ')+'</td></tr>':'')+(t.r?'<tr><td colspan="2"><b>शेरा:</b> '+esc(t.r)+'</td></tr>':'')+(t.s?'<tr><td colspan="2"><b>स्वाक्षरी:</b> '+(t.sig?'<img src="'+t.sig+'" style="height:46px;vertical-align:middle">':'<span style="color:#64748b">—</span>')+'</td></tr>':'')+'</table>'});
 h+='<h4 style="margin:12px 0 4px">🧑‍🎓 विद्यार्थी – उपस्थिती</h4><table class="vzt"><tr><th>वर्ग</th><th>पट</th><th>उपस्थित</th><th>%</th></tr>'+Object.keys(d.at||{}).filter(function(k){var x=d.at[k];return x.p!==''&&x.p!=null}).sort().map(function(k){var x=d.at[k],a=k.split('|'),n=+x.n,p=+x.p;return '<tr><td>इयत्ता '+esc(a[0])+' '+esc(a[1])+'</td><td>'+esc(x.n)+'</td><td>'+esc(x.p)+'</td><td>'+(n>0?Math.round(100*Math.min(p,n)/n)+'%':'')+'</td></tr>'}).join('')+'</table>'+(c.s.att!==null?'<p style="margin:4px 0 0"><b>एकूण उपस्थिती: '+c.s.ap+' / '+c.s.an+' ('+c.s.att+'%)</b></p>':'');
 h+='<h4 style="margin:12px 0 4px">🚫 अनुपस्थित विद्यार्थी ('+(d.ab||[]).length+')</h4>'+((d.ab||[]).length?'<table class="vzt"><tr><th>नाव</th><th>वर्ग</th><th>कारण</th></tr>'+d.ab.map(function(x){return '<tr><td>'+esc(x.n)+'</td><td>'+esc(x.c)+' '+esc(x.v)+'</td><td>'+esc(x.r||'')+'</td></tr>'}).join('')+'</table>':'<p class="m">नोंद नाही.</p>');
 h+='<h4 style="margin:12px 0 4px">📊 विद्यार्थी स्तर नोंद</h4>'+vzLvTab(d);
 var P=Object.keys(d.lv||{});if(P.length)h+='<table class="vzt" style="margin-top:6px"><tr><th>विद्यार्थी</th><th>वर्ग</th><th>भाषा वाचन</th><th>गणित</th><th>इंग्रजी वाचन</th></tr>'+P.map(function(p){var x=d.lv[p];return '<tr><td>'+esc(x.n)+'</td><td>'+esc(x.c)+' '+esc(x.v)+'</td>'+['l','m','e'].map(function(f){return '<td style="text-align:center">'+(x[f]===''||x[f]==null?'—':(+x[f]+1))+'</td>'}).join('')+'</tr>'}).join('')+'</table><p class="m" style="margin:4px 0 0">स्तर क्रमांक १ (सर्वात कमी) ते ५ (सर्वात जास्त).</p>';
 h+='<h4 style="margin:12px 0 4px">📝 निरीक्षण</h4>'+[['good','चांगल्या बाबी'],['bad','आढळलेल्या त्रुटी / अडचणी'],['sug','दिलेल्या सूचना'],['fu','पुढील पाठपुरावा']].map(function(f){return '<p style="margin:2px 0;white-space:pre-wrap"><b>'+f[1]+':</b> '+(esc(d[f[0]]||'')||'—')+'</p>'}).join('')+(d.fd?'<p style="margin:2px 0"><b>पाठपुरावा मुदत:</b> '+mDt(d.fd)+'</p>':'');
 return h}
function vzPrintHtml(v){return vzRep(v)+'<table style="margin-top:46px;border:0"><tr><td style="border:0;text-align:left;width:50%">मुख्याध्यापक<br>सही / शिक्का</td><td style="border:0;text-align:right">भेट देणारे अधिकारी<br>'+esc(vzWho(v.c))+'<br>सही</td></tr></table>'}
function vzPrintV(){var v=window.VZVW;if(!v)return;var o=window.PDFT;window.PDFT='शाळा भेट - '+(v.sc||v.u)+' - '+mDt(v.dt).replace(/\//g,'-');pprint(vzPrintHtml(v));window.PDFT=o}
function vzPrintCur(){var v=vzCurV();var o=window.PDFT;window.PDFT='शाळा भेट - '+v.sc+' - '+mDt(v.dt).replace(/\//g,'-');pprint(vzPrintHtml(v));window.PDFT=o}
