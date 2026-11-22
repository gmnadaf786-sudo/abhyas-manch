/* शाळांचे स्थान (GPS) – office.html (KP / BEO / AEO) व school.html (मुख्याध्यापक).
   • GPS घेणे: geoNow(cb)  • KP/BEO: नकाशा व यादी gmGo(), शाळा भेट फॉर्ममधील स्थान gvzHtml()/gvzGet()/geoRep()
   • शाळा लॉगिन: gsUi()
   सर्व्हर: /api/o/geo, /api/o/geoset (office), /api/s/geo, /api/s/geoset (शाळा); भेटीचे स्थान visit data मध्ये d.geo, अंतर d.gd (मीटर).
   सर्व नावे geo/gm/gvz/gs ने सुरू होतात. */
var GM=null,GMMAP=null,GMV='M',GMF='',GMQ='',GMLD=null;
function geoNow(cb){
 if(!navigator.geolocation){cb({e:'या फोनमध्ये / ब्राउझरमध्ये स्थान सुविधा उपलब्ध नाही.'});return}
 navigator.geolocation.getCurrentPosition(function(p){cb({lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0),ts:new Date().toISOString()})},function(er){
  cb({e:er&&er.code===1?'स्थानाची परवानगी नाकारली आहे. ब्राउझरच्या सेटिंगमध्ये "स्थान (Location)" ला अनुमती द्या व पुन्हा प्रयत्न करा.':er&&er.code===3?'स्थान मिळण्यास वेळ लागला. GPS / Location चालू करून मोकळ्या जागेत पुन्हा प्रयत्न करा.':'स्थान मिळाले नाही. GPS / Location चालू आहे का तपासा.'})},{enableHighAccuracy:true,timeout:25000,maximumAge:0})}
function geoDm(m){return m<1000?m+' मी':(m/1000).toFixed(1)+' किमी'}
function geoLink(la,ln){return 'https://www.google.com/maps/search/?api=1&query='+la+','+ln}
function geoNav(la,ln){return 'https://www.google.com/maps/dir/?api=1&destination='+la+','+ln}
function geoHav(a,b){var R=6371000,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lng-a.lng)*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2);return Math.round(2*R*Math.asin(Math.sqrt(x)))}
function geoBy(b){return b==='S'?'मुख्याध्यापक':b==='KP'?'केंद्रप्रमुख':b?'BEO / AEO':''}
function geoDt(s){var m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:''}

/* ---------- KP / BEO : नकाशा व यादी ---------- */
function gmLoad(cb){if(GM){cb();return}if(GMLD){GMLD.push(cb);return}GMLD=[cb];api('/api/o/geo',{}).then(function(j){gmXl(j.ok?j.rows:[]).then(function(){var q=GMLD;GMLD=null;if(j.ok)GM=j;q.forEach(function(f){f()})})})}
/* GPS नोंद नसलेल्या शाळांसाठी सरकारी यादीतील (Excel) अंदाजे स्थान data/udise मधून घेणे: r.xl=[lat,lng]. KP चे GPS असेल तर तेच वापरले जाते. */
function gmXl(rows){var need=[];rows.forEach(function(r){var p=String(r.u).slice(0,6);if(r.lat==null&&need.indexOf(p)<0)need.push(p)});
 return Promise.all(need.map(function(p){return fetch('data/udise/'+p+'.json').then(function(x){return x.ok?x.json():{}}).catch(function(){return{}})})).then(function(a){var D={};need.forEach(function(p,i){D[p]=a[i]});
  rows.forEach(function(r){if(r.lat!=null)return;var d=D[String(r.u).slice(0,6)]||{},s=d[String(r.u).slice(6)];if(s&&s[9]!=null&&s[10]!=null)r.xl=[s[9],s[10]]})})}
function gmLL(r){return r.lat!=null?[r.lat,r.lng]:r.xl||null}
function gmRow(u){return((GM||{}).rows||[]).filter(function(r){return r.u===u})[0]}
function gmGo(){X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="m">⏳ लोड होत आहे…</p></div>';GM=null;gmLoad(function(){if(!GM){X.innerHTML=hdr()+rOffBack()+'<div class="card"><p class="er">लोड झाले नाही.</p></div>';return}gmDraw()})}
function gmCol(r){return r.lat==null?(r.xl?'#2563eb':'#64748b'):r.vm>0?'#15803d':r.vy>0?'#d97706':'#b91c1c'}
function gmRows(){return GM.rows.filter(function(r){return(!GMF||r.c===GMF)&&(!GMQ||r.n.toLowerCase().indexOf(GMQ.toLowerCase())>=0)})}
function gmDraw(msg){var kp=ROLE==='KP',R=gmRows(),has=R.filter(function(r){return r.lat!=null}),no=R.filter(function(r){return r.lat==null}),est=no.filter(function(r){return r.xl}),pts=R.filter(function(r){return gmLL(r)});
 var h=hdr()+rOffBack()+'<div class="card"><h2>🗺 शाळांचा नकाशा</h2>'+(msg?'<p class="m">'+msg+'</p>':'');
 if(!kp)h+='<select onchange="GMF=this.value;gmDraw()"><option value="">सर्व केंद्रे</option>'+Object.keys(CEN).filter(function(c){return GM.rows.some(function(r){return r.c===c})}).map(function(c){return '<option value="'+c+'"'+(c===GMF?' selected':'')+'>'+esc(CEN[c])+'</option>'}).join('')+'</select>';
 h+='<input id="gmq" placeholder="शाळेचे नाव शोधा" value="'+esc(GMQ)+'" oninput="GMQ=this.value;gmList()">'
  +'<div class="kp"><div><small>शाळा</small><b>'+R.length+'</b></div><div><small>GPS नोंद</small><b>'+has.length+'</b></div><div><small>GPS बाकी</small><b style="color:'+(no.length?'#b91c1c':'inherit')+'">'+no.length+'</b></div></div>'
  +'<div class="row"><button class="'+(GMV==='M'?'':'g')+'" onclick="GMV=\'M\';gmDraw()">🗺 नकाशा</button><button class="'+(GMV==='L'?'':'g')+'" onclick="GMV=\'L\';gmDraw()">📋 यादी</button></div>'
  +'<p class="m" style="margin:4px 0 0"><span style="color:#15803d">●</span> या महिन्यात भेट झाली &nbsp;<span style="color:#d97706">●</span> या वर्षी भेट झाली, या महिन्यात बाकी &nbsp;<span style="color:#b91c1c">●</span> एकदाही भेट नाही &nbsp;<span style="color:#2563eb">●</span> अंदाजे स्थान (सरकारी यादी) &nbsp;<span style="color:#64748b">●</span> स्थान नाही</p>'+(est.length?'<p class="m" style="margin:4px 0 0;font-size:13px">'+est.length+' शाळांचे अंदाजे स्थान सरकारी यादीतून घेतले आहे (निळा ठिपका). अचूक स्थानासाठी शाळेत जाऊन "📍 आत्ता इथे नोंदवा" दाबा; ते नोंदवल्यावर तेच वापरले जाईल.</p>':'')+'</div>';
 h+=(GMV==='M'?'<div class="card" style="padding:6px"><div id="gmm" style="height:min(60vh,460px);border-radius:10px"></div><p class="m" id="gmmm" style="margin:6px 4px 0"></p></div>':'')+'<div id="gml"></div>';
 X.innerHTML=h;gmList();if(GMV==='M')gmMap(pts)}
function gmList(){var e=document.getElementById('gml');if(!e)return;var R=gmRows();if(GMV==='M'&&GMQ===''){R=R.filter(function(r){return r.lat==null})}
 var t=GMV==='M'?'📍 स्थान बाकी असलेल्या शाळा':'📋 शाळा यादी';
 if(!R.length){e.innerHTML=GMV==='M'?'<div class="card"><p class="ok">✔ सर्व शाळांचे स्थान नोंदवलेले आहे.</p></div>':'<div class="card"><p class="m">शाळा नाहीत.</p></div>';return}
 e.innerHTML='<div class="card"><h2>'+t+'</h2><div class="w"><table><tr><th>शाळा</th><th>शेवटची भेट</th><th>स्थान</th></tr>'+R.map(function(r){return '<tr><td><span style="color:'+gmCol(r)+'">●</span> '+esc(r.n)+(ROLE!=='KP'?'<br><small>'+esc(CEN[r.c]||r.c)+'</small>':'')+'</td><td>'+(r.lv?geoDt(r.lv):'<span class="no">—</span>')+'<br><small>वर्षात '+r.vy+' · महिन्यात '+r.vm+'</small></td><td>'+(r.lat!=null?'<a href="'+geoLink(r.lat,r.lng)+'" target="_blank" rel="noopener">नकाशा</a> · <a href="'+geoNav(r.lat,r.lng)+'" target="_blank" rel="noopener">मार्ग</a><br><small>'+esc(geoBy(r.by))+' · '+geoDt(r.up)+'</small>':r.xl?'<a href="'+geoLink(r.xl[0],r.xl[1])+'" target="_blank" rel="noopener">नकाशा</a> · <a href="'+geoNav(r.xl[0],r.xl[1])+'" target="_blank" rel="noopener">मार्ग</a><br><small style="color:#2563eb">अंदाजे (सरकारी यादी)</small>':'<span class="no">नोंद नाही</span>')+'<br><button class="g" style="width:auto;margin:4px 0 0;padding:4px 10px;font-size:13px" onclick="gmHere(\''+r.u+'\')">📍 '+(r.lat!=null?'पुन्हा नोंदवा':'आत्ता इथे नोंदवा')+'</button></td></tr>'}).join('')+'</table></div></div>'}
function gmHere(u){var r=gmRow(u);if(!r)return;if(!confirm('तुम्ही सध्या "'+r.n+'" या शाळेत उभे आहात का? सध्याचे GPS स्थान या शाळेचे स्थान म्हणून जतन होईल.'))return;gmDraw('⏳ स्थान घेत आहे… (काही सेकंद लागतील)');
 geoNow(function(g){if(g.e){gmDraw('<span class="er">'+esc(g.e)+'</span>');return}if(g.acc>150&&!confirm('GPS अचूकता कमी आहे (± '+g.acc+' मी). तरीही जतन करायचे?')){gmDraw();return}
  api('/api/o/geoset',{udise:u,lat:g.lat,lng:g.lng,acc:g.acc}).then(function(j){if(!j.ok){gmDraw('<span class="er">जतन झाले नाही.</span>');return}r.lat=g.lat;r.lng=g.lng;r.acc=g.acc;r.by=ROLE==='KP'?'KP':'B';r.up=new Date().toISOString();gmDraw('<span class="ok">✔ '+esc(r.n)+' चे स्थान जतन झाले (± '+g.acc+' मी).</span>')})})}
function gmLeaf(cb){if(window.L&&L.map){cb();return}var c=document.createElement('link');c.rel='stylesheet';c.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(c);var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';s.onload=cb;s.onerror=function(){cb(1)};document.head.appendChild(s)}
function gmMap(has){var m=document.getElementById('gmmm');if(!has.length){document.getElementById('gmm').innerHTML='<p class="m" style="padding:14px">या शाळांचे कोणतेही स्थान उपलब्ध नाही. खालील यादीतून "📍 आत्ता इथे नोंदवा" किंवा शाळा भेट फॉर्ममधून स्थान घ्या.</p>';return}
 m.textContent='⏳ नकाशा लोड होत आहे… (इंटरनेट आवश्यक)';gmLeaf(function(er){var el=document.getElementById('gmm');if(!el)return;if(er||!window.L){m.innerHTML='<span class="er">नकाशा लोड झाला नाही (इंटरनेट तपासा). यादी वापरा:</span> '+has.map(function(r){var q=gmLL(r);return '<a href="'+geoLink(q[0],q[1])+'" target="_blank" rel="noopener">'+esc(r.n)+'</a>'}).join(' · ');return}
  m.textContent='पिन दाबल्यावर शाळेची माहिती व मार्ग दिसेल.';if(GMMAP){try{GMMAP.remove()}catch(e){}GMMAP=null}
  GMMAP=L.map(el,{zoomControl:true});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(GMMAP);var b=[];
  has.forEach(function(r){var q=gmLL(r),ex=r.lat!=null,mk=L.circleMarker(q,{radius:ex?9:7,color:'#fff',weight:2,fillColor:gmCol(r),fillOpacity:ex?.95:.7}).addTo(GMMAP);b.push(q);
   mk.bindPopup('<b>'+esc(r.n)+'</b><br>शेवटची भेट: '+(r.lv?geoDt(r.lv):'—')+'<br>वर्षात '+r.vy+' भेटी'+(ex?'':'<br><span style="color:#2563eb">अंदाजे स्थान (सरकारी यादी)</span>')+'<br><a href="'+geoNav(q[0],q[1])+'" target="_blank" rel="noopener">➡ मार्ग दाखवा (Google Maps)</a>')});
  if(b.length===1)GMMAP.setView(b[0],15);else GMMAP.fitBounds(b,{padding:[24,24]});setTimeout(function(){GMMAP&&GMMAP.invalidateSize()},200)})}

/* ---------- शाळा भेट फॉर्ममधील स्थान (visit.js वापरते) ---------- */
var GVZB=0;
function gvzHtml(){return '<div class="card" id="gvz">'+gvzIn()+'</div>'}
function gvzIn(){var g=VZ&&VZ.d&&VZ.d.geo,r=GM&&VZ?gmRow(VZ.u):null,h='<h2>📍 भेटीचे स्थान</h2>';
 if(!GM&&!GVZB){GVZB=1;gmLoad(function(){GVZB=0;gvzDraw()})}
 if(g){var d=r&&r.lat!=null?geoHav(r,g):null;h+='<p class="ok" style="margin:0 0 6px">✔ स्थान नोंदवले ('+(g.ts?esc(geoDt(g.ts)):'')+', ± '+g.acc+' मी)'+(d!==null?'<br>शाळेच्या नोंदवलेल्या स्थानापासून अंतर: <b style="color:'+(d>500?'#b91c1c':'#15803d')+'">'+geoDm(d)+'</b>'+(d>500?' ⚠ शाळेपासून दूर':''):'')+'</p>'+(r&&r.lat==null?'<p class="m" style="margin:0 0 6px">या शाळेचे स्थान अजून नोंदवलेले नाही — खालील बटणाने शाळेचे स्थान म्हणूनही जतन करता येईल.</p>':'')}
 else h+='<p class="m" style="margin:0 0 6px">तुम्ही शाळेत असताना बटण दाबा. भेट शाळेतच झाल्याची नोंद राहील'+(r&&r.lat==null?' व शाळेचे स्थान पहिल्यांदा नोंदले जाईल':'')+'. (GPS / Location चालू ठेवा.)</p>';
 h+='<div id="gvze" class="m"></div><button type="button" class="g" onclick="gvzGet()">📍 '+(g?'स्थान पुन्हा घ्या':'आत्ता स्थान नोंदवा')+'</button>';
 if(g&&r&&r.lat==null)h+='<button type="button" class="g" onclick="gvzSetSch()">🏫 हे या शाळेचे स्थान म्हणून जतन करा</button>';return h}
function gvzDraw(){var e=document.getElementById('gvz');if(e)e.innerHTML=gvzIn()}
function gvzGet(){var e=document.getElementById('gvze');if(e)e.textContent='⏳ स्थान घेत आहे… (काही सेकंद)';geoNow(function(g){if(g.e){if(e)e.innerHTML='<span class="er">'+esc(g.e)+'</span>';return}
 VZ.d.geo={lat:Math.round(g.lat*1e6)/1e6,lng:Math.round(g.lng*1e6)/1e6,acc:g.acc,ts:g.ts};vzLoc();var r=gmRow(VZ.u);
 if(r&&r.lat==null&&g.acc<=150){api('/api/o/geoset',{udise:VZ.u,lat:g.lat,lng:g.lng,acc:g.acc}).then(function(j){if(j.ok){r.lat=g.lat;r.lng=g.lng;r.acc=g.acc;r.by=ROLE==='KP'?'KP':'B';r.up=g.ts}gvzDraw();var e2=document.getElementById('gvze');if(e2&&j.ok)e2.innerHTML='<span class="ok">✔ पहिली भेट — शाळेचे स्थानही जतन झाले.</span>'});return}
 gvzDraw()})}
function gvzSetSch(){var g=VZ.d.geo;if(!g||!confirm('हे स्थान या शाळेचे स्थान म्हणून जतन करायचे?'))return;api('/api/o/geoset',{udise:VZ.u,lat:g.lat,lng:g.lng,acc:g.acc}).then(function(j){if(j.ok){var r=gmRow(VZ.u);if(r){r.lat=g.lat;r.lng=g.lng;r.acc=g.acc;r.by=ROLE==='KP'?'KP':'B';r.up=g.ts}}gvzDraw()})}
function geoRep(d){var g=d&&d.geo;if(!g)return '<tr><td><b>स्थान</b></td><td colspan="3"><span style="color:#64748b">नोंद नाही</span></td></tr>';var x=d.gd;return '<tr><td><b>स्थान</b></td><td colspan="3">✔ नोंदवले · <a href="'+geoLink(g.lat,g.lng)+'" target="_blank" rel="noopener">नकाशावर पाहा</a>'+(typeof x==='number'?' · शाळेपासून अंतर: <b'+(x>500?' style="color:#b91c1c"':'')+'>'+geoDm(x)+'</b>'+(x>500?' ⚠':''):'')+'</td></tr>'}

/* ---------- शाळा लॉगिन (मुख्याध्यापक) ---------- */
function gsUi(msg){X.innerHTML='<p class="m">लोड होत आहे…</p>';api('/api/s/geo',{}).then(function(j){if(!j.ok){X.innerHTML='<div class="card"><p class="er">लोड झाले नाही.</p></div>';return}gsDraw(j.g,msg)})}
function gsDraw(g,msg){X.innerHTML='<button class="g" onclick="home()">← मागे</button><div class="card"><h2>📍 शाळेचे स्थान</h2><p class="m">शाळेच्या आवारात उभे राहून बटण दाबा. हे स्थान केंद्रप्रमुख व शिक्षण विभागाला नकाशावर दिसेल, यामुळे शाळा शोधणे व भेट नियोजन सोपे होते.</p>'
 +(g?'<p class="ok">✔ स्थान नोंदवलेले आहे ('+esc(geoBy(g.by))+(g.up?', '+geoDt(g.up):'')+', ± '+g.acc+' मी)<br><a href="'+geoLink(g.lat,g.lng)+'" target="_blank" rel="noopener">नकाशावर पाहा</a></p>':'<p class="er">अजून स्थान नोंदवलेले नाही.</p>')
 +'<div id="gse" class="m">'+(msg||'')+'</div><button onclick="gsSave()">📍 '+(g?'स्थान पुन्हा नोंदवा':'आत्ता स्थान नोंदवा')+'</button><p class="m">⚠ कृपया शाळेत असतानाच नोंदवा. GPS / Location चालू ठेवा व ब्राउझरला परवानगी द्या.</p></div>'}
function gsSave(){var e=document.getElementById('gse');e.textContent='⏳ स्थान घेत आहे… (काही सेकंद)';geoNow(function(g){if(g.e){e.innerHTML='<span class="er">'+esc(g.e)+'</span>';return}if(g.acc>150&&!confirm('GPS अचूकता कमी आहे (± '+g.acc+' मी). तरीही जतन करायचे?'))return gsUi();
 if(!confirm('तुम्ही सध्या शाळेत आहात का? हे स्थान शाळेचे स्थान म्हणून जतन होईल.'))return gsUi();api('/api/s/geoset',{lat:g.lat,lng:g.lng,acc:g.acc}).then(function(j){if(j.ok)gsDraw(j.g,'<span class="ok">✔ जतन झाले.</span>');else e.innerHTML='<span class="er">जतन झाले नाही.</span>'})})}
