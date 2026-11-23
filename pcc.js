/* पगार बिलावरून शिक्षकांची शाळा तपासणे (admin.html).
   पगार बिलाच्या Excel मधून शालार्थ ID, PAN व शाळेचा UDISE वाचतो (फाईल फक्त ब्राउझरमध्ये वाचली जाते; PAN सर्व्हरवर तुलनेसाठीच जातो, साठवला जात नाही).
   सर्व्हर /api/admin/panchk: PAN वरून (शिक्षक माहितीतील "PAN क्रमांक") शिक्षक शोधून त्याची शाळा तपासतो. जुळत नसलेल्यांची यादी दिसते;
   निवडलेल्यांची शाळा /api/admin/tmove ने बदलते (जुन्या शाळेचे वर्ग निघतात). सर्व नावे pcc ने सुरू होतात. वापरते: admin.html (post, E). */
var PCC={d:[],same:0,nu:0,multi:0,nfc:0,nf:[],tot:0};
function pccMsg(h){var e=document.getElementById('pcc');if(e)e.innerHTML=h}
function pccN(v){return String(v==null?'':v).trim()}
function pccRows(wb){
 var out=[],seen={},nou=0;
 wb.SheetNames.forEach(function(n){
  var A=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''}),hi=-1;
  for(var q=0;q<Math.min(A.length,25);q++){if(A[q].some(function(c){return pccN(c).toUpperCase()==='SHALARTH ID'})){hi=q;break}}
  if(hi<0)return;
  var H=A[hi].map(function(c){return pccN(c).toUpperCase()}),ci=function(t){return H.indexOf(t)},cs=ci('SHALARTH ID'),cn=ci('EMPLOYEE NAME'),cp=ci('PAN NO'),cu=ci('SCHOOL UDISE CODE');
  if(cs<0||(cp<0&&cu<0))return;
  for(var r=hi+1;r<A.length;r++){
   var x=A[r],sh=pccN(x[cs]).toUpperCase();if(!/^[A-Z0-9]{8,20}$/.test(sh))continue;
   var u=cu<0?'':pccN(x[cu]).replace(/\.0+$/,'').replace(/\D/g,''),pn=cp<0?'':pccN(x[cp]).toUpperCase().replace(/\s/g,'');
   if(seen[sh])continue;seen[sh]=1;
   if(u.length!==11){nou++;continue}
   out.push({sh:sh,pn:pn,u:u,nm:cn<0?'':pccN(x[cn])})}});
 out.nou=nou;return out}
function pccRun(){
 var f=document.getElementById('pcf').files[0];if(!f){pccMsg('<span style="color:#b91c1c">आधी पगार बिलाची Excel फाईल निवडा.</span>');return}
 pccMsg('⏳ फाईल वाचत आहे…');
 var go=function(){var rd=new FileReader();rd.onload=function(){
  var rows;try{rows=pccRows(XLSX.read(rd.result,{type:'array'}))}catch(e){pccMsg('<span style="color:#b91c1c">फाईल वाचता आली नाही.</span>');return}
  if(!rows.length){pccMsg('<span style="color:#b91c1c">शाळेचा UDISE असलेल्या ओळी सापडल्या नाहीत. फाईलमध्ये "SHALARTH ID", "PAN NO" व "SCHOOL UDISE CODE" स्तंभ आहेत का ते तपासा'+(rows.nou?' (UDISE नसलेल्या ओळी: '+rows.nou+')':'')+'.</span>');return}
  PCC={d:[],same:0,nu:rows.nou||0,multi:0,nfc:0,nf:[],tot:rows.length};
  var i=0,step=function(){
   if(i>=rows.length){pccShow();return}
   pccMsg('⏳ तपासत आहे… '+Math.min(i,rows.length)+' / '+rows.length);
   post('/api/admin/panchk',{rows:rows.slice(i,i+80)}).then(function(j){
    if(!j||!j.ok){pccMsg('<span style="color:#b91c1c">तपासणी झाली नाही'+(j&&j.e?' ('+E(j.e)+')':'')+'. पुन्हा प्रयत्न करा. (सर्व्हर नवीन आवृत्तीवर चढवला आहे का ते पाहा.)</span>');return}
    PCC.same+=j.same;PCC.nu+=j.nu;PCC.multi+=j.multi;PCC.nfc+=j.nfc;(j.nf||[]).forEach(function(q){if(PCC.nf.length<60)PCC.nf.push(q)});PCC.d=PCC.d.concat(j.diff||[]);
    i+=80;step()}).catch(function(){pccMsg('<span style="color:#b91c1c">इंटरनेट तपासा.</span>')})};
  step()};rd.readAsArrayBuffer(f)};
 if(window.XLSX)go();else{var sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';sc.onload=go;sc.onerror=function(){pccMsg('<span style="color:#b91c1c">Excel लायब्ररी लोड झाली नाही.</span>')};document.head.appendChild(sc)}}
function pccShow(){
 var D=PCC.d,h='<p><b>तपासलेले:</b> '+PCC.tot+' &nbsp; <span style="color:#15803d"><b>शाळा जुळते:</b> '+PCC.same+'</span> &nbsp; <span style="color:#b91c1c"><b>शाळा वेगळी:</b> '+D.length+'</span><br><small>ॲपमध्ये न सापडलेले शिक्षक: '+PCC.nfc+' · UDISE नसलेल्या ओळी: '+PCC.nu+(PCC.multi?' · एकच PAN अनेक शिक्षकांकडे: '+PCC.multi+' (वगळले)':'')+'</small></p>';
 if(!D.length){h+='<p style="color:#15803d">✔ सर्व सापडलेल्या शिक्षकांची शाळा पगार बिलाशी जुळते.</p>'}
 else{
  h+='<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="pcap" checked style="width:auto;margin:0"> बदलल्यानंतर शिक्षकाला लगेच मंजूर करा (अन्यथा नवीन शाळेत मंजुरीसाठी प्रलंबित राहील)</label>'
  +'<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px"><button onclick="pccAll(1)" style="flex:1">सर्व निवडा</button><button onclick="pccAll(0)" style="flex:1;background:#64748b">निवड काढा</button></div>'
  +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th></th><th style="text-align:left">शिक्षक</th><th style="text-align:left">ॲपमधील शाळा</th><th style="text-align:left">पगार बिलातील शाळा</th></tr>'
  +D.map(function(r,i){var can=!!r.tn,ck=can&&r.by==='PAN';return '<tr style="border-top:1px solid var(--l)"><td style="vertical-align:top"><input type="checkbox" class="pck" id="pck'+i+'" '+(ck?'checked ':'')+(can?'':'disabled ')+'style="width:auto;margin:4px"></td><td style="vertical-align:top"><b>'+E(r.n)+'</b><br><small>'+E(r.sh)+' · जुळवले: '+E(r.by)+(r.by!=='PAN'?' <span style="color:#b45309">(PAN जुळला नाही/नोंद नाही – तपासून निवडा)</span>':'')+(r.st!=='ok'?' · स्थिती: '+E(r.st):'')+'</small></td><td style="vertical-align:top">'+E(r.fn||r.fu)+'<br><small>'+E(r.fu)+'</small></td><td style="vertical-align:top">'+(can?E(r.tn):'<span style="color:#b91c1c">ॲपमध्ये ही शाळा नाही – आधी शाळा जोडा</span>')+'<br><small>'+E(r.tu)+'</small></td></tr>'}).join('')+'</table></div>'
  +'<button onclick="pccApply()" style="width:100%;margin-top:8px;background:#b91c1c">निवडलेल्यांची शाळा बदला</button><div id="pcm" style="margin-top:6px"></div>'}
 if(PCC.nf.length)h+='<details style="margin-top:8px"><summary>ॲपमध्ये न सापडलेले शिक्षक ('+PCC.nfc+')</summary><small>'+PCC.nf.map(E).join(', ')+(PCC.nfc>PCC.nf.length?' …':'')+'</small></details>';
 pccMsg(h)}
function pccAll(v){[].slice.call(document.querySelectorAll('.pck:not(:disabled)')).forEach(function(c){c.checked=!!v})}
function pccApply(){
 var sel=PCC.d.map(function(r,i){var c=document.getElementById('pck'+i);return c&&c.checked&&!c.disabled?r:null}).filter(Boolean),m=document.getElementById('pcm');
 if(!sel.length){m.textContent='कोणतेही शिक्षक निवडलेले नाहीत.';return}
 if(!confirm(sel.length+' शिक्षकांची शाळा पगार बिलातील शाळेनुसार बदलायची? जुन्या शाळेचे त्यांचे वर्ग निघतील.'))return;
 var ap=document.getElementById('pcap').checked?1:0,i=0,ok=0,bad=[];
 var step=function(){
  if(i>=sel.length){m.innerHTML='<b style="color:#15803d">✔ '+ok+' शिक्षकांची शाळा बदलली.</b>'+(bad.length?' <span style="color:#b91c1c">न बदललेले ('+bad.length+'): '+bad.map(E).join(', ')+'</span>':'');
   var left=PCC.d.filter(function(r){return !r._ok});PCC.d=left;return}
  var r=sel[i];m.textContent='⏳ '+(i+1)+' / '+sel.length;
  post('/api/admin/tmove',{id:r.id,udise:r.tu,approve:ap}).then(function(j){if(j&&j.ok){ok++;r._ok=1}else bad.push(r.n);i++;step()}).catch(function(){bad.push(r.n);i++;step()})};
 step()}
