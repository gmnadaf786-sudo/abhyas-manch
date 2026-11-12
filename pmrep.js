/* PM पोषण अहवाल (प्रिंट) — जुन्या ॲपमधून D1 साठी रुपांतरित */
(function(){
'use strict';
var PMD_RICE={g15:100,g68:150},PMD_PULSE={g15:0.02,g68:0.03},PMD_OIL={g15:0.005495,g68:0.008242};
var MONTH_NAMES=['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
var WEEK_NAMES=['रविवार','सोमवार','मंगळवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'];
window.PM_POSHAN_SPICES=[['हळद',0.0003,0.0005],['मीठ',0.003,0.005],['कांदा लसूण मसाला',0.0004,0.0006],['जिरे',0.0003,0.0005],['मोहरी',0.0003,0.0005],['मिरची पावडर',0.0004,0.0005],['गरम मसाला',0.0004,0.0006]];
var state={year:{},month:''},regGroup='15',ALLOWED=['15','68'];
function holidayOf(){return null}
  function esc(v){ return (typeof escapeHtml_==='function') ? escapeHtml_(v) : String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function isoOf(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function parseIso(s){ var p=String(s).split('-'); return new Date(Number(p[0]),Number(p[1])-1,Number(p[2]),12,0,0); }
  function monthOf(iso){ return String(iso).slice(0,7); }
  function dmy(iso){ var p=String(iso).split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
  function num(v){ var n=parseFloat(v); return isFinite(n)?n:0; }
  function fmt(v,d){ return (Math.round(v*Math.pow(10,d))/Math.pow(10,d)).toFixed(d); }
  function alertMsg(m,t){ if(typeof appAlert==='function') appAlert(m,t||'PM POSHAN'); else alert(m); }

  function usage(row, group){
    var n = group==='15' ? row.p15 : row.p68;
    var u = { rice:0, pulseName:'', pulse:0, spice:{}, oil:0 };
    if(!n || row.cooked==='नाही') return u;
    u.rice = n*(group==='15'?PMD_RICE.g15:PMD_RICE.g68)/1000;           /* कि.ग्रॅ. */
    u.pulseName = group==='15' ? row.pulse15 : row.pulse68;
    u.pulse = n*(group==='15'?PMD_PULSE.g15:PMD_PULSE.g68);
    (window.PM_POSHAN_SPICES||[]).forEach(function(x){ u.spice[x[0]] = n*(group==='15'?x[1]:x[2]); });
    u.oil = n*(group==='15'?PMD_OIL.g15:PMD_OIL.g68);
    return u;
  }

  /* ---------- टॅब्स (७) ---------- */

  var ITEM_NAMES=['तांदूळ','हिरवा वाटाणा','मुगडाळ','चवळी','हरभरा','सोयाबडी','मसूरडाळ','मटकी','मूग','तूरडाळ','हळद','मीठ','कांदा लसूण मसाला','जिरे','मोहरी','मिरची पावडर','गरम मसाला','तेल'];
  function unitOf(it){ return it==='तेल'?'लि.':'कि.'; }

  function fyOf(month){ var p=month.split('-'); return Number(p[1])>=4?Number(p[0]):Number(p[0])-1; }
  function fyMonths(fy){ var a=[],i; for(i=4;i<=12;i++) a.push(fy+'-'+pad(i)); for(i=1;i<=3;i++) a.push((fy+1)+'-'+pad(i)); return a; }
  function curMonth(){ var n=new Date(); return n.getFullYear()+'-'+pad(n.getMonth()+1); }

  function consumption(rows, group){
    var used={}; ITEM_NAMES.forEach(function(it){ used[it]=0; });
    rows.forEach(function(r){
      var u=usage(r,group); if(!u.rice&&!u.pulse) return;
      used['तांदूळ']+=u.rice;
      if(u.pulseName && used[u.pulseName]!==undefined) used[u.pulseName]+=u.pulse;
      Object.keys(u.spice).forEach(function(k){ if(used[k]!==undefined) used[k]+=u.spice[k]; });
      used['तेल']+=u.oil;
    });
    return used;
  }

  /* वर्षारंभापासून (एप्रिल) प्रत्येक महिन्याची शिल्लक साखळी. */
  function compute(fy, group){
    var Y=state.year[fy], out={}, prev=null;
    fyMonths(fy).forEach(function(m){
      var st=((Y.stockBy[m]||{})[group])||{}, used=consumption(Y.dailyBy[m]||[],group);
      var o={},ov={},r={},p={},c={},carry={};
      ITEM_NAMES.forEach(function(it){
        var e=st[it]||{};
        carry[it]=prev?prev[it]:0;
        ov[it]=(e.o!==undefined&&e.o!==null&&e.o!=='')?num(e.o):null;
        o[it]=ov[it]!==null?ov[it]:carry[it];
        r[it]=num(e.r); p[it]=num(e.p);
        c[it]=o[it]+r[it]+p[it]-(used[it]||0);
      });
      out[m]={o:o,ov:ov,carry:carry,r:r,p:p,used:used,c:c}; prev=c;
    });
    return out;
  }
  function dp(it){ return it==='तांदूळ'||it==='तेल'||ITEM_NAMES.indexOf(it)<10?3:4; }
  function f(v,it){ var x=Math.abs(v)<1e-9?0:v; return fmt(x,dp(it)); }

  function reportHeader(Y, extra){
    var s=Y.school||{};
    return '<div class="pmd-meta"><span>🏫 <b>'+esc(s.name||'')+'</b> (UDISE: '+esc(s.udise||'')+')</span><span>📍 केंद्र: <b>'+esc(s.kendra||'-')+'</b> | तालुका: <b>'+esc(s.taluka||'')+'</b> | जिल्हा: <b>'+esc(s.district||'')+'</b></span>'+(extra?'<span>'+extra+'</span>':'')+'</div>';
  }

  function printWindow(title, inner, landscape, fit, nosign){
    var w=window.open('','_blank');
    if(!w){ alertMsg('Print विंडो उघडता आली नाही. Pop-up परवानगी द्या.'); return; }
    w.document.write('<html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:8mm}body{font-family:Arial,sans-serif;color:#111;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      '.pmd-meta{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12px;margin:4px 0}h4{margin:6px 0;font-size:15px}table{border-collapse:collapse;width:100%;font-size:11px;text-align:center}th,td{border:1px solid #444;padding:4px}th{background:#eee}td.l{text-align:left}tr.tot td{font-weight:bold;background:#f5f5dc}'+
      '.sign{display:flex;justify-content:space-between;margin-top:'+(fit?'30':'46')+'px;font-size:12px}h4.frm{text-align:center;font-size:17px;border-bottom:2px solid #333;padding-bottom:4px}</style></head><body><div id="pmFit">'+inner+(nosign?'':'<div class="sign"><span>शिक्षक / स्वयंपाकी मदतनीस</span><span>मुख्याध्यापक</span></div>')+'</div></body></html>');
    w.document.close(); w.focus();
    setTimeout(function(){
      if(fit){ try{ var el=w.document.getElementById("pmFit"), lim=landscape?640:985, h=el.scrollHeight; if(h>lim) el.style.zoom=String(Math.floor(lim/h*100)/100); else { var rs=el.querySelectorAll('tbody tr').length||1, ex=(lim-h-24)/rs/2, pd=Math.min(16,4+ex); if(ex>0.5){ var st=w.document.createElement('style'); st.textContent='tbody td{padding-top:'+pd.toFixed(1)+'px;padding-bottom:'+pd.toFixed(1)+'px}'; w.document.head.appendChild(st); var h2=el.scrollHeight; if(h2>lim) el.style.zoom=String(Math.floor(lim/h2*100)/100); } } }catch(e){} }
      w.print();
    }, 400);
  }
  /* ---------- प्रपत्र ब — शासकीय नमुना (छापील नमुन्याप्रमाणे) ---------- */
  var GOVB_ITEMS=[['तांदूळ','तांदूळ'],['मूगडाळ','मुगडाळ'],['तूरडाळ','तूरडाळ'],['मसूरडाळ','मसूरडाळ'],['मटकी','मटकी'],['वाटाणा','हिरवा वाटाणा'],['हरभरा','हरभरा'],['मूग','मूग'],['चवळी','चवळी'],['मसाला','कांदा लसूण मसाला'],['मीठ','मीठ'],['हळद','हळद'],['जिरे','जिरे'],['मोहरी','मोहरी'],['सोयाबीन तेल','तेल'],['मिरची पावडर','मिरची पावडर'],['सोयावडी','सोयाबडी'],['गरम मसाला','गरम मसाला'],['पूरक आहार',null]];
  function govVals_(comp){
    var v={};
    ITEM_NAMES.forEach(function(it){
      var o=comp.o[it]||0, r=comp.r[it]||0, pu=comp.p[it]||0, u=comp.used[it]||0;
      v[it]={o:o,r:r,p:pu,used:u,total:o+r+pu,closing:o+r+pu-u};
    });
    return v;
  }
  function govB_(Y,month,g,D,v){
    var p=month.split('-'), s=Y.school||{}, rng=g==='15'?'इ. १ ते ५':'इ. ६ ते ८';
    var work=D.days.filter(function(x){ return !x.hol||x.n; }).length;
    var recv=PRT.recv||[], rice=[], grain=[];
    recv.forEach(function(r){
      var t=dmy(r.date)+(r.challan?' ('+r.challan+')':'');
      var hasRice=false, hasOther=false;
      (r.items||[]).forEach(function(x){ if(x.name==='तांदूळ') hasRice=true; else hasOther=true; });
      if(hasRice) rice.push(t); if(hasOther) grain.push(t);
    });
    var rows='', n=0, used={};
    function row(label,it){
      n++; var x=it&&v[it]; if(it) used[it]=1;
      var show=x&&(x.o||x.r||x.p||x.used||x.total);
      rows+='<tr><td>'+n+'</td><td class="l">'+esc(label)+'</td>'+
        (show?'<td>'+f(x.o,it)+'</td><td>'+((x.r+x.p)?f(x.r+x.p,it):'—')+'</td><td>'+f(x.total,it)+'</td><td>'+f(x.used,it)+'</td><td>'+f(x.closing,it)+'</td><td></td><td class="sh">'+(x.p?'लोकसहभाग '+f(x.p,it):'')+'</td>'
             :'<td></td><td></td><td></td><td></td><td></td><td></td><td></td>')+'</tr>';
    }
    GOVB_ITEMS.forEach(function(g2){ row(g2[0]+(g2[1]==='तेल'?' (लि.)':''),g2[1]); });
    ITEM_NAMES.forEach(function(it){ if(!used[it]&&v[it]&&(v[it].o||v[it].r||v[it].p||v[it].used)) row(it,it); });
    while(n<19){ n++; rows+='<tr><td>'+n+'</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'; }
    var th='<tr><th>अ.क्र.</th><th>वस्तूचे नाव</th><th>मागील शिल्लक वस्तू (किलोग्रॅम)</th><th>चालू महिन्यात प्राप्त वस्तू (किलोग्रॅम)</th><th>एकूण वस्तू (३+४) (किलोग्रॅम)</th><th>अन्न शिजवण्यासाठी वापरलेल्या वस्तू (किलोग्रॅम)</th><th>शिल्लक वस्तू (५-६) (किलोग्रॅम)</th><th>पुढील २ महिन्यांसाठी मागणी (किलोग्रॅम)</th><th>शेरा</th></tr>'+
      '<tr class="nm">'+['१','२','३','४','५','६','७','८','९'].map(function(c){ return '<td>'+c+'</td>'; }).join('')+'</tr>';
    var cg='<colgroup><col style="width:5%"><col style="width:17%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:13%"><col style="width:11%"><col style="width:11%"><col style="width:10%"></colgroup>';
    return '<style>.gv-h1{text-align:center;font-weight:700;font-size:17px;margin:2px 0}.gv-h2{text-align:center;font-weight:700;font-size:14px;margin:2px 0 8px}.gv-mon{text-align:center;font-weight:700;font-size:15px}'+
      '.gv-i{display:flex;justify-content:space-between;gap:12px;font-size:13px;margin:3px 0;font-weight:600}.gv-i span b{font-weight:700}'+
      'table.gv{font-size:11px}table.gv th{font-size:10.5px;font-weight:600}table.gv td.sh{font-size:9px}table.gv tr.nm td{background:#eee;font-size:10px;padding-top:1px;padding-bottom:1px}.gv-n{font-size:11.5px;margin:6px 0}.gv-f{font-size:12.5px;margin:5px 0}.gv-sg{display:flex;justify-content:space-between;margin-top:26px;font-size:13px;font-weight:600}.gv-ln{display:inline-block;min-width:110px;border-bottom:1px dotted #333}</style>'+
      '<div class="gv-mon">'+MONTH_NAMES[Number(p[1])-1]+' - '+p[0]+'</div>'+
      '<div class="gv-h1">प्रधानमंत्री पोषण शक्ती निर्माण योजना - प्रपत्र ब ('+rng+')</div>'+
      '<div class="gv-h2">शाळेने केंद्रप्रमुखांना दरमहा १ तारखेपर्यंत द्यायचा अहवाल (२ प्रतींत)</div>'+
      '<div class="gv-i"><span>शाळेचे नाव - <b>'+esc(s.name||'')+'</b></span><span>केंद्र: <b>'+esc(s.kendra||'-')+'</b></span><span>तालुका - <b>'+esc(s.taluka||'')+'</b></span><span>जिल्हा - <b>'+esc(s.district||'')+'</b></span></div>'+
      '<div class="gv-i"><span>पटसंख्या - '+rng+' - <b>'+(D.pat.v===''?'':D.pat.v)+'</b></span></div>'+
      '<div class="gv-i"><span>महिन्यातील एकूण उपस्थित विद्यार्थी - <b>'+D.tot.ben+'</b></span><span>एकूण कार्यदिवस - <b>'+work+'</b></span></div>'+
      '<div class="gv-i"><span>तांदूळ प्राप्त दिनांक व पावती क्रमांक - <b>'+(rice.length?esc(rice.join(', ')):'—')+'</b></span><span>अन्न शिजवून दिलेले दिवस - <b>'+D.tot.cooked+'</b></span></div>'+
      '<div class="gv-i"><span>धान्यादी वस्तू प्राप्त दिनांक व पावती क्रमांक - <b>'+(grain.length?esc(grain.join(', ')):'—')+'</b></span></div>'+
      '<table class="gv">'+cg+'<thead>'+th+'</thead><tbody>'+rows+'</tbody></table>'+
      '<div class="gv-n">मागणी नोंदवताना शाळेकडे वीस दिवसांचा साठा शिल्लक राहील याची दक्षता घेऊन मागणी नोंदवावी, आवश्यकतेपेक्षा जास्त साठा करून धान्य खराब होणार नाही याची दक्षता घ्यावी.</div>'+
      '<div class="gv-f">४) महिन्यातील एकूण ताटांची संख्या - <b>'+D.tot.ben+'</b></div>'+
      '<div class="gv-f">५) इंधन व भाजीपाल्यासाठी खर्च केलेले अनुदान रु. = <span class="gv-ln"></span> (ताटांची संख्या × दर) (शासनस्तरावरुन निश्चित केल्यानुसार)</div>'+
      '<div class="gv-f">६) स्वयंपाकी तथा मदतनीस मानधन रु. = <span class="gv-ln"></span> (रु. १५०० × नेमलेले स्वयंपाकी तथा मदतनीस संख्या)</div>'+
      '<div class="gv-f">प्रमाणित करण्यात येते की, वर नमूद केलेली माहिती दैनंदिन नोंदवहीवरून घेतलेली आहे. ती तपासली आहे व बरोबर आहे.</div>'+
      '<div class="gv-sg"><span>दिनांक - <span class="gv-ln"></span></span><span>मुख्याध्यापक</span><span>केंद्रप्रमुख<br>केंद्र - <span class="gv-ln" style="min-width:80px"></span></span></div>';
  }

  function t12(t){ var m=/^(\d{1,2}):(\d{2})/.exec(String(t||'')); if(!m) return t||'-'; var h=Number(m[1]), ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+m[2]+' '+ap; }
  function tasteTable(month, forPrint){
    var Y=state.year[fyOf(month)], rows=(Y.dailyBy[month]||[]).filter(function(r){ return r.cooked!=='नाही'; });
    if(!rows.length) return '';
    var b='';
    rows.forEach(function(r){
      b+='<tr><td>'+dmy(r.date)+'</td><td>'+WEEK_NAMES[parseIso(r.date).getDay()]+'</td><td class="l">'+esc(r.menu)+(r.supplement?'<br><small>पूरक: '+esc(r.supplement)+'</small>':'')+'</td><td>'+esc(t12(r.tasteTime))+'</td><td>'+esc(r.taster||'-')+'</td><td class="l">'+esc(r.remark||'-')+'</td><td>'+(r.sample==='होय'?'होय':'—')+'</td><td style="min-width:70px">&nbsp;</td></tr>';
    });
    return '<div class="pmd-wrap"><table class="pmd-table"><thead><tr><th>दिनांक</th><th>वार</th><th>आजचा मेनू</th><th>वेळ</th><th>तपासणाऱ्याचे नाव</th><th>अभिप्राय</th><th>नमुना जतन</th><th>स्वाक्षरी</th></tr></thead><tbody>'+b+'</tbody></table></div>';
  }

  var PRT={month:'',recv:[],part:1};
  var P2_ITEMS=['तांदूळ','मुगडाळ','तूरडाळ','मसूरडाळ','मटकी','मूग','चवळी','हरभरा','हिरवा वाटाणा','जिरे','मोहरी','हळद','कांदा लसूण मसाला','तेल','मीठ','मिरची पावडर'];
  function p2Label(it){ return it==='हिरवा वाटाणा'?'वाटाणा':it==='कांदा लसूण मसाला'?'मसाला':it==='तेल'?'सोयाबीन तेल':it; }
  function grpTitle(g){ return g==='15'?'इ. १ ली ते ५ वी':'इ. ६ वी ते ८ वी'; }

  function shareOf(month, g){
    var fy=fyOf(month), a=compute(fy,'15')[month], b=compute(fy,'68')[month], out={};
    ITEM_NAMES.forEach(function(it){
      var x=a.used[it]||0, y=b.used[it]||0, t=x+y;
      out[it]= ALLOWED.length===1 ? 1 : (t>0 ? (g==='15'?x:y)/t : 0.5);
    });
    return out;
  }
  function patOf(month, g){
    var fy=fyOf(month), Y=state.year[fy], own=((Y.stockBy[month]||{})[g]||{})._pat;
    if(own&&own.o!==undefined&&own.o!=='') return {v:Number(own.o),from:''};
    var ms=fyMonths(fy), i=ms.indexOf(month);
    for(i=i-1;i>=0;i--){ var e=((Y.stockBy[ms[i]]||{})[g]||{})._pat; if(e&&e.o!==undefined&&e.o!=='') return {v:Number(e.o),from:ms[i]}; }
    return {v:'',from:''};
  }

  /* महिन्याचा पूर्ण डेटा (दैनिक वापर, आवक, शिल्लक) */
  function partsData(month, g){
    var fy=fyOf(month), Y=state.year[fy], comp=compute(fy,g)[month], sh=shareOf(month,g), p=month.split('-');
    var dim=new Date(Number(p[0]),Number(p[1]),0).getDate(), rows=Y.dailyBy[month]||[];
    var extra=[]; ITEM_NAMES.forEach(function(it){ if(P2_ITEMS.indexOf(it)<0 && ((comp.used[it]||0)>0||comp.o[it]||comp.r[it]||comp.p[it])) extra.push(it); });
    var items=P2_ITEMS.concat(extra);
    var days=[], recvDay={}, recvDates={}, derived={}, hasReceipts=(PRT.recv||[]).length>0;
    items.forEach(function(it){ recvDay[it]={}; recvDates[it]=[]; derived[it]=0; });
    if(hasReceipts) PRT.recv.forEach(function(r){ r.items.forEach(function(x){
      if(items.indexOf(x.name)<0) return; var q=Number(x.qty||0)*sh[x.name];
      recvDay[x.name][r.date]=(recvDay[x.name][r.date]||0)+q; derived[x.name]+=q;
      var d=Number(r.date.slice(8)); if(recvDates[x.name].indexOf(d)<0) recvDates[x.name].push(d);
    }); });
    var first=month+'-01', mism=[];
    items.forEach(function(it){
      if(hasReceipts){ if(Math.abs(derived[it]-(comp.r[it]||0))>0.0015) mism.push(it); }
      else if(comp.r[it]>0){ recvDay[it][first]=comp.r[it]; derived[it]=comp.r[it]; recvDates[it]=[1]; }
      if(comp.p[it]>0) recvDay[it][first]=(recvDay[it][first]||0)+comp.p[it];
    });
    var pat=patOf(month,g), bal={}, tot={recv:{},used:{},ben:0,cooked:0};
    items.forEach(function(it){ bal[it]=comp.o[it]||0; tot.recv[it]=0; tot.used[it]=0; });
    for(var d=1;d<=dim;d++){
      var iso=month+'-'+pad(d), row=null, dt=parseIso(iso);
      for(var k=0;k<rows.length;k++) if(rows[k].date===iso){ row=rows[k]; break; }
      var n=row&&row.cooked==='होय'?(g==='15'?row.p15:row.p68):0, u=n?usage(row,g):null, used={}, rec={}, prev={};
      items.forEach(function(it){
        var us=0;
        if(u){ if(it==='तांदूळ') us=u.rice; else if(it==='तेल') us=u.oil; else if(u.pulseName===it) us=u.pulse; else if(u.spice[it]!==undefined) us=u.spice[it]; }
        used[it]=us; rec[it]=recvDay[it][iso]||0; prev[it]=bal[it];
        bal[it]=bal[it]+rec[it]-us; tot.recv[it]+=rec[it]; tot.used[it]+=us;
      });
      if(n){ tot.ben+=n; tot.cooked++; }
      var hol=(dt.getDay()===0)?'रविवार':(holidayOf(dt)?'सुट्टी':'');
      days.push({d:d,iso:iso,dt:dt,n:n,used:used,rec:rec,prev:prev,close:Object.assign({},bal),hol:hol,had:!!row});
    }
    return {items:items,comp:comp,days:days,tot:tot,pat:pat,recvDates:recvDates,mism:mism,hasReceipts:hasReceipts,dim:dim};
  }

  function headBlock(Y, month, g, part){
    var s=Y.school||{}, p=month.split('-');
    return '<div class="prt-h1">प्रधानमंत्री पोषण शक्ती निर्माण योजना ('+grpTitle(g)+')</div>'+
      '<div class="prt-h2">शाळा स्तरावर ठेवण्याची दैनंदिन खर्च नोंदवही '+(part===1?'भाग-१ (तांदळाचे हिशोब)':'भाग-२ (मान्यादी मालाचे हिशोब)')+'</div>'+
      '<div class="prt-meta"><span>शाळेचे नाव :- <b>'+esc(s.name||'')+'</b></span><span>केंद्र :- <b>'+esc(s.kendra||'')+'</b></span><span>महिना :- <b>'+MONTH_NAMES[Number(p[1])-1]+' '+p[0]+'</b></span><span>(किलोग्रॅममध्ये; तेल लिटरमध्ये)</span></div>';
  }
  function dd(x){ return pad(x.d)+'/'+x.iso.slice(5,7)+'/'+x.iso.slice(0,4); }

  function part1Html(Y, month, g, D){
    var th='<tr><th>अ.क्र.</th><th>दिनांक</th><th>पटसंख्या</th><th>मागील शिल्लक तांदूळ</th><th>चालू महिना प्राप्त तांदूळ</th><th>एकूण तांदूळ</th><th>लाभार्थी संख्या (ताटांची संख्या)</th><th>शिजवलेला तांदूळ</th><th>महिना अखेर शिल्लक तांदूळ</th><th>मुख्याध्यापक स्वाक्षरी</th></tr>';
    var nums='<tr class="nm">'+[1,2,3,4,5,6,7,8,9,10].map(function(i){ return '<td>'+i+'</td>'; }).join('')+'</tr>';
    var T='तांदूळ', body='';
    D.days.forEach(function(x){
      var tot=x.prev[T]+x.rec[T];
      body+='<tr><td>'+x.d+'</td><td>'+dd(x)+'</td><td>'+(x.n&&D.pat.v!==''?D.pat.v:'')+'</td><td>'+f(x.prev[T],T)+'</td><td>'+(x.rec[T]?f(x.rec[T],T):'')+'</td><td>'+f(tot,T)+'</td>'+
        '<td>'+(x.n?x.n:(x.hol?'<span class="hl">'+x.hol+'</span>':'—'))+'</td><td>'+(x.n?f(x.used[T],T):'')+'</td><td>'+f(x.close[T],T)+'</td><td></td></tr>';
    });
    body+='<tr class="tt"><td colspan="3">एकूण</td><td>'+f(D.comp.o[T],T)+'</td><td>'+f(D.tot.recv[T],T)+'</td><td></td><td>'+D.tot.ben+'</td><td>'+f(D.tot.used[T],T)+'</td><td>'+f(D.days.length?D.days[D.days.length-1].close[T]:0,T)+'</td><td></td></tr>';
    return headBlock(Y,month,g,1)+'<table class="prt p1"><thead>'+th+nums+'</thead><tbody>'+body+'</tbody></table>';
  }

  function part2Html(Y, month, g, D){
    var it=D.items.filter(function(n){ return n!=='तांदूळ'; }), spices=(window.PM_POSHAN_SPICES||[]), norm={};
    it.forEach(function(n){
      if(n==='तांदूळ') norm[n]=(g==='15'?PMD_RICE.g15:PMD_RICE.g68)/1000;
      else if(n==='तेल') norm[n]=g==='15'?PMD_OIL.g15:PMD_OIL.g68;
      else { var sp=null; spices.forEach(function(x){ if(x[0]===n) sp=x; }); norm[n]=sp?(g==='15'?sp[1]:sp[2]):(ITEM_NAMES.indexOf(n)>=0&&P2_ITEMS.indexOf(n)<10||['सोयाबडी'].indexOf(n)>=0?(g==='15'?PMD_PULSE.g15:PMD_PULSE.g68):0); }
    });
    var nc=it.length;
    var th='<tr><th>दिनांक</th><th>वार</th><th>पट</th><th>ताटे</th>'+it.map(function(n){ return '<th>'+esc(p2Label(n))+'</th>'; }).join('')+'<th>भाजीपाला (₹)</th><th>पूरक आहार (₹)</th><th>झालेला खर्च (₹)</th></tr>';
    var ncol=nc+3, w4=[5,3.6,3.6,3.6], rest=(100-w4[0]-w4[1]-w4[2]-w4[3])/ncol;
    var cg='<colgroup>'+w4.map(function(x){ return '<col style="width:'+x+'%">'; }).join('')+Array.apply(null,Array(ncol)).map(function(){ return '<col style="width:'+rest.toFixed(3)+'%">'; }).join('')+'</colgroup>';
    function lab(t){ return '<td colspan="4" class="lb">'+t+'</td>'; }
    var blank3='<td></td><td></td><td></td>';
    var r1='<tr class="hd">'+lab('मागील शिल्लक वस्तू')+it.map(function(n){ return '<td>'+f(D.comp.o[n],n)+'</td>'; }).join('')+blank3+'</tr>';
    var r2='<tr class="hd">'+lab('चालू प्राप्त वस्तू व दिनांक')+it.map(function(n){ return '<td>'+(D.tot.recv[n]-(D.comp.p[n]||0)>0.00001?f(D.tot.recv[n]-(D.comp.p[n]||0),n)+'<div class="dts">'+D.recvDates[n].sort(function(a,b){return a-b;}).join(', ')+'</div>':'')+'</td>'; }).join('')+blank3+'</tr>';
    var r3='<tr class="hd">'+lab('खुल्या बाजारातून खरेदी / लोकसहभागातून')+it.map(function(n){ return '<td>'+(D.comp.p[n]?f(D.comp.p[n],n):'')+'</td>'; }).join('')+blank3+'</tr>';
    var r4='<tr class="hd">'+lab('कमी केलेल्या वस्तू व दिनांक')+it.map(function(){ return '<td></td>'; }).join('')+blank3+'</tr>';
    var r5='<tr class="hd b">'+lab('एकूण')+it.map(function(n){ return '<td>'+f(D.comp.o[n]+D.tot.recv[n],n)+'</td>'; }).join('')+blank3+'</tr>';
    var r6='<tr class="nrm"><td colspan="4">प्रति विद्यार्थी प्रमाण</td>'+it.map(function(n){ return '<td>'+(norm[n]?String(Math.round(norm[n]*1000000)/1000000):'')+'</td>'; }).join('')+blank3+'</tr>';
    var body='';
    D.days.forEach(function(x){
      body+='<tr><td>'+dd(x).slice(0,5)+'</td><td>'+WEEK_NAMES[x.dt.getDay()].slice(0,3)+'</td><td>'+(x.n&&D.pat.v!==''?D.pat.v:'')+'</td><td>'+(x.n?x.n:(x.hol?'<span class="hl">'+(x.hol==='रविवार'?'रवि':'सु.')+'</span>':''))+'</td>'+
        it.map(function(n){ return '<td>'+(x.used[n]?f(x.used[n],n):'')+'</td>'; }).join('')+blank3+'</tr>';
    });
    var rt='<tr class="tt"><td colspan="3">एकूण खर्च</td><td>'+D.tot.ben+'</td>'+it.map(function(n){ return '<td>'+f(D.tot.used[n],n)+'</td>'; }).join('')+blank3+'</tr>';
    var rs='<tr class="tt"><td colspan="4">शिल्लक साठा</td>'+it.map(function(n){ return '<td>'+f(D.comp.o[n]+D.tot.recv[n]-D.tot.used[n],n)+'</td>'; }).join('')+blank3+'</tr>';
    return headBlock(Y,month,g,2)+'<table class="prt p2">'+cg+'<thead>'+th+'</thead><tbody>'+r1+r2+r3+r4+r5+r6+body+rt+rs+'</tbody></table>';
  }

  var PRT_CSS='<style>.prt-h1{text-align:center;font-weight:700;font-size:14px;margin:2px 0}.prt-h2{text-align:center;font-weight:700;font-size:13px;margin:2px 0 6px}.prt-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 14px;font-size:12px;margin:4px 0 6px}'+
    'table.prt{border-collapse:collapse;width:100%;text-align:center}table.prt th,table.prt td{border:1px solid #333;padding:3px 2px;vertical-align:middle}table.prt th{background:#eef2e6;font-weight:700}'+
    'table.prt.p1{font-size:10.5px}table.prt.p1 td,table.prt.p1 th{padding:3px 2px;line-height:1.2}table.prt.p1 td:nth-child(2),table.prt.p1 td:nth-child(1){white-space:nowrap}table.prt.p1 th{font-size:10px}table.prt.p2{font-size:8.5px;table-layout:fixed}table.prt.p2 td,table.prt.p2 th{padding:2px 1px}'+
    'tr.nm td{font-size:9px;background:#f4f4f4}tr.tt td{font-weight:700;background:#fef9c3}tr.hd td.lb{text-align:left;font-weight:700;padding-left:4px}tr.hd.b td{font-weight:700;background:#ecfdf5}tr.nrm td{color:#b91c1c;font-weight:700}.dts{font-size:7.5px;color:#475569}.hl{color:#9a3412;font-size:.85em}</style>';


  function fitSection_(el, lim){
    try{
      var h=el.scrollHeight;
      if(h>lim){ el.style.zoom=String(Math.floor(lim/h*100)/100); return; }
      var rs=el.querySelectorAll('tbody tr').length||1, ex=(lim-h-24)/rs/2, pd=Math.min(16,4+ex);
      if(ex>0.5){
        Array.prototype.forEach.call(el.querySelectorAll('tbody td'),function(td){ td.style.paddingTop=pd.toFixed(1)+'px'; td.style.paddingBottom=pd.toFixed(1)+'px'; });
        var h2=el.scrollHeight; if(h2>lim) el.style.zoom=String(Math.floor(lim/h2*100)/100);
      }
    }catch(e){}
  }
function build(raw,month){
  var fy=fyOf(month),Y={school:{name:raw.school||'',udise:raw.udise||'',kendra:raw.kendra||'',taluka:'जत',district:'सांगली'},teacher:raw.teacher||'',dailyBy:{},stockBy:{}};
  (raw.daily||[]).forEach(function(d){var o={date:d.date,menu:d.menu||'',p15:Number(d.p15)||0,p68:Number(d.p68)||0,pulse15:d.pulse15||'',pulse68:d.pulse68||'',cooked:d.cooked||'होय',supplement:d.supp||'',tasteTime:d.taste||'',distTime:d.dist||'',taster:d.taster||'',remark:d.remark||'',sample:d.sample||''};(Y.dailyBy[monthOf(d.date)]=Y.dailyBy[monthOf(d.date)]||[]).push(o)});
  (raw.stock||[]).forEach(function(x){var dd={};try{dd=JSON.parse(x.data)}catch(e){}(Y.stockBy[x.month]=Y.stockBy[x.month]||{})[x.grp]=dd});
  state.year={};state.year[fy]=Y;state.month=month;
  PRT.month=month;PRT.recv=(raw.rcpt||[]).filter(function(r){return r.date.slice(0,7)===month}).map(function(r){var it=[];try{it=JSON.parse(r.items)}catch(e){}return{date:r.date,challan:r.challan||'',items:it}});
  return Y;
}
function groupsOf(raw,g){return g==='15'||g==='68'?[g]:['15','68']}
window.PMREP={
  print:function(kind,month,g,raw){
    var Y=build(raw,month),fy=fyOf(month);regGroup=g==='68'?'68':'15';ALLOWED=['15','68'];
    var p=month.split('-'),mname=MONTH_NAMES[Number(p[1])-1]+' '+p[0];
    if(kind==='p1'||kind==='p2'){var D=partsData(month,regGroup);printWindow('PM Poshan नोंदवही भाग '+(kind==='p1'?1:2)+' — '+month+' — '+grpTitle(regGroup),PRT_CSS+(kind==='p1'?part1Html(Y,month,regGroup,D):part2Html(Y,month,regGroup,D)),kind==='p2',true);return}
    if(kind==='b'){var D2=partsData(month,regGroup);printWindow('प्रपत्र ब — '+month,govB_(Y,month,regGroup,D2,govVals_(D2.comp)),false,true,true);return}
    if(kind==='taste'){var t=tasteTable(month);if(!t){alert('या महिन्यात प्रिंट करण्यासाठी नोंदी नाहीत.');return}printWindow('चव नोंदवही',reportHeader(Y,'📅 <b>'+mname+'</b>')+'<h4>दैनिक भोजन चव नोंदवही</h4>'+t,true,true);return}
    if(kind==='annual'){
      var comp=compute(fy,regGroup),months=fyMonths(fy),s0=-1,body='',n=0;
      months.forEach(function(m,i){ITEM_NAMES.forEach(function(it){if(comp[m].ov[it]!==null&&s0<0)s0=i})});if(s0<0)s0=0;
      ITEM_NAMES.forEach(function(it){var st=comp[months[s0]].o[it],rec=0,pub=0,used=0;months.forEach(function(m,k){if(k<s0)return;rec+=comp[m].r[it];pub+=comp[m].p[it];used+=comp[m].used[it]||0});
        if(!(st||rec||pub||used))return;n++;var av=st+rec+pub,cl=comp[months[11]].c[it];
        body+='<tr><td>'+n+'</td><td class="l">'+esc(it)+' ('+unitOf(it)+')</td><td>'+f(st,it)+'</td><td>'+f(rec,it)+'</td><td>'+f(pub,it)+'</td><td>'+f(av,it)+'</td><td>'+f(used,it)+'</td><td>'+f(cl,it)+'</td></tr>'});
      if(!n){alert('प्रिंट करण्यासाठी या वर्षात नोंद नाही.');return}
      printWindow('वार्षिक उपयोगिता',reportHeader(Y,'📅 शैक्षणिक वर्ष: <b>'+fy+'-'+String(fy+1).slice(2)+'</b>')+'<h4>वार्षिक उपयोगिता प्रमाणपत्र — '+grpTitle(regGroup)+'</h4><table><thead><tr><th>क्र.</th><th>वस्तू</th><th>सुरुवातीची शिल्लक</th><th>प्राप्त</th><th>लोकसहभाग</th><th>एकूण उपलब्ध</th><th>वापर</th><th>अखेर शिल्लक</th></tr></thead><tbody>'+body+'</tbody></table>',false,true);return}
    if(kind==='all'){
      var w=window.open('','_blank');if(!w){alert('Pop-up परवानगी द्या.');return}
      var secs=[],taste=tasteTable(month);
      ALLOWED.forEach(function(gg){var D=partsData(month,gg);
        secs.push({land:false,html:PRT_CSS+part1Html(Y,month,gg,D)});secs.push({land:true,html:PRT_CSS+part2Html(Y,month,gg,D)});
        secs.push({land:false,nosign:true,html:govB_(Y,month,gg,D,govVals_(D.comp))});
        secs.push({land:false,html:reportHeader(Y,'📅 <b>'+mname+'</b>')+'<h4>दैनिक भोजन चव नोंदवही — '+grpTitle(gg)+'</h4>'+(taste||'<p>या महिन्यात नोंदी नाहीत.</p>')})});
      var css='@page{size:A4 portrait;margin:8mm}@page land{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#111;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pg{break-after:page;page-break-after:always}.pg:last-child{break-after:auto;page-break-after:auto}.pg.land{page:land}.pmd-meta{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12px;margin:4px 0}h4{margin:6px 0;font-size:15px}table{border-collapse:collapse;width:100%;font-size:11px;text-align:center}th,td{border:1px solid #444;padding:4px}th{background:#eee}td.l{text-align:left}tr.tot td{font-weight:bold;background:#f5f5dc}.sign{display:flex;justify-content:space-between;margin-top:30px;font-size:12px}h4.frm{text-align:center;font-size:17px;border-bottom:2px solid #333;padding-bottom:4px}';
      var sign='<div class="sign"><span>शिक्षक / स्वयंपाकी मदतनीस</span><span>मुख्याध्यापक</span></div>';
      w.document.open();w.document.write('<html><head><meta charset="utf-8"><title>PM Poshan — सर्व मासिक रिपोर्ट — '+esc(mname)+'</title><style>'+css+'</style></head><body>'+secs.map(function(x){return '<div class="pg'+(x.land?' land':'')+'"><div class="fit" data-l="'+(x.land?1:0)+'">'+x.html+(x.nosign?'':sign)+'</div></div>'}).join('')+'</body></html>');w.document.close();w.focus();
      setTimeout(function(){Array.prototype.forEach.call(w.document.querySelectorAll('.fit'),function(el){fitSection_(el,el.getAttribute('data-l')==='1'?640:985)});w.print()},600);
    }
  }
};
})();
