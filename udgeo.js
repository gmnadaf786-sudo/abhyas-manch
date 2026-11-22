/* UDISE कोडवरून जिल्हा / तालुका / शाळा आपोआप भरणे व केंद्र ड्रॉपडाऊन.
   index.html (विद्यार्थी, शिक्षक, शाळा नोंदणी) व teacher.html (शिक्षक नोंदणी) वापरतात.
   डेटा (tools/build_udise.py ने बनतो): geo.json (जिल्हा › तालुका{b: ब्लॉक कोड} › केंद्र[नाव, anchor, CLU कोड])
   व data/udise/<UDISE चे पहिले ६ अंक>.json (शाळेचे रेकॉर्ड – रचना build_udise.py च्या सुरुवातीला).
   शाळेचा ब्लॉक कोड (रेकॉर्ड[6]) → तालुका; शाळेचा केंद्र कोड (रेकॉर्ड[5]) → केंद्र आपोआप निवडले जाते.
   सर्व नावे udg ने सुरू होतात. */
var UDG={g:null,b:null,d:null,q:null};
function udgOpts(a,f){return '<option value="">'+f+'</option>'+a.map(function(x,i){return '<option value="'+i+'">'+x+'</option>'}).join('')}
function udgGeo(cb){
  if(UDG.g){cb(UDG.g);return}
  if(UDG.q){UDG.q.push(cb);return}
  UDG.q=[cb];
  fetch('geo.json').then(function(r){return r.json()}).then(function(g){
    var b={};
    g.forEach(function(di,i){di.t.forEach(function(t,j){(t.b||[]).forEach(function(c){b[c]=[i,j]})})});
    UDG.g=g;UDG.b=b;var q=UDG.q;UDG.q=null;q.forEach(function(f){f(g)})
  }).catch(function(){var q=UDG.q;UDG.q=null;q.forEach(function(f){f(null)})})}
/* कोड शोधा → cb(null) कोड चुकीचा; नाहीतर cb({s:रेकॉर्ड|null, di, ti, ki, g}) ; di/ti/ki = geo मधील index किंवा -1 */
function udgFind(u,cb){
  if(!/^27\d{9}$/.test(u)){cb(null);return}
  udgGeo(function(g){
    fetch('data/udise/'+u.slice(0,6)+'.json').then(function(r){return r.ok?r.json():{}}).then(function(j){
      var s=j[u.slice(6)]||null,di=-1,ti=-1,ki=-1;
      if(g){
        var loc=UDG.b[s&&s[6]?s[6]:u.slice(0,6)];
        if(loc){di=loc[0];ti=loc[1];
          if(s&&s[5]){g[di].t[ti].k.forEach(function(k,x){if(k[2]===s[5])ki=x})}}
      }
      cb({s:s,di:di,ti:ti,ki:ki,g:g})
    }).catch(function(){cb({s:null,di:-1,ti:-1,ki:-1,g:g})})})}
/* S = {d,t,k: select घटक; fd(): जिल्हा बदलल्यावर तालुका यादी भरणारे फंक्शन; ft(): तालुका बदलल्यावर केंद्र यादी भरणारे फंक्शन} */
function udgApply(S,r){
  S.d.value=r.di<0?'':r.di;S.fd();
  S.t.value=r.ti<0?'':r.ti;S.ft();
  S.k.value=r.ki<0?'':r.ki}
/* संदेश (हिंट) */
var UDG_ST={C:'बंद',P:'कायमची बंद',M:'दुसऱ्या शाळेत विलीन',S:'मंजूर पण अजून सुरू नाही',D:'स्थितीची माहिती नाही'};
function udgMsg(r){
  var s=r.s,g=r.g;
  if(!s)return {ok:0,t:'या कोडची शाळा सापडली नाही. कोड तपासा.'};
  var dn=r.di>=0&&g?g[r.di].n:s[1],tn=r.di>=0&&r.ti>=0&&g?g[r.di].t[r.ti].n:'',
      kn=r.ki>=0?g[r.di].t[r.ti].k[r.ki][0]:'';
  var t='✓ '+s[0]+(s[7]?' ('+s[7]+')':'')+' — '+dn+(tn?' › '+tn:'')+(kn?' › '+kn:'');
  if(kn)t+=' — केंद्र बरोबर नसल्यास खाली बदला.';
  else if(r.ti>=0)t+=' — खाली केंद्र निवडा.';
  else t+=' — खाली जिल्हा, तालुका व केंद्र निवडा.';
  var w=UDG_ST[s[11]];if(w)t+=' ⚠ ही शाळा "'+w+'" नोंदलेली आहे; कोड बरोबर आहे का तपासा.';
  return {ok:1,warn:w?1:0,t:t}}
/* स्वतंत्र (नवीन) जिल्हा/तालुका/केंद्र निवड घटक – शिक्षक/शाळा नोंदणीसाठी. ids = {d,t,k} */
function udgSel(ids){
  var S={d:document.getElementById(ids.d),t:document.getElementById(ids.t),k:document.getElementById(ids.k)};
  S.fd=function(){var g=UDG.g,d=g&&g[S.d.value];S.t.innerHTML=udgOpts(d?d.t.map(function(x){return x.n}):[],'तालुका निवडा');S.k.innerHTML=udgOpts([],'केंद्र निवडा')};
  S.ft=function(){var g=UDG.g,d=g&&g[S.d.value],t=d&&d.t[S.t.value];S.k.innerHTML=udgOpts(t?t.k.map(function(x){return x[0]}):[],'केंद्र निवडा')};
  S.d.onchange=S.fd;S.t.onchange=S.ft;
  S.init=function(){udgGeo(function(g){if(!g)return;if(S.d.options.length<2)S.d.innerHTML=udgOpts(g.map(function(x){return x.n}),'जिल्हा निवडा');S.fd()})};
  /* निवडलेली मूल्ये (सबमिटसाठी) */
  S.val=function(){var g=UDG.g,d=g&&g[S.d.value],t=d&&d.t[S.t.value],k=t&&t.k[S.k.value];return {district:d?d.n:'',taluka:t?t.n:'',kendra:k?k[0]:'',kendraCode:k?k[2]:''}};
  return S}
/* इनपुट + हिंट + निवड जोडा. inp=UDISE इनपुट, hint=small घटक, S=udgSel/ student S, onFound(r) ऐच्छिक */
function udgBind(inp,hint,S,onFound){
  var u=inp.value.replace(/\D/g,'');
  if(u.length!==11){hint.textContent='';return}
  hint.style.color='#64748b';hint.textContent='शाळा शोधत आहे…';
  udgFind(u,function(r){
    if(inp.value.replace(/\D/g,'')!==u)return;
    if(!r){hint.style.color='#b91c1c';hint.textContent='UDISE कोड 27 ने सुरू होणारा ११ अंकी हवा.';return}
    var m=udgMsg(r);hint.style.color=!m.ok?'#b91c1c':m.warn?'#b45309':'#15803d';hint.textContent=m.t;
    if(r.g){if(S.init)S.init();udgApply(S,r)}
    if(onFound)onFound(r)})}
