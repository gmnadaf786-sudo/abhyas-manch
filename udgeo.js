/* UDISE कोडवरून जिल्हा / तालुका / शाळा आपोआप भरणे व केंद्र ड्रॉपडाऊन.
   index.html (विद्यार्थी, शिक्षक, शाळा नोंदणी) व teacher.html (शिक्षक नोंदणी) वापरतात.
   डेटा: geo.json (जिल्हा › तालुका › केंद्र[नाव, कोड]) व data/udise/<६ अंक>.json.
   UDISE चे पहिले ६ अंक = केंद्र कोडचे पहिले ६ अंक (27 + जिल्हा + तालुका/ब्लॉक) → त्यावरून तालुका मिळतो.
   सर्व नावे udg ने सुरू होतात. */
var UDG={g:null,b:null,d:null,q:null};
function udgOpts(a,f){return '<option value="">'+f+'</option>'+a.map(function(x,i){return '<option value="'+i+'">'+x+'</option>'}).join('')}
function udgGeo(cb){
  if(UDG.g){cb(UDG.g);return}
  if(UDG.q){UDG.q.push(cb);return}
  UDG.q=[cb];
  fetch('geo.json').then(function(r){return r.json()}).then(function(g){
    var b={},d={};
    g.forEach(function(di,i){di.t.forEach(function(t,j){t.k.forEach(function(k){
      var c=String(k[1]),p6=c.slice(0,6),p4=c.slice(0,4),a=b[p6]||(b[p6]=[]);
      if(!a.some(function(x){return x[0]===i&&x[1]===j}))a.push([i,j]);
      if(d[p4]===undefined)d[p4]=i;else if(d[p4]!==i)d[p4]=-1})})});
    UDG.g=g;UDG.b=b;UDG.d=d;var q=UDG.q;UDG.q=null;q.forEach(function(f){f(g)})
  }).catch(function(){var q=UDG.q;UDG.q=null;q.forEach(function(f){f(null)})})}
/* कोड शोधा → cb(null) कोड चुकीचा; नाहीतर cb({s:[नाव,जिल्हा(En),पिन,खालचा,वरचा वर्ग]|null, di, ti, g}) ; di/ti = geo मधील index किंवा -1 */
function udgFind(u,cb){
  if(!/^27\d{9}$/.test(u)){cb(null);return}
  udgGeo(function(g){
    fetch('data/udise/'+u.slice(0,6)+'.json').then(function(r){return r.ok?r.json():{}}).then(function(j){
      var s=j[u.slice(6)]||null,c=g?(UDG.b[u.slice(0,6)]||[]):[],di=-1,ti=-1;
      if(g){
        if(c.length){
          var same=c.every(function(x){return x[0]===c[0][0]});
          if(same){di=c[0][0];if(c.length===1)ti=c[0][1]}
        }else{var d4=UDG.d[u.slice(0,4)];if(d4!==undefined&&d4>=0)di=d4}
      }
      cb({s:s,di:di,ti:ti,g:g})
    }).catch(function(){cb({s:null,di:-1,ti:-1,g:g})})})}
/* S = {d,t,k: select घटक; fd(): जिल्हा बदलल्यावर तालुका यादी भरणारे फंक्शन; ft(): तालुका बदलल्यावर केंद्र यादी भरणारे फंक्शन} */
function udgApply(S,r){
  S.d.value=r.di<0?'':r.di;S.fd();
  S.t.value=r.ti<0?'':r.ti;S.ft()}
/* संदेश (हिंट) */
function udgMsg(r){
  var s=r.s,g=r.g,dn=r.di>=0&&g?g[r.di].n:(s?s[1]:''),tn=r.di>=0&&r.ti>=0&&g?g[r.di].t[r.ti].n:'';
  if(!s)return {ok:0,t:'या कोडची शाळा सापडली नाही. कोड तपासा.'};
  var t='✓ '+s[0]+' — '+dn+(tn?' › '+tn:'');
  if(r.ti>=0)t+=' — खाली केंद्र निवडा.';
  else if(r.di>=0)t+=' — तालुका व केंद्र खाली निवडा.';
  else t+=' — जिल्हा, तालुका व केंद्र खाली निवडा.';
  return {ok:1,t:t}}
/* स्वतंत्र (नवीन) जिल्हा/तालुका/केंद्र निवड घटक – शिक्षक/शाळा नोंदणीसाठी. ids = {d,t,k} */
function udgSel(ids){
  var S={d:document.getElementById(ids.d),t:document.getElementById(ids.t),k:document.getElementById(ids.k)};
  S.fd=function(){var g=UDG.g,d=g&&g[S.d.value];S.t.innerHTML=udgOpts(d?d.t.map(function(x){return x.n}):[],'तालुका निवडा');S.k.innerHTML=udgOpts([],'केंद्र निवडा')};
  S.ft=function(){var g=UDG.g,d=g&&g[S.d.value],t=d&&d.t[S.t.value];S.k.innerHTML=udgOpts(t?t.k.map(function(x){return x[0]}):[],'केंद्र निवडा')};
  S.d.onchange=S.fd;S.t.onchange=S.ft;
  S.init=function(){udgGeo(function(g){if(!g)return;if(S.d.options.length<2)S.d.innerHTML=udgOpts(g.map(function(x){return x.n}),'जिल्हा निवडा');S.fd()})};
  /* निवडलेली मूल्ये (सबमिटसाठी) */
  S.val=function(){var g=UDG.g,d=g&&g[S.d.value],t=d&&d.t[S.t.value],k=t&&t.k[S.k.value];return {district:d?d.n:'',taluka:t?t.n:'',kendra:k?k[0]:'',kendraCode:k?k[1]:''}};
  return S}
/* इनपुट + हिंट + निवड जोडा. inp=UDISE इनपुट, hint=small घटक, S=udgSel/ student S, onFound(r) ऐच्छिक */
function udgBind(inp,hint,S,onFound){
  var u=inp.value.replace(/\D/g,'');
  if(u.length!==11){hint.textContent='';return}
  hint.style.color='#64748b';hint.textContent='शाळा शोधत आहे…';
  udgFind(u,function(r){
    if(inp.value.replace(/\D/g,'')!==u)return;
    if(!r){hint.style.color='#b91c1c';hint.textContent='UDISE कोड 27 ने सुरू होणारा ११ अंकी हवा.';return}
    var m=udgMsg(r);hint.style.color=m.ok?'#15803d':'#b91c1c';hint.textContent=m.t;
    if(r.g){if(S.init)S.init();udgApply(S,r)}
    if(onFound)onFound(r)})}
