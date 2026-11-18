/* भेट नियोजन – KP (office.html).
   केंद्रातील प्रत्येक शाळेला महिन्यातून २ भेटी: शाळांचे "गट" (एका दिवसाच्या शाळा / नेहमी एकत्र जोड्या) ठरवले की
   महिन्याचे नियोजन आपोआप तयार होते. रविवार व निश्चित तारखेच्या सुट्ट्या वगळल्या जातात; मोकळे दिवस निवडता येतात.
   वापरते: office.html (X, api, esc, hdr, save, pprint, U, ROLE, LB, DATA) आणि reg.js (rOffBack).
   सर्व नावे vp/VPL ने सुरू होतात, म्हणजे इतर फाईलींच्या नावांशी टक्कर होत नाही.
   सर्व्हर: /api/o/vpget, /api/o/vpsave (worker.js, तक्ता kp_vplan: k='cfg' किंवा 'm:YYYY-MM'). */
var VPL={cfg:null,md:null,vs:[],cls:{},bl:{},tab:'P',y:0,m:0,msg:'',k:5,stale:0};
var VPW=['रवि','सोम','मंगळ','बुध','गुरु','शुक्र','शनि'];
var VPMN=['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
var VPFX={'01-26':'प्रजासत्ताक दिन','02-19':'शिवजयंती','04-14':'आंबेडकर जयंती','05-01':'महाराष्ट्र दिन','08-15':'स्वातंत्र्य दिन','10-02':'गांधी जयंती','12-25':'नाताळ'};

/* गिरगाव केंद्र (CLU3603591) – मंजूर केलेले गट व डिसेंबर २०२६ चे नियोजन (पहिल्यांदा उघडल्यावर आपोआप जतन होते) */
var VPB='273502';
function vpU(c){return VPB+c}
var VPSEED={sm:4,bg:3,nm:{},groups:[],ex:[vpU('07905')]};
(function(){
 var N={'07901':'अकलवाडी','07902':'मालाबादवस्ती','07903':'मावीमारवस्ती','07904':'पसायदान हायस्कूल','07905':'न्यू इंग्लिश स्कूल जलिहाल (बु.)','07906':'ओम आनंद हायस्कूल','08001':'माणिक नाल','08002':'रेवुल्लमतांडा','08101':'कन्नड गिरगाव','08103':'धुमाळवस्ती','08104':'मदनेवस्ती','08105':'मराठी गिरगाव','08106':'चव्हाणवस्ती','08107':'कुंभारवस्ती','08108':'शिवाजी माध्यमिक (गिरगाव हायस्कूल)','08109':'जमादडे पुजारी वस्ती','08112':'भोपटेवस्ती','08201':'लवंगा','08701':'मोरबगी','08702':'औरळवस्ती','08703':'न्यू कन्नड माध्यमिक (मोरबगी)'};
 Object.keys(N).forEach(function(c){VPSEED.nm[vpU(c)]=N[c]});
 [['अकलवाडी',['07901','07904']],['दक्षिण रस्ता',['07906','08002']],['दक्षिण (लहान)',['07903','07902']],['मोरबगी – माणिक नाल',['08701','08001']],['पूर्व शाखा',['08702','08703']],['उत्तर फेरा',['08201','08107']],['गिरगाव',['08101','08105']],['गिरगाव – जमादडे',['08108','08109']],['चव्हाण – मदने',['08106','08104']],['धुमाळ – भोपटे',['08103','08112']]]
 .forEach(function(g){VPSEED.groups.push({n:g[0],s:g[1].map(vpU)})});
})();
var VPSEEDM={v:[],b:['2026-12-15'],f:['2026-12-01','2026-12-09','2026-12-16','2026-12-24','2026-12-30']};
(function(){
 var r1=['2026-12-02','2026-12-03','2026-12-04','2026-12-05','2026-12-07','2026-12-08','2026-12-10','2026-12-11','2026-12-12','2026-12-14'],
     r2=['2026-12-17','2026-12-18','2026-12-19','2026-12-21','2026-12-22','2026-12-23','2026-12-26','2026-12-28','2026-12-29','2026-12-31'];
 r1.forEach(function(d,i){VPSEEDM.v.push([d,i,1])});r2.forEach(function(d,i){VPSEEDM.v.push([d,i,2])});
})();

function vp2(n){return n<10?'0'+n:''+n}
function vpIso(y,m,d){return y+'-'+vp2(m+1)+'-'+vp2(d)}
function vpCode(){return (window.DATA&&window.DATA[0]&&window.DATA[0].c)||U}
function vpDm(s){var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function vpKey(){return VPL.y+'-'+vp2(VPL.m+1)}
function vpParse(s){if(!s)return null;try{return JSON.parse(s)}catch(e){return null}}
function vpWork(y,m){var n=new Date(y,m+1,0).getDate(),o=[];for(var d=1;d<=n;d++){var w=new Date(y,m,d).getDay();if(w===0||VPFX[vp2(m+1)+'-'+vp2(d)])continue;o.push(vpIso(y,m,d))}return o}
function vpDays(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5)}

/* नियोजन तयार करणे: मोकळे दिवस वगळून पहिली फेरी सुरुवातीच्या दिवसांत, दुसरी फेरी शेवटच्या दिवसांत, मधले दिवस राखीव. */
function vpGen(n,y,m,fr,k){
 var W=vpWork(y,m),fs={},i;
 if(fr){fr.forEach(function(d){fs[d]=1})}
 else{var kk=Math.max(0,Math.min(W.length,k==null?5:k));
  for(i=0;i<kk;i++){fs[W[kk===1?0:Math.round(i*(W.length-1)/(kk-1))]]=1}}
 var V=W.filter(function(d){return !fs[d]}),r1,r2,b=[],warn='';
 if(V.length<2*n){r1=V.slice(0,n);r2=V.slice(n);warn='भेटीसाठी दिवस कमी आहेत – '+(2*n-V.length)+' भेटी बसल्या नाहीत. मोकळे दिवस कमी करा.'}
 else{r1=V.slice(0,n);r2=V.slice(V.length-n);b=V.slice(n,V.length-n)}
 var v=[];r1.forEach(function(d,j){v.push([d,j,1])});r2.forEach(function(d,j){v.push([d,j,2])});
 var f=Object.keys(fs).sort();
 return{v:v,b:b,f:f,w:warn}}

function vpGap(md){var a={},g=null;(md.v||[]).forEach(function(x){(a[x[1]]=a[x[1]]||{})[x[2]]=x[0]});
 Object.keys(a).forEach(function(k){if(a[k][1]&&a[k][2]){var d=vpDays(a[k][1],a[k][2]);if(g===null||d<g)g=d}});return g}
function vpBig(u){var c=VPL.cls[u];return !!c&&c[1]>=5}
function vpNm(u){var c=VPL.cfg&&VPL.cfg.nm&&VPL.cfg.nm[u];if(c)return c;var r=(window.DATA||[]).filter(function(x){return x.u===u})[0];if(r&&r.nm)return r.nm;var q=VPL.cls[u];return q&&q[2]?q[2]:u}
function vpSz(u){var c=VPL.cls[u];return c?'इ.'+c[0]+'–'+c[1]:''}
function vpWarn(g){var n=g.s.length,bg=g.s.some(vpBig),lim=bg?VPL.cfg.bg:VPL.cfg.sm;return n>lim?'⚠ '+(bg?'मोठी शाळा असल्याने दिवसाला जास्तीत जास्त ':'दिवसाला जास्तीत जास्त ')+lim+' शाळा':''}

/* क्लास माहिती (वर्ग-गट) – data/udise/<ब्लॉक>.json */
function vpCls(us){var bs={};us.forEach(function(u){bs[u.slice(0,6)]=1});
 return Promise.all(Object.keys(bs).map(function(b){if(VPL.bl[b])return 0;return fetch('/data/udise/'+b+'.json').then(function(r){return r.json()}).then(function(j){VPL.bl[b]=j}).catch(function(){VPL.bl[b]={}})})).then(function(){
  us.forEach(function(u){var j=VPL.bl[u.slice(0,6)]||{},x=j[u.slice(6)];if(x)VPL.cls[u]=[x[3],x[4],x[0]]})})}

function vpAuto(){var by={},g=[];
 (window.DATA||[]).forEach(function(r){var v=r.u.slice(6,9);(by[v]=by[v]||[]).push(r.u)});
 Object.keys(by).sort().forEach(function(v){var L=by[v].sort(),i=0,st=g.length;
  while(i<L.length){g.push({n:'',s:L.slice(i,i+2)});i+=2}
  var last=g[g.length-1];if(g.length-st>1&&last.s.length===1){var p=g[g.length-2];if(p.s.length<3){p.s=p.s.concat(last.s);g.pop()}}});
 return{sm:4,bg:3,nm:{},groups:g}}

function vpSave(k,o){return api('/api/o/vpsave',{k:k,data:JSON.stringify(o)}).then(function(j){VPL.msg=j.ok?'✓ जतन झाले':'जतन झाले नाही – इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.';return j})}
function vpSaveCfg(){return vpSave('cfg',VPL.cfg)}
function vpSaveMd(){return vpSave('m:'+vpKey(),VPL.md)}

function vpGo(){var d=new Date(),m=d.getMonth(),y=d.getFullYear();if(d.getDate()>=15){m++;if(m>11){m=0;y++}}VPL.y=y;VPL.m=m;VPL.tab='P';VPL.msg='';vpLoad()}
function vpMon(v){var p=v.split('-');VPL.y=+p[0];VPL.m=+p[1]-1;VPL.msg='';vpLoad()}
function vpLoad(){
 X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';
 var mk=vpKey();
 return Promise.all([api('/api/o/vpget',{k:'cfg'}),api('/api/o/vpget',{k:'m:'+mk}),api('/api/o/vs',{mon:mk})]).then(function(a){
  if(!a[0].ok||!a[1].ok){if(a[0].$s===401){location.reload();return}X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="er">लोड झाले नाही.</p><button onclick="vpLoad()">पुन्हा प्रयत्न</button></div>';return}
  VPL.cfg=vpParse(a[0].data);VPL.md=vpParse(a[1].data);VPL.vs=(a[2].ok?a[2].rows:[]).filter(function(x){return x.mine});
  var gir=vpCode()==='CLU3603591',sv=[];
  if(!VPL.cfg){VPL.cfg=gir?JSON.parse(JSON.stringify(VPSEED)):vpAuto();sv.push(vpSaveCfg())}
  if(!VPL.cfg.ex)VPL.cfg.ex=[];
  if(!VPL.md&&gir&&mk==='2026-12'){VPL.md=JSON.parse(JSON.stringify(VPSEEDM));sv.push(vpSaveMd())}
  var us=[].concat.apply([],VPL.cfg.groups.map(function(g){return g.s})).concat((window.DATA||[]).map(function(r){return r.u}));
  return Promise.all(sv).then(function(){return vpCls(us)}).then(vpDraw)});
}

function vpMonSel(){var d=new Date(),o='',i;for(i=-1;i<=4;i++){var t=new Date(d.getFullYear(),d.getMonth()+i,1),v=t.getFullYear()+'-'+vp2(t.getMonth()+1);o+='<option value="'+v+'"'+(v===vpKey()?' selected':'')+'>'+VPMN[t.getMonth()]+' '+t.getFullYear()+'</option>'}return o}
function vpTab(t){VPL.tab=t;vpDraw()}
function vpDraw(){
 var tb=[['P','📅 नियोजन'],['G','👥 गट / जोड्या'],['C','✅ कव्हरेज']].map(function(x){return '<button class="'+(VPL.tab===x[0]?'':'g')+'" style="min-width:0;padding:8px 4px;font-size:13px" onclick="vpTab(\''+x[0]+'\')">'+x[1]+'</button>'}).join('');
 var h=hdr()+rOffBack()+'<div class="card"><h2>📅 भेट नियोजन</h2><label>महिना</label><select onchange="vpMon(this.value)">'+vpMonSel()+'</select><div class="row" style="flex-wrap:nowrap">'+tb+'</div>'+(VPL.msg?'<p class="m">'+esc(VPL.msg)+'</p>':'')+'</div>';
 h+=VPL.tab==='G'?vpGroups():VPL.tab==='C'?vpCover():vpPlan();
 X.innerHTML=h;window.scrollTo(0,0)}

/* ===== नियोजन टॅब ===== */
function vpRowsOf(){var y=VPL.y,m=VPL.m,n=new Date(y,m+1,0).getDate(),md=VPL.md||{v:[],b:[],f:[]},vm={},bs={},fs={},o=[];
 md.v.forEach(function(x){vm[x[0]]=x});md.b.forEach(function(d){bs[d]=1});md.f.forEach(function(d){fs[d]=1});
 for(var d=1;d<=n;d++){var iso=vpIso(y,m,d),w=new Date(y,m,d).getDay(),hol=VPFX[vp2(m+1)+'-'+vp2(d)]||'',r={d:d,iso:iso,w:w};
  if(w===0)r.t='sun';else if(hol){r.t='hol';r.l=hol+' सुट्टी'}else if(vm[iso]){r.t='v';r.g=vm[iso][1];r.r=vm[iso][2]}else if(bs[iso])r.t='b';else r.t='f';
  o.push(r)}
 return o}
function vpChips(gi,iso){var g=VPL.cfg.groups[gi];if(!g)return '';return g.s.map(function(u){var dn=VPL.vs.some(function(x){return x.u===u&&x.dt===iso});return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:12px;border:1px solid var(--l);background:'+(dn?'#dcfce7':'var(--c)')+'">'+(dn?'✔ ':'')+esc(vpNm(u))+(vpBig(u)?'':' <small>(लहान)</small>')+'</span>'}).join('')}
function vpPlan(){
 var G=VPL.cfg.groups.length,h='';
 if(!VPL.md){
  return '<div class="card"><p>'+VPMN[VPL.m]+' '+VPL.y+' चे नियोजन अजून तयार नाही. '+G+' गट × २ फेऱ्या.</p><label>मोकळे दिवस (सभा / कार्यालयीन कामासाठी)</label><input type="number" min="0" max="15" value="'+VPL.k+'" onchange="VPL.k=+this.value">'
   +'<button onclick="vpMake()">नियोजन तयार करा</button><p class="m">पहिली फेरी महिन्याच्या सुरुवातीला व दुसरी शेवटी येते; दोन भेटींमध्ये जास्तीत जास्त अंतर राहते. पहिला व शेवटचा कामाचा दिवस मोकळा ठेवला जातो.</p></div>'}
 var md=VPL.md,gp=vpGap(md),nv=md.v.length,rows=vpRowsOf();
 var info='भेटीचे दिवस: '+nv+' · राखीव: '+md.b.length+' · मोकळे: '+md.f.length+(gp!==null?' · दोन भेटींमधील किमान अंतर: '+gp+' दिवस':'');
 h+='<div class="card"><b>'+esc(info)+'</b>'+(md.w?'<p class="er">'+esc(md.w)+'</p>':'')+(VPL.stale?'<p class="er">⚠ गट बदलले आहेत – "पुन्हा तयार करा" दाबा.</p>':'')
  +'<div class="row"><button class="g" onclick="vpPrint()">🖨 छापा</button><button class="g" onclick="vpCsv()">📄 CSV</button><button class="g" onclick="vpCopy()">📋 कॉपी</button></div>'
  +'<label>पुन्हा तयार करा – मोकळे दिवस (संख्या)</label><div class="row" style="flex-wrap:nowrap"><input type="number" min="0" max="15" value="'+md.f.length+'" onchange="VPL.k=+this.value"><button class="g" style="min-width:0" onclick="vpMake()">↻ पुन्हा तयार करा</button></div>'
  +'<p class="m" style="font-size:13px">एखाद्या दिवशी सभा/काम आले तर त्या तारखेसमोरील "मोकळा करा" दाबा – बाकीचे दिवस आपोआप सरकतात.</p></div>';
 rows.forEach(function(r){
  var wd=VPW[r.w],dt=r.d+' '+wd,bg='var(--c)',body='',bt='';
  if(r.t==='sun'){bg='#fde4e4';body='<span class="m">रविवार सुट्टी</span>'}
  else if(r.t==='hol'){bg='#fff1e0';body='<span class="m">'+esc(r.l)+'</span>'}
  else if(r.t==='v'){var g=VPL.cfg.groups[r.g];body='<b>फेरी '+r.r+' · दिवस '+(r.g+1)+(g&&g.n?' – '+esc(g.n):'')+'</b><br>'+vpChips(r.g,r.iso);bt='<button class="g" style="width:auto;margin:0;padding:4px 8px;font-size:12px" onclick="vpTg(\''+r.iso+'\')">मोकळा करा</button>'}
  else if(r.t==='b'){bg='#eef2ff';body='<b>राखीव दिवस</b> <span class="m">(राहिलेल्या भेटींसाठी)</span>';bt='<button class="g" style="width:auto;margin:0;padding:4px 8px;font-size:12px" onclick="vpTg(\''+r.iso+'\')">मोकळा करा</button>'}
  else{bg='#ecfdf5';body='<span class="m">मोकळा दिवस (सभा / कार्यालयीन)</span>';bt='<button class="g" style="width:auto;margin:0;padding:4px 8px;font-size:12px" onclick="vpTg(\''+r.iso+'\')">भेट ठेवा</button>'}
  h+='<div style="display:flex;gap:8px;align-items:flex-start;background:'+bg+';border:1px solid var(--l);border-radius:10px;padding:8px 10px;margin-bottom:6px"><div style="min-width:64px"><b>'+dt+'</b></div><div style="flex:1;min-width:0">'+body+'</div>'+bt+'</div>'});
 return h}
function vpMake(){var G=VPL.cfg.groups.length,k=VPL.k;if(VPL.md&&!confirm('हा महिना नव्याने तयार करायचा? सध्याचे नियोजन बदलेल.'))return;
 VPL.md=vpGen(G,VPL.y,VPL.m,null,k);VPL.stale=0;VPL.msg='';vpSaveMd().then(vpDraw)}
function vpTg(iso){var md=VPL.md,f=md.f.slice(),i=f.indexOf(iso);if(i>=0)f.splice(i,1);else f.push(iso);
 VPL.md=vpGen(VPL.cfg.groups.length,VPL.y,VPL.m,f);VPL.stale=0;vpSaveMd().then(vpDraw)}

/* ===== गट / जोड्या टॅब ===== */
function vpGroups(){
 var c=VPL.cfg,h='<div class="card"><p class="m">प्रत्येक गट म्हणजे एका दिवसाच्या भेटीच्या शाळा (नेहमी एकत्र जोड्या). एका फेरीत गटांच्या क्रमाने दिवस येतात. शाळा दुसऱ्या गटात हलवण्यासाठी शाळेसमोरील यादी वापरा.</p>'
  +'<div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>फक्त लहान शाळा (इ. १–४) – दिवसाला जास्तीत जास्त</label><input type="number" min="1" max="8" value="'+c.sm+'" onchange="vpRule(\'sm\',this.value)"></div><div style="flex:1"><label>मोठी शाळा असल्यास – जास्तीत जास्त</label><input type="number" min="1" max="8" value="'+c.bg+'" onchange="vpRule(\'bg\',this.value)"></div></div>'
  +'<div class="row"><button class="g" onclick="vpNew()">+ नवीन गट</button><button class="g" onclick="vpRebuild()">↻ आपोआप गट बनवा (गावानुसार)</button></div></div>';
 c.groups.forEach(function(g,gi){
  var w=vpWarn(g);
  h+='<div class="card"><div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><b style="flex:1">गट '+(gi+1)+(g.n?' – '+esc(g.n):'')+'</b><button class="g" style="width:auto;margin:0;padding:4px 10px" onclick="vpMvG('+gi+',-1)">↑</button><button class="g" style="width:auto;margin:0;padding:4px 10px" onclick="vpMvG('+gi+',1)">↓</button></div>'+(w?'<p class="er">'+w+'</p>':'');
  g.s.forEach(function(u,si){
   h+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><div style="flex:1;min-width:0">'+esc(vpNm(u))+'<br><small>'+u+' · '+(vpBig(u)?'मोठी':'लहान')+' '+vpSz(u)+'</small></div><select style="width:auto;max-width:46%;margin:0" onchange="vpMvS('+gi+','+si+',this.value)"><option value="">गट हलवा…</option>'
    +c.groups.map(function(x,xi){return xi===gi?'':'<option value="'+xi+'">→ गट '+(xi+1)+'</option>'}).join('')+'<option value="N">→ नवीन गट</option></select></div>'});
  h+='</div>'});
 var as={};c.groups.forEach(function(g){g.s.forEach(function(u){as[u]=1})});
 var ex=c.ex||[],un=(window.DATA||[]).map(function(r){return r.u}).filter(function(u){return !as[u]&&ex.indexOf(u)<0});
 if(un.length){h+='<div class="card"><b>⚠ गट नसलेल्या शाळा ('+un.length+')</b><p class="m">या शाळा नियोजनात येत नाहीत. गटात जोडा किंवा भेटीतून वगळा.</p>';
  un.forEach(function(u){h+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><div style="flex:1;min-width:0">'+esc(vpNm(u))+'<br><small>'+u+' '+vpSz(u)+'</small></div><select style="width:auto;max-width:34%;margin:0" onchange="vpAdd(\''+u+'\',this.value)"><option value="">गटात जोडा…</option>'
   +c.groups.map(function(x,xi){return '<option value="'+xi+'">→ गट '+(xi+1)+'</option>'}).join('')+'<option value="N">→ नवीन गट</option></select><button class="g" style="width:auto;margin:0;padding:6px 8px;font-size:12px" onclick="vpEx(\''+u+'\',1)">वगळा</button></div>'});
  h+='</div>'}
 if(ex.length){h+='<div class="card"><b>भेटीतून वगळलेल्या शाळा</b>';ex.forEach(function(u){h+='<div style="display:flex;gap:6px;align-items:center;margin-top:6px"><div style="flex:1">'+esc(vpNm(u))+'</div><button class="g" style="width:auto;margin:0;padding:6px 8px;font-size:12px" onclick="vpEx(\''+u+'\',0)">परत घ्या</button></div>'});h+='</div>'}
 return h}
function vpAdd(u,v){if(v==='')return;var g=VPL.cfg.groups;if(v==='N')g.push({n:'',s:[u]});else g[+v].s.push(u);vpTouch()}
function vpEx(u,on){var e=VPL.cfg.ex||(VPL.cfg.ex=[]),i=e.indexOf(u);if(on&&i<0)e.push(u);if(!on&&i>=0)e.splice(i,1);vpTouch()}
function vpTouch(){VPL.stale=VPL.md?1:0;vpSaveCfg().then(vpDraw)}
function vpRule(k,v){v=Math.max(1,Math.min(8,+v||1));VPL.cfg[k]=v;vpTouch()}
function vpMvG(gi,d){var g=VPL.cfg.groups,j=gi+d;if(j<0||j>=g.length)return;var t=g[gi];g[gi]=g[j];g[j]=t;vpTouch()}
function vpMvS(gi,si,v){if(v==='')return;var g=VPL.cfg.groups,u=g[gi].s.splice(si,1)[0];
 if(v==='N')g.push({n:'',s:[u]});else g[+v].s.push(u);
 VPL.cfg.groups=g.filter(function(x){return x.s.length});vpTouch()}
function vpNew(){VPL.msg='शाळा "गट हलवा" यादीतून → नवीन गट मध्ये हलवा.';vpDraw()}
function vpRebuild(){if(!confirm('आताचे सर्व गट काढून गावानुसार नवीन गट बनवायचे?'))return;var nm=VPL.cfg.nm||{},ex=VPL.cfg.ex||[],a=vpAuto();a.nm=nm;a.ex=ex;a.groups=a.groups.map(function(g){g.s=g.s.filter(function(u){return ex.indexOf(u)<0});return g}).filter(function(g){return g.s.length});VPL.cfg=a;vpTouch()}

/* ===== कव्हरेज टॅब ===== */
function vpCover(){
 var n=0,h='<div class="card"><h2>✅ कव्हरेज – '+VPMN[VPL.m]+'</h2><p class="m">नियोजित भेटी व प्रत्यक्ष नोंदवलेल्या भेटी (🏫 शाळा भेट मधून). लक्ष्य: प्रत्येक शाळेला २ भेटी.</p><div class="w"><table><tr><th>शाळा</th><th>नियोजित</th><th>झाल्या</th><th></th></tr>',pl={};
 if(VPL.md)VPL.md.v.forEach(function(x){var g=VPL.cfg.groups[x[1]];if(g)g.s.forEach(function(u){pl[u]=(pl[u]||0)+1})});
 VPL.cfg.groups.forEach(function(g){g.s.forEach(function(u){var dn=VPL.vs.filter(function(x){return x.u===u&&x.dt.slice(0,7)===vpKey()}).length,ok=dn>=2;n+=ok?1:0;
  h+='<tr><td>'+esc(vpNm(u))+'</td><td>'+(pl[u]||0)+'</td><td><b class="'+(ok?'ok':dn?'':'no')+'">'+dn+'/2</b></td><td>'+(ok?'✔':'')+'</td></tr>'})});
 return h+'</table></div><p>२ भेटी पूर्ण झालेल्या शाळा: <b>'+n+'</b></p></div>'}

/* ===== छापा / CSV / कॉपी ===== */
function vpList(){var o=[];vpRowsOf().forEach(function(r){var t='';
 if(r.t==='sun')t='रविवार सुट्टी';else if(r.t==='hol')t=r.l;else if(r.t==='b')t='राखीव दिवस';else if(r.t==='f')t='मोकळा दिवस';
 else{var g=VPL.cfg.groups[r.g];t=g?g.s.map(vpNm).join(', '):''}
 o.push([vpDm(r.iso),VPW[r.w],t,r.t==='v'?'फेरी '+r.r:''])});return o}
function vpPrint(){var R=vpList(),h='<h2 style="text-align:center">'+esc(LB)+'</h2><h3 style="text-align:center">शाळा भेट नियोजन – '+VPMN[VPL.m]+' '+VPL.y+'</h3><table><tr><th>दिनांक</th><th>वार</th><th>भेटीच्या शाळा / तपशील</th><th>फेरी</th></tr>'
 +R.map(function(r){return '<tr><td>'+r.map(esc).join('</td><td>')+'</td></tr>'}).join('')+'</table><p style="margin-top:30px;text-align:right">केंद्रप्रमुख</p>';pprint(h)}
function vpCsv(){save('bhet_niyojan_'+vpKey()+'.csv',[['दिनांक','वार','भेटीच्या शाळा / तपशील','फेरी']].concat(vpList()))}
function vpCopy(){var t=vpList().map(function(r){return r[0]+' ('+r[1]+'): '+r[2]}).join('\n');
 try{navigator.clipboard.writeText(t).then(function(){VPL.msg='✓ कॉपी झाले';vpDraw()},function(){prompt('कॉपी करा',t)})}catch(e){prompt('कॉपी करा',t)}}
