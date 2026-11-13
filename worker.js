// Abhyas Manch API (Cloudflare Worker + D1). Static files are served via ASSETS.
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
async function hashPin(pin,salt){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:60000},k,256));
}
const cl=(s,n)=>String(s==null?'':s).trim().slice(0,n);
const okMob=m=>/^[6-9]\d{9}$/.test(m);
const okPin=p=>/^\d{4,6}$/.test(p);
async function body(r){try{return await r.json()}catch(e){return {}}}
async function me(env,r){
  const t=(r.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!t)return null;
  return await env.DB.prepare('SELECT id,mobile,name,cls,med,district,taluka,kendra,school,school_udise FROM students WHERE token=?').bind(t).first();
}
// ---- Roster (PEN) students + teacher portal ----
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function adminKey(env,b){
  const a=await env.DB.prepare("SELECT * FROM settings WHERE k='admin'").first().catch(()=>null);
  if(!a)return J({e:'noadmin'},503);
  const [salt,hh,fails,last]=a.v.split('|');
  if(+fails>=10&&Date.now()-(+last)<900000)return J({e:'locked'},429);
  if(await hashPin(String(b.key||''),salt)!==hh){await env.DB.prepare("UPDATE settings SET v=? WHERE k='admin'").bind([salt,hh,(+fails)+1,Date.now()].join('|')).run();return J({e:'bad'},401);}
  if(+fails)await env.DB.prepare("UPDATE settings SET v=? WHERE k='admin'").bind([salt,hh,0,0].join('|')).run();
  return null;
}
async function pwOk(pw,salt,stored){return stored&&stored.startsWith('p:')?(await hashPin(pw,salt))===stored.slice(2):(await sha(salt+pw))===stored}
async function teacher(env,b,needOk){
  const t=cl(b.token,64);if(!t)return null;
  const x=await env.DB.prepare('SELECT * FROM teachers WHERE token=?').bind(t).first();
  if(!x||(needOk&&x.status!=='ok'))return null;return x;
}
async function ensS(env){}
const okDob=s=>/^(19|20)\d\d-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s))?s:'';
async function imp(env,rw,tid){
    const rows=(Array.isArray(rw)?rw:[]).slice(0,150);let n=0;const st=[];
    for(const x of rows){
      if(tid&&!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(tid,cl(x.udise,11),parseInt(x.cls)||0,(cl(x.div,2).toUpperCase())||'A').first())continue;
      const pen=cl(x.pen,11).replace(/\D/g,''),ud=cl(x.udise,11).replace(/\D/g,''),cls=parseInt(x.cls)||0,by=cl(x.by,4).replace(/\D/g,''),name=cl(x.name,60);
      if(pen.length!==11||ud.length!==11||cls<1||cls>8||by.length!==4||name.length<2)continue;
      const salt=rnd(6),h=await sha(salt+by),med=x.med==='kn'?'kn':'mr',dv=(cl(x.div,2).toUpperCase())||'A';
      st.push(env.DB.prepare("INSERT INTO roster(pen,udise,cls,div,name,med,salt,pw,pw0,salt0) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET udise=excluded.udise,cls=excluded.cls,div=excluded.div,name=excluded.name,med=excluded.med").bind(pen,ud,cls,dv,name,med,salt,h,h,salt));n++;
    }
    const dq=[],CT=['GEN','SC','ST','VJA','NTB','NTC','NTD','OBC','SBC'];
    for(const x of rows){const pn=cl(x.pen,11).replace(/\D/g,'');if(pn.length!==11)continue;const dd=okDob(cl(x.dob,10)),g=['M','F','O'].includes(x.gender)?x.gender:'',ct=CT.includes(x.cat)?x.cat:'',gr=cl(x.gr,15),ro=cl(x.roll,6);if(dd||g||ct||gr||ro)dq.push([pn,dd,g,ct,gr,ro])}
    if(st.length)await env.DB.batch(st);
    if(dq.length){await env.DB.batch(dq.map(a=>env.DB.prepare("INSERT INTO sinfo(pen,dob,gender,cat,gr,roll) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM roster WHERE pen=?) ON CONFLICT(pen) DO UPDATE SET dob=CASE WHEN excluded.dob<>'' THEN excluded.dob ELSE sinfo.dob END,gender=CASE WHEN COALESCE(sinfo.gender,'')='' THEN excluded.gender ELSE sinfo.gender END,cat=CASE WHEN COALESCE(sinfo.cat,'')='' THEN excluded.cat ELSE sinfo.cat END,gr=CASE WHEN COALESCE(sinfo.gr,'')='' THEN excluded.gr ELSE sinfo.gr END,roll=CASE WHEN COALESCE(sinfo.roll,'')='' THEN excluded.roll ELSE sinfo.roll END").bind(a[0],a[1],a[2],a[3],a[4],a[5],a[0])))}
    return J({ok:1,n,skipped:rows.length-n});
}

// ---- PM POSHAN (school-level; any confirmed teacher of the school) ----
let PMOK=false;
async function pmEnsure(env){
  if(PMOK)return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_daily(udise TEXT, date TEXT, menu TEXT, p15 INTEGER, p68 INTEGER, pulse15 TEXT, pulse68 TEXT, cooked TEXT, supp TEXT, taste TEXT, dist TEXT, taster TEXT, remark TEXT, sample TEXT, by TEXT, upd TEXT, PRIMARY KEY(udise,date))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_stock(udise TEXT, month TEXT, grp TEXT, data TEXT, by TEXT, upd TEXT, PRIMARY KEY(udise,month,grp))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_bmi(udise TEXT, pen TEXT, h REAL, w REAL, upd TEXT, PRIMARY KEY(udise,pen))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_rcpt(udise TEXT, id TEXT, date TEXT, supplier TEXT, challan TEXT, items TEXT, remark TEXT, by TEXT, upd TEXT, PRIMARY KEY(udise,id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS hol(id TEXT PRIMARY KEY, d1 TEXT, d2 TEXT, name TEXT, type TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_rate(d TEXT PRIMARY KEY, r15 REAL, r68 REAL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_cook(udise TEXT, id TEXT, name TEXT, role TEXT, gender TEXT, bank TEXT, ifsc TEXT, acct TEXT, aadhaar TEXT, addr TEXT, pin TEXT, upd TEXT, sname TEXT, PRIMARY KEY(udise,id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS school_bank(udise TEXT PRIMARY KEY, tan TEXT, acct TEXT)")]);
  try{await env.DB.prepare('ALTER TABLE pm_cook ADD COLUMN sname TEXT').run()}catch(e){}
  const rc0=await env.DB.prepare('SELECT COUNT(*) c FROM pm_rate').first();
  if(!rc0||!rc0.c)await env.DB.prepare("INSERT OR IGNORE INTO pm_rate(d,r15,r68) VALUES('2026-04-01',2.59,3.88)").run();
  const hc=await env.DB.prepare('SELECT COUNT(*) c FROM hol').first();
  if(!hc||!hc.c){
    const H=[[1,14,0,'मकर संक्रांत','general'],[1,26,0,'प्रजासत्ताक दिन','general'],[2,19,0,'छत्रपती शिवाजी महाराज जयंती','general'],[3,3,0,'होळी (दुसरा दिवस)','general'],[3,19,0,'गुढी पाडवा','general'],[3,21,0,'रमजान ईद (ईद-उल-फितर)','general'],[3,26,0,'रामनवमी','general'],[3,31,0,'महावीर जन्म कल्याणक','general'],[4,3,0,'गुड फ्रायडे','general'],[4,14,0,'डॉ. बाबासाहेब आंबेडकर जयंती','general'],[5,1,0,'महाराष्ट्र दिन, बुद्ध पौर्णिमा','general'],[5,2,14,'उन्हाळी सुट्टी','vacation'],[6,26,0,'मोहरम','general'],[6,29,0,'वट पौर्णिमा','general'],[7,27,0,'महाराष्ट्र बेंदूर','general'],[8,15,0,'स्वातंत्र्य दिन, पारशी नूतन वर्ष दिन','general'],[8,17,0,'नाग पंचमी','general'],[8,26,0,'ईद-ए-मिलाद','general'],[9,14,0,'गणेश चतुर्थी','general'],[9,18,0,'गौरी पूजन','general'],[9,25,0,'अनंत चतुर्दशी','local'],[10,2,0,'महात्मा गांधी जयंती','general'],[10,20,0,'दसरा','general'],[11,5,18,'दिवाळी सुट्टी','vacation'],[11,24,0,'गुरुनानक जयंती','general'],[12,25,0,'ख्रिसमस','general'],[8,28,0,'रक्षाबंधन','local']];
    const P=n=>String(n).padStart(2,'0');
    await env.DB.batch(H.map(h=>{const d1='2026-'+P(h[0])+'-'+P(h[1]),d2=h[2]?'2026-'+P(h[0])+'-'+P(h[2]):'';return env.DB.prepare('INSERT OR IGNORE INTO hol(id,d1,d2,name,type) VALUES(?,?,?,?,?)').bind('g'+d1,d1,d2,h[3],h[4])}));
  }
  PMOK=true;
}
const PM_ITEMS=['तांदूळ','हिरवा वाटाणा','मुगडाळ','चवळी','हरभरा','सोयाबडी','मसूरडाळ','मटकी','मूग','तूरडाळ','हळद','मीठ','कांदा लसूण मसाला','जिरे','मोहरी','मिरची पावडर','गरम मसाला','तेल'];
const istDay=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const dOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s));
async function pmApi(p,r,env){
  if(!p.startsWith('/api/pm/'))return null;
  const b=await body(r),t=await teacher(env,b,true);
  if(!t||!t.conf)return J({e:'auth'},401);
  await pmEnsure(env);
  const u=t.udise,by=t.shalarth;
  if(p==='/api/pm/students'){
    const rows=(await env.DB.prepare('SELECT r.pen,r.cls,r.div,r.name,m.h,m.w FROM roster r LEFT JOIN pm_bmi m ON m.pen=r.pen AND m.udise=r.udise WHERE r.udise=? ORDER BY r.cls,r.div,r.name LIMIT 800').bind(u).all()).results;
    return J({ok:1,rows});
  }
  if(p==='/api/pm/bmisave'){
    const rs=[],now=istDay();
    for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,120)){
      const pen=cl(x.pen,11).replace(/\D/g,''),h=parseFloat(x.h),wt=parseFloat(x.w);
      if(pen.length!==11)continue;
      if(!(h>50&&h<220&&wt>5&&wt<150)){rs.push(env.DB.prepare('DELETE FROM pm_bmi WHERE udise=? AND pen=?').bind(u,pen));continue}
      rs.push(env.DB.prepare('INSERT INTO pm_bmi(udise,pen,h,w,upd) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM roster WHERE pen=? AND udise=?) ON CONFLICT(udise,pen) DO UPDATE SET h=excluded.h,w=excluded.w,upd=excluded.upd').bind(u,pen,h,wt,now,pen,u));
    }
    if(rs.length)await env.DB.batch(rs);
    return J({ok:1,n:rs.length});
  }
  if(p==='/api/pm/sbank'){const x=await env.DB.prepare('SELECT tan,acct FROM school_bank WHERE udise=?').bind(u).first();return J({ok:1,tan:x?x.tan:'',acct:x?x.acct:''})}
  if(p==='/api/pm/cooks'){
    const rows=(await env.DB.prepare('SELECT id,name,role,gender,bank,ifsc,acct,aadhaar,addr,pin FROM pm_cook WHERE udise=? ORDER BY name').bind(u).all()).results;
    const mk=s=>s?'XXXX'+String(s).slice(-4):'';
    return J({ok:1,rows:rows.map(x=>({id:x.id,name:x.name,role:x.role,gender:x.gender,bank:x.bank,ifsc:x.ifsc,acct:mk(x.acct),aadhaar:mk(x.aadhaar),addr:x.addr,pin:x.pin}))});
  }
  if(p==='/api/pm/cookget'){
    const x=await env.DB.prepare('SELECT id,name,role,gender,bank,ifsc,acct,aadhaar,addr,pin FROM pm_cook WHERE udise=? AND id=?').bind(u,cl(b.id,60)).first();
    return x?J({ok:1,row:x}):J({e:'nf'},404);
  }
  if(p==='/api/pm/cooksave'){
    const nm=cl(b.name,80);if(nm.length<2)return J({e:'bad'},400);
    const id=b.id?cl(b.id,60):'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const dg=(s,n)=>cl(s,n).replace(/\D/g,''),ro=b.role==='madatnis'?'madatnis':'cook',ge=['F','M'].includes(b.gender)?b.gender:'';
    await env.DB.prepare('INSERT INTO pm_cook(udise,id,name,role,gender,bank,ifsc,acct,aadhaar,addr,pin,upd) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,id) DO UPDATE SET name=excluded.name,role=excluded.role,gender=excluded.gender,bank=excluded.bank,ifsc=excluded.ifsc,acct=excluded.acct,aadhaar=excluded.aadhaar,addr=excluded.addr,pin=excluded.pin,upd=excluded.upd')
      .bind(u,id,nm,ro,ge,cl(b.bank,60),cl(b.ifsc,15).toUpperCase(),dg(b.acct,20),dg(b.aadhaar,12),cl(b.addr,200),dg(b.pin,6),istDay()).run();
    return J({ok:1,id});
  }
  if(p==='/api/pm/cookdel'){await env.DB.prepare('DELETE FROM pm_cook WHERE udise=? AND id=?').bind(u,cl(b.id,60)).run();return J({ok:1})}
  if(p==='/api/pm/year'){
    const fy=parseInt(b.fy)||0;if(fy<2020||fy>2100)return J({e:'fy'},400);
    const d=(await env.DB.prepare('SELECT * FROM pm_daily WHERE udise=? AND date>=? AND date<=? ORDER BY date').bind(u,fy+'-04-01',(fy+1)+'-03-31').all()).results;
    const st=(await env.DB.prepare('SELECT month,grp,data FROM pm_stock WHERE udise=? AND month>=? AND month<=?').bind(u,fy+'-04',(fy+1)+'-03').all()).results;
    const rc=(await env.DB.prepare('SELECT id,date,supplier,challan,items,remark FROM pm_rcpt WHERE udise=? AND date>=? AND date<=? ORDER BY date').bind(u,fy+'-04-01',(fy+1)+'-03-31').all()).results;
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(u).first();
    const hol=(await env.DB.prepare('SELECT id,d1,d2,name,type FROM hol ORDER BY d1').all()).results;
    return J({ok:1,fy,udise:u,school:sc?sc.name:'',teacher:t.name,daily:d,stock:st,rcpt:rc,hol,rate:(await env.DB.prepare('SELECT d,r15,r68 FROM pm_rate ORDER BY d').all()).results,cookn:((await env.DB.prepare('SELECT COUNT(*) c FROM pm_cook WHERE udise=?').bind(u).first())||{}).c||0});
  }
  if(p==='/api/pm/savemonth'){
    const month=cl(b.month,7);if(!/^\d{4}-\d{2}$/.test(month))return J({e:'month'},400);
    const es=Array.isArray(b.entries)?b.entries.slice(0,31):[];if(!es.length)return J({e:'empty'},400);
    const today=istDay(),tre=/^\d{2}:\d{2}$/,st=[],now=new Date().toISOString();
    for(const e of es){
      const date=cl(e.date,10);
      if(!dOk(date)||date.slice(0,7)!==month)return J({e:'date',m:date},400);
      if(date>today)return J({e:'future',m:date},400);
      const cooked=cl(e.cooked,4)==='नाही'?'नाही':'होय';
      let p15=Math.floor(Number(e.p15)||0),p68=Math.floor(Number(e.p68)||0);
      if(p15<0||p68<0||p15>2000||p68>2000)return J({e:'num',m:date},400);
      if(cooked==='होय'&&!p15&&!p68)return J({e:'pres',m:date},400);
      if(cooked==='नाही'){p15=0;p68=0}
      const menu=cl(e.menu,80);if(cooked==='होय'&&!menu)return J({e:'menu',m:date},400);
      st.push(env.DB.prepare("INSERT INTO pm_daily(udise,date,menu,p15,p68,pulse15,pulse68,cooked,supp,taste,dist,taster,remark,sample,by,upd) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,date) DO UPDATE SET menu=excluded.menu,p15=excluded.p15,p68=excluded.p68,pulse15=excluded.pulse15,pulse68=excluded.pulse68,cooked=excluded.cooked,supp=excluded.supp,taste=excluded.taste,dist=excluded.dist,taster=excluded.taster,remark=excluded.remark,sample=excluded.sample,by=excluded.by,upd=excluded.upd")
        .bind(u,date,menu,p15,p68,cl(e.pulse15,40),cl(e.pulse68,40),cooked,cl(e.supplement,80),tre.test(e.tasteTime||'')?e.tasteTime:'',tre.test(e.distTime||'')?e.distTime:'',cl(e.taster,60),cl(e.remark,200),e.sample==='होय'?'होय':'',by,now));
    }
    await env.DB.batch(st);return J({ok:1,n:st.length});
  }
  if(p==='/api/pm/ddel'){
    const date=cl(b.date,10);if(!dOk(date))return J({e:'date'},400);
    await env.DB.prepare('DELETE FROM pm_daily WHERE udise=? AND date=?').bind(u,date).run();return J({ok:1});
  }
  if(p==='/api/pm/stocksave'){
    const month=cl(b.month,7),grp=cl(b.grp,2);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||(grp!=='15'&&grp!=='68'))return J({e:'arg'},400);
    const d=b.data&&typeof b.data==='object'?b.data:{},clean={};
    for(const it of PM_ITEMS){const e=d[it];if(!e||typeof e!=='object')continue;const o={};let any=false;
      for(const k of ['o','r','p']){if(e[k]===null||e[k]===undefined||e[k]==='')continue;const n=Number(e[k]);
        if(!isFinite(n)||n>1000000||n<(k==='o'?-1000000:0))return J({e:'num',m:it},400);o[k]=Math.round(n*1e6)/1e6;any=true}
      if(any)clean[it]=o}
    if(d._pat&&d._pat.o!==undefined&&d._pat.o!==''&&d._pat.o!==null){const pn=Math.floor(Number(d._pat.o));if(!isFinite(pn)||pn<0||pn>5000)return J({e:'pat'},400);clean._pat={o:pn}}
    if(!Object.keys(clean).length)await env.DB.prepare('DELETE FROM pm_stock WHERE udise=? AND month=? AND grp=?').bind(u,month,grp).run();
    else await env.DB.prepare('INSERT INTO pm_stock(udise,month,grp,data,by,upd) VALUES(?,?,?,?,?,?) ON CONFLICT(udise,month,grp) DO UPDATE SET data=excluded.data,by=excluded.by,upd=excluded.upd').bind(u,month,grp,JSON.stringify(clean),by,new Date().toISOString()).run();
    return J({ok:1});
  }
  if(p==='/api/pm/rsave'){
    const date=cl(b.date,10);if(!dOk(date)||date>istDay())return J({e:'date'},400);
    const sup=cl(b.supplier,120);if(!sup)return J({e:'supplier'},400);
    const seen={},items=[],r4=v=>Math.round((Number(v)||0)*1e4)/1e4;for(const x of (Array.isArray(b.items)?b.items:[])){const nm=cl(x&&x.name,40);
      const sp=x&&x.q15!=null,a=sp?r4(x.q15):0,c=sp?r4(x.q68):0,q=sp?r4(a+c):r4(x&&x.qty);
      if(!nm||q<=0||a<0||c<0)continue;if(!PM_ITEMS.includes(nm)||q>100000)return J({e:'item',m:nm},400);
      if(seen[nm]){seen[nm].qty=r4(seen[nm].qty+q);if(sp&&seen[nm].q15!=null){seen[nm].q15=r4(seen[nm].q15+a);seen[nm].q68=r4(seen[nm].q68+c)}}else{seen[nm]=sp?{name:nm,qty:q,q15:a,q68:c}:{name:nm,qty:q};items.push(seen[nm])}}
    if(!items.length)return J({e:'items'},400);
    let id=cl(b.id,40);
    if(id){if(!await env.DB.prepare('SELECT 1 x FROM pm_rcpt WHERE udise=? AND id=?').bind(u,id).first())return J({e:'nf'},404)}
    else id='R'+Date.now().toString(36).toUpperCase();
    await env.DB.prepare('INSERT INTO pm_rcpt(udise,id,date,supplier,challan,items,remark,by,upd) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,id) DO UPDATE SET date=excluded.date,supplier=excluded.supplier,challan=excluded.challan,items=excluded.items,remark=excluded.remark,by=excluded.by,upd=excluded.upd').bind(u,id,date,sup,cl(b.challan,60),JSON.stringify(items),cl(b.remark,200),by,new Date().toISOString()).run();
    return J({ok:1,id});
  }
  if(p==='/api/pm/rdel'){
    await env.DB.prepare('DELETE FROM pm_rcpt WHERE udise=? AND id=?').bind(u,cl(b.id,40)).run();return J({ok:1});
  }
  return J({e:'nf'},404);
}
async function ext(p,r,env){
  {const pr=await pmApi(p,r,env);if(pr)return pr}
  if(p==='/api/s/login'){
    const b=await body(r),pen=cl(b.pen,11).replace(/\D/g,''),pw=cl(b.pw,40);
    if(pen.length!==11||!pw)return J({e:'bad'},401);
    const x=await env.DB.prepare('SELECT * FROM roster WHERE pen=?').bind(pen).first();
    if(!x)return J({e:'bad'},401);
    if(x.fails>=8&&Date.now()-(x.lf||0)<900000)return J({e:'locked'},429);
    if(!(await pwOk(pw,x.salt,x.pw))){await env.DB.prepare('UPDATE roster SET fails=CASE WHEN fails>=8 AND ?-lf>=900000 THEN 1 ELSE fails+1 END,lf=? WHERE pen=?').bind(Date.now(),Date.now(),pen).run();return J({e:'bad'},401);}
    const tok=rnd(24),key='P'+pen;let sid=x.sid;
    if(sid){await env.DB.prepare('UPDATE students SET token=?,name=?,cls=?,med=?,school_udise=?,last_seen=CURRENT_TIMESTAMP WHERE id=?').bind(tok,x.name,x.cls,x.med,x.udise,sid).run();}
    else{
      const ins=await env.DB.prepare('INSERT INTO students(mobile,name,cls,med,salt,pin_hash,district,taluka,kendra,school,school_udise,token,last_seen) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)').bind(key,x.name,x.cls,x.med,'-','-','सांगली','जत','','',x.udise,tok).run();
      sid=ins.meta.last_row_id;await env.DB.prepare('UPDATE roster SET sid=? WHERE pen=?').bind(sid,pen).run();
    }
    await env.DB.prepare('UPDATE roster SET fails=0 WHERE pen=?').bind(pen).run();
    return J({ok:1,token:tok,changed:x.changed?1:0,profile:{name:x.name,cls:x.cls,med:x.med,mobile:key,district:'सांगली',taluka:'जत',kendra:'',school:'',udise:x.udise}});
  }
  if(p==='/api/s/result'){
    const s=await me(env,r);if(!s||!/^P\d{11}$/.test(s.mobile))return J({e:'auth'},401);
    const pen=s.mobile.slice(1),x=await env.DB.prepare('SELECT udise,cls,div,name FROM roster WHERE pen=?').bind(pen).first();if(!x)return J({e:'auth'},401);
    const n=new Date(Date.now()+19800000),y=n.getUTCMonth()>=5?n.getUTCFullYear():n.getUTCFullYear()-1,yr=y+'-'+String((y+1)%100).padStart(2,'0');
    const rows=(await env.DB.prepare("SELECT k,v FROM cce_doc WHERE udise=? AND yr=? AND cls=? AND div=? AND kind='res'").bind(x.udise,yr,x.cls,x.div).all()).results;
    const out={};for(const q of rows){try{const o=JSON.parse(q.v);if(o&&o.on&&o.d&&o.d[pen])out[q.k]={at:o.at,r:o.d[pen]}}catch(e){}}
    return J({ok:1,yr,name:x.name,cls:x.cls,res:out});
  }
  if(p==='/api/s/chpw'){
    const b=await body(r),s=await me(env,r),pw=cl(b.pw,40);
    if(!s||!/^P\d{11}$/.test(s.mobile))return J({e:'auth'},401);
    if(pw.length<4)return J({e:'short'},400);
    const salt=rnd(8);
    await env.DB.prepare('UPDATE roster SET salt=?,pw=?,changed=1 WHERE pen=?').bind(salt,'p:'+await hashPin(pw,salt),s.mobile.slice(1)).run();
    return J({ok:1});
  }
  if(p==='/api/t/register'){
    const b=await body(r),sh=cl(b.shalarth,20).toUpperCase(),name=cl(b.name,60),mob=cl(b.mobile,10),udise=cl(b.udise,11).replace(/\D/g,''),pw=cl(b.pw,40);
    if(!/^[A-Z0-9]{6,20}$/.test(sh))return J({e:'sh'},400);
    if(name.length<2)return J({e:'name'},400);
    if(!okMob(mob))return J({e:'mobile'},400);
    if(udise.length!==11)return J({e:'udise'},400);
    if(pw.length<6)return J({e:'pw'},400);
    if(!b.consent)return J({e:'consent'},400);
    const cs=(Array.isArray(b.classes)?b.classes:[]).slice(0,12).map(c=>({cls:parseInt(c.cls)||0,div:cl(c.div,2).toUpperCase()||'A'})).filter(c=>c.cls>=1&&c.cls<=8);
    if(!cs.length)return J({e:'cls'},400);
    if(await env.DB.prepare('SELECT id FROM teachers WHERE shalarth=?').bind(sh).first())return J({e:'exists'},409);
    const salt=rnd(8),h=await hashPin(pw,salt);
    const ins=await env.DB.prepare('INSERT INTO teachers(shalarth,name,mobile,udise,salt,pw) VALUES(?,?,?,?,?,?)').bind(sh,name,mob,udise,salt,h).run();
    const id=ins.meta.last_row_id;
    await env.DB.batch(cs.map(c=>env.DB.prepare('INSERT OR IGNORE INTO tclasses(tid,udise,cls,div) VALUES(?,?,?,?)').bind(id,udise,c.cls,c.div)));
    return J({ok:1});
  }
  if(p==='/api/t/login'){
    const b=await body(r),sh=cl(b.shalarth,20).toUpperCase(),pw=cl(b.pw,40);
    const x=await env.DB.prepare('SELECT * FROM teachers WHERE shalarth=?').bind(sh).first();
    if(!x)return J({e:'bad'},401);
    if(x.fails>=8)return J({e:'locked'},429);
    if((await hashPin(pw,x.salt))!==x.pw){await env.DB.prepare('UPDATE teachers SET fails=fails+1 WHERE id=?').bind(x.id).run();return J({e:'bad'},401);}
    const tok=rnd(24);await env.DB.prepare('UPDATE teachers SET fails=0,token=? WHERE id=?').bind(tok,x.id).run();
    return J({ok:1,token:tok,status:x.status,name:x.name,udise:x.udise});
  }
  if(p==='/api/t/school'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const u=cl(b.udise,11).replace(/\D/g,'');
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(u).first();
    return J({ok:1,udise:u,school:sc?sc.name:''});
  }
  if(p==='/api/t/setschool'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const u=cl(b.udise,11).replace(/\D/g,'');
    if(!await env.DB.prepare('SELECT 1 x FROM schools WHERE udise=?').bind(u).first())return J({e:'nf'},404);
    const ops=[env.DB.prepare('UPDATE teachers SET udise=?,conf=1 WHERE id=?').bind(u,t.id)];
    if(u!==t.udise)ops.push(env.DB.prepare('DELETE FROM tclasses WHERE tid=? AND udise<>?').bind(t.id,u));
    await env.DB.batch(ops);
    return J({ok:1});
  }
  if(p==='/api/t/avail'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const u=(await env.DB.prepare('SELECT udise FROM teachers WHERE id=?').bind(t.id).first()).udise;
    const rs=(await env.DB.prepare("SELECT r.cls,r.div,COUNT(*) n FROM roster r WHERE r.udise=? AND NOT EXISTS(SELECT 1 FROM tclasses c WHERE c.tid=? AND c.udise=r.udise AND c.cls=r.cls AND c.div=r.div) GROUP BY r.cls,r.div ORDER BY r.cls,r.div").bind(u,t.id).all()).results;
    return J({ok:1,udise:u,rows:rs});
  }
  if(p==='/api/t/addcls'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);if(!t.conf)return J({e:'conf'},403);
    const u=(await env.DB.prepare('SELECT udise FROM teachers WHERE id=?').bind(t.id).first()).udise;
    const cs=(Array.isArray(b.rows)?b.rows:[]).slice(0,16);let n=0;
    for(const c of cs){const k=parseInt(c.cls)||0,dv=cl(c.div,2).toUpperCase();
      if(k<1||k>8)continue;
      if(!/^[A-Z]{1,2}$/.test(dv))continue;
      if(!b.fresh&&!await env.DB.prepare('SELECT 1 x FROM roster WHERE udise=? AND cls=? AND div=? LIMIT 1').bind(u,k,dv).first())continue;
      await env.DB.prepare('INSERT OR IGNORE INTO tclasses(tid,udise,cls,div) VALUES(?,?,?,?)').bind(t.id,u,k,dv).run();n++;}
    return J({ok:1,n:n});
  }
  if(p==='/api/t/chpw'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const o=cl(b.old,40),pw=cl(b.pw,40);if(pw.length<6)return J({e:'pw'},400);
    const x=await env.DB.prepare('SELECT salt,pw FROM teachers WHERE id=?').bind(t.id).first();
    if(!x||(await hashPin(o,x.salt))!==x.pw)return J({e:'bad'},401);
    const salt=rnd(8);await env.DB.prepare('UPDATE teachers SET salt=?,pw=? WHERE id=?').bind(salt,await hashPin(pw,salt),t.id).run();
    return J({ok:1});
  }
  if(p==='/api/t/classes'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const rs=(await env.DB.prepare("SELECT c.udise,c.cls,c.div,(SELECT COUNT(*) FROM roster r WHERE r.udise=c.udise AND r.cls=c.cls AND r.div=c.div) n,(SELECT COUNT(*) FROM roster r JOIN students s ON s.id=r.sid WHERE r.udise=c.udise AND r.cls=c.cls AND r.div=c.div AND s.last_seen>=datetime('now','-7 day')) a7 FROM tclasses c WHERE c.tid=? ORDER BY c.cls,c.div").bind(t.id).all()).results;
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();
    return J({ok:1,name:t.name,rows:rs,udise:t.udise,school:sc?sc.name:'',conf:t.conf?1:0});
  }
  if(p==='/api/t/report'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const cls=parseInt(b.cls)||0,dv=cl(b.div,2).toUpperCase();
    if(!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,cl(b.udise,11),cls,dv).first())return J({e:'auth'},403);
    const ud=cl(b.udise,11);
    const rows=(await env.DB.prepare("SELECT r.pen,r.name,r.changed,s.last_seen,(SELECT COUNT(*) FROM usage u WHERE u.sid=r.sid) n,(SELECT COUNT(DISTINCT u.subj||'|'||u.lesson) FROM usage u WHERE u.sid=r.sid) dl FROM roster r LEFT JOIN students s ON s.id=r.sid WHERE r.udise=? AND r.cls=? AND r.div=? ORDER BY r.name").bind(ud,cls,dv).all()).results;
    const subj=(await env.DB.prepare("SELECT u.subj s,COUNT(*) n,COUNT(DISTINCT u.sid) p,COUNT(DISTINCT u.lesson) l FROM usage u WHERE u.sid IN (SELECT sid FROM roster WHERE udise=? AND cls=? AND div=? AND sid IS NOT NULL) GROUP BY u.subj ORDER BY n DESC").bind(ud,cls,dv).all()).results;
    return J({ok:1,rows,subj});
  }
  if(p==='/api/t/uimport'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);if(!t.conf)return J({e:'conf'},403);
    if(cl(b.udise,11)!==t.udise)return J({e:'udise'},403);
    const med=b.med==='kn'?'kn':'mr',CT=['GEN','SC','ST','VJA','NTB','NTC','NTD','OBC','SBC'];
    const rs=[],si=[],tc=new Set();let n=0,sk=0;
    for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,120)){
      const pen=cl(x.pen,11).replace(/\D/g,''),cls=parseInt(x.cls)||0,dv=cl(x.div,2).toUpperCase()||'A',name=cl(x.name,60);
      if(pen.length!==11||cls<1||cls>8||name.length<2||!/^[A-Z]{1,2}$/.test(dv)){sk++;continue}
      const ex=await env.DB.prepare('SELECT udise FROM roster WHERE pen=?').bind(pen).first();
      if(ex&&ex.udise!==t.udise){sk++;continue}
      const salt=rnd(6),h=await sha(salt+'123456');
      rs.push(env.DB.prepare("INSERT INTO roster(pen,udise,cls,div,name,med,salt,pw,pw0,salt0) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET cls=excluded.cls,div=excluded.div,name=excluded.name").bind(pen,t.udise,cls,dv,name,med,salt,h,h,salt));
      const g=['M','F','O'].includes(x.gender)?x.gender:'',ct=CT.includes(x.cat)?x.cat:'';
      si.push(env.DB.prepare("INSERT INTO sinfo(pen,gender,cat,father,mother) VALUES(?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET gender=CASE WHEN COALESCE(sinfo.gender,'')='' THEN excluded.gender ELSE sinfo.gender END,cat=CASE WHEN COALESCE(sinfo.cat,'')='' THEN excluded.cat ELSE sinfo.cat END,father=CASE WHEN COALESCE(sinfo.father,'')='' THEN excluded.father ELSE sinfo.father END,mother=CASE WHEN COALESCE(sinfo.mother,'')='' THEN excluded.mother ELSE sinfo.mother END").bind(pen,g,ct,cl(x.father,60),cl(x.mother,60)));
      tc.add(cls+'|'+dv);n++;
    }
    if(rs.length)await env.DB.batch(rs);
    if(si.length)await env.DB.batch(si);
    if(tc.size)await env.DB.batch([...tc].map(k=>{const [c,d]=k.split('|');return env.DB.prepare('INSERT OR IGNORE INTO tclasses(tid,udise,cls,div) VALUES(?,?,?,?)').bind(t.id,t.udise,parseInt(c),d)}));
    return J({ok:1,n:n,sk:sk});
  }
  if(p==='/api/t/add'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    return imp(env,b.rows,t.id);
  }
  if(p==='/api/t/sget'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const cls=parseInt(b.cls)||0,dv=cl(b.div,2).toUpperCase(),ud=cl(b.udise,11);
    if(!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,ud,cls,dv).first())return J({e:'auth'},403);
    await ensS(env);
    const rows=(await env.DB.prepare('SELECT r.pen,r.name,r.med,i.dob,i.gender,i.cat,i.addr,i.mother,i.mobile,i.father,i.roll,i.gr,i.saral,i.tongue,i.status FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen WHERE r.udise=? AND r.cls=? AND r.div=? ORDER BY r.name').bind(ud,cls,dv).all()).results;
    return J({ok:1,rows});
  }
  if(p==='/api/t/sset'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const pen=cl(b.pen,11);
    if(!b.consent)return J({e:'consent'});
    const x=await env.DB.prepare('SELECT r.pen FROM roster r JOIN tclasses c ON c.udise=r.udise AND c.cls=r.cls AND c.div=r.div WHERE r.pen=? AND c.tid=?').bind(pen,t.id).first();
    if(!x)return J({e:'auth'},403);
    const g=['M','F','O'].includes(b.gender)?b.gender:'',mob=cl(b.mobile,15).replace(/\D/g,'');
    if(mob&&mob.length!==10)return J({e:'mobile'});
    await ensS(env);
    await env.DB.prepare("INSERT INTO sinfo(pen,gender,cat,addr,mother,mobile,tid,upd,dob,father,roll,gr,saral,tongue,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET father=excluded.father,roll=excluded.roll,gr=excluded.gr,saral=excluded.saral,tongue=excluded.tongue,status=excluded.status,dob=CASE WHEN excluded.dob<>'' THEN excluded.dob ELSE sinfo.dob END,gender=excluded.gender,cat=excluded.cat,addr=excluded.addr,mother=excluded.mother,mobile=excluded.mobile,tid=excluded.tid,upd=excluded.upd").bind(pen,g,cl(b.cat,40),cl(b.addr,200),cl(b.mother,60),mob,t.id,new Date().toISOString(),okDob(cl(b.dob,10)),cl(b.father,60),cl(b.roll,6),cl(b.gr,15),cl(b.saral,25),cl(b.tongue,20),cl(b.status,20)).run();
    return J({ok:1});
  }
  if(p==='/api/cce/school'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const ud=cl(b.udise,11),yr=cl(b.yr,7);
    if(!/^\d{11}$/.test(ud)||!/^20\d\d-\d\d$/.test(yr))return J({e:'args'});
    if(!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=?').bind(t.id,ud).first())return J({e:'auth'},403);
    const rows=(await env.DB.prepare("SELECT cls,div,kind,k,v FROM cce_doc WHERE udise=? AND yr=? AND cls>0 AND kind IN ('marks','wt')").bind(ud,yr).all()).results;
    const stu=(await env.DB.prepare('SELECT pen,cls,div FROM roster WHERE udise=?').bind(ud).all()).results;
    return J({ok:1,rows,stu});
  }
  if(p==='/api/cce/get'||p==='/api/cce/put'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const ud=cl(b.udise,11),cls=parseInt(b.cls)||0,dv=cls?cl(b.div,2).toUpperCase():'',yr=cl(b.yr,7);
    if(!/^\d{11}$/.test(ud)||!/^20\d\d-\d\d$/.test(yr)||cls<0||cls>8)return J({e:'args'});
    // cls=0 : शाळा-स्तर नोंद (त्या शाळेत शिक्षकाचा कोणताही वर्ग असावा)
    const own=cls?await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,ud,cls,dv).first():await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=?').bind(t.id,ud).first();
    if(!own)return J({e:'auth'},403);
    if(p==='/api/cce/get'){
      const kinds=(Array.isArray(b.kinds)?b.kinds:[]).map(x=>cl(x,10)).filter(x=>/^[a-z]+$/.test(x)).slice(0,12);
      let q='SELECT cls,kind,k,v,upd FROM cce_doc WHERE udise=? AND yr=? AND ((cls=? AND div=?)'+(b.school?' OR cls=0':'')+')',pr=[ud,yr,cls,dv];
      if(kinds.length){q+=' AND kind IN ('+kinds.map(()=>'?').join(',')+')';pr=pr.concat(kinds)}
      const rows=(await env.DB.prepare(q).bind(...pr).all()).results;
      return J({ok:1,rows});
    }
    const kind=cl(b.kind,10),k=cl(b.k,40),v=typeof b.v==='string'?b.v:JSON.stringify(b.v==null?null:b.v);
    if(!/^[a-z]+$/.test(kind)||v.length>600000)return J({e:'args'});
    const now=new Date().toISOString();
    if(b.upd!==undefined){const cur=await env.DB.prepare('SELECT upd FROM cce_doc WHERE udise=? AND yr=? AND cls=? AND div=? AND kind=? AND k=?').bind(ud,yr,cls,dv,kind,k).first();
      if(cur&&cur.upd!==b.upd)return J({e:'conflict',upd:cur.upd})}
    await env.DB.prepare('INSERT INTO cce_doc(udise,yr,cls,div,kind,k,v,tid,upd) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,yr,cls,div,kind,k) DO UPDATE SET v=excluded.v,tid=excluded.tid,upd=excluded.upd').bind(ud,yr,cls,dv,kind,k,v,t.id,now).run();
    return J({ok:1,upd:now});
  }
  if(p==='/api/t/resetpw'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const pen=cl(b.pen,11);
    const x=await env.DB.prepare('SELECT r.pen FROM roster r JOIN tclasses c ON c.udise=r.udise AND c.cls=r.cls AND c.div=r.div WHERE r.pen=? AND c.tid=?').bind(pen,t.id).first();
    if(!x)return J({e:'auth'},403);
    await env.DB.prepare('UPDATE roster SET pw=pw0,salt=salt0,fails=0,changed=0 WHERE pen=?').bind(pen).run();
    return J({ok:1});
  }
  if(p==='/api/admin/tlist'||p==='/api/admin/tset'||p==='/api/admin/import'||p==='/api/admin/timport'||p==='/api/admin/simport'||p==='/api/admin/hsave'||p==='/api/admin/hdel'||p==='/api/admin/ratesave'||p==='/api/admin/ratedel'||p==='/api/admin/cookimport'||p==='/api/admin/cookmap'){
    const b=await body(r),bad=await adminKey(env,b);if(bad)return bad;
    if(p==='/api/admin/cookmap'){await pmEnsure(env);const f=cl(b.from,40),t2=cl(b.to,11).replace(/\D/g,'');if(!f||t2.length!==11)return J({e:'bad'},400);await env.DB.prepare('UPDATE OR REPLACE pm_cook SET udise=? WHERE udise=?').bind(t2,f).run();return J({ok:1})}
    if(p==='/api/admin/cookimport'){
      await pmEnsure(env);const st=[],dg=(s,n)=>cl(s,n).replace(/\D/g,'');
      for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,50)){
        const sn=cl(x.sn,120);let ud=dg(x.u,11);if(ud.length!==11)ud=sn?'N'+sn.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,30):'';const nm=cl(x.name,80);if(!ud||nm.length<2)continue;
        const id='i'+nm.toUpperCase().replace(/[^A-Z0-9\u0900-\u097F]/g,'').slice(0,40);
        st.push(env.DB.prepare('INSERT INTO pm_cook(udise,id,name,role,gender,bank,ifsc,acct,aadhaar,addr,pin,upd,sname) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,id) DO UPDATE SET name=excluded.name,gender=excluded.gender,bank=excluded.bank,ifsc=excluded.ifsc,acct=excluded.acct,aadhaar=excluded.aadhaar,addr=excluded.addr,pin=excluded.pin,upd=excluded.upd,sname=excluded.sname')
          .bind(ud,id,nm,'cook',['F','M'].includes(x.g)?x.g:'',cl(x.bank,60),cl(x.ifsc,15).toUpperCase(),dg(x.acct,20),dg(x.aad,12),cl(x.addr,200),dg(x.pin,6),istDay(),sn));
      }
      if(st.length)await env.DB.batch(st);
      return J({ok:1,n:st.length});
    }
    if(p==='/api/admin/ratesave'||p==='/api/admin/ratedel'){
      await pmEnsure(env);const d=cl(b.d,10);if(!dOk(d))return J({e:'bad'},400);
      if(p==='/api/admin/ratedel'){await env.DB.prepare('DELETE FROM pm_rate WHERE d=? AND (SELECT COUNT(*) FROM pm_rate)>1').bind(d).run();return J({ok:1})}
      const a=Math.round(parseFloat(b.r15)*100)/100,c=Math.round(parseFloat(b.r68)*100)/100;
      if(!(a>0&&a<1000&&c>0&&c<1000))return J({e:'bad'},400);
      await env.DB.prepare('INSERT INTO pm_rate(d,r15,r68) VALUES(?,?,?) ON CONFLICT(d) DO UPDATE SET r15=excluded.r15,r68=excluded.r68').bind(d,a,c).run();return J({ok:1});
    }
    if(p==='/api/admin/hsave'||p==='/api/admin/hdel'){
      await pmEnsure(env);
      if(p==='/api/admin/hdel'){await env.DB.prepare('DELETE FROM hol WHERE id=?').bind(cl(b.id,40)).run();return J({ok:1})}
      const d1=cl(b.d1,10),d2=cl(b.d2,10),nm=cl(b.name,80),ty=['general','local','vacation','other'].includes(b.type)?b.type:'general';
      if(!dOk(d1)||(d2&&(!dOk(d2)||d2<d1))||!nm)return J({e:'bad'},400);
      const id=b.id?cl(b.id,40):'h'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      await env.DB.prepare('INSERT INTO hol(id,d1,d2,name,type) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET d1=excluded.d1,d2=excluded.d2,name=excluded.name,type=excluded.type').bind(id,d1,d2||'',nm,ty).run();
      return J({ok:1,id});
    }
    if(p==='/api/admin/tlist'){
      const ts=(await env.DB.prepare('SELECT id,shalarth,name,mobile,udise,status,created FROM teachers ORDER BY id DESC LIMIT 500').all()).results;
      const cs=(await env.DB.prepare('SELECT tid,cls,div FROM tclasses').all()).results;
      ts.forEach(x=>x.cl=cs.filter(c=>c.tid===x.id).map(c=>c.cls+c.div).join(', '));
      const n=await env.DB.prepare('SELECT COUNT(*) n FROM roster').first();
      return J({ok:1,rows:ts,roster:n.n});
    }
    if(p==='/api/admin/tset'){
      const st=b.status==='ok'?'ok':b.status==='del'?'del':'pending',id=parseInt(b.id)||0;
      if(st==='del'){await env.DB.batch([env.DB.prepare('DELETE FROM tclasses WHERE tid=?').bind(id),env.DB.prepare('DELETE FROM teachers WHERE id=?').bind(id)]);}
      else await env.DB.prepare('UPDATE teachers SET status=?,fails=0 WHERE id=?').bind(st,id).run();
      return J({ok:1});
    }
    if(p==='/api/admin/simport'){
      const st=[];
      for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,100)){const u=cl(x.u,11).replace(/\D/g,''),n=cl(x.n,120);if(u.length===11&&n)st.push(env.DB.prepare('INSERT OR REPLACE INTO schools(udise,name) VALUES(?,?)').bind(u,n));}
      if(st.length)await env.DB.batch(st);
      return J({ok:1,n:st.length});
    }
    if(p==='/api/admin/timport'){
      const salt=rnd(8),h=await hashPin('123456',salt),st=[];let sk=0;
      for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,25)){
        const sh=cl(x.sh,20).toUpperCase().replace(/\s/g,''),name=cl(x.name,60),mob=cl(x.mob,10).replace(/\D/g,'').slice(-10),udise=cl(x.udise,11).replace(/\D/g,'');
        if(!/^[A-Z0-9]{6,20}$/.test(sh)||name.length<2||!okMob(mob)||udise.length!==11){sk++;continue}
        st.push(env.DB.prepare("INSERT OR IGNORE INTO teachers(shalarth,name,mobile,udise,salt,pw,status) VALUES(?,?,?,?,?,?,'ok')").bind(sh,name,mob,udise,salt,h));
      }
      let n=0;if(st.length){const rs=await env.DB.batch(st);rs.forEach(x=>{n+=x.meta.changes||0})}
      return J({ok:1,n:n,sk:sk+st.length-n});
    }
    return imp(env,b.rows,null);
  }
  return null;
}

export default{
  async fetch(r,env){
    const u=new URL(r.url);
    if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(r);
    try{
      const p=u.pathname;
      if(p==='/api/ping')return J({ok:true});
      if(r.method!=='POST')return J({e:'method'},405);
      const xr=await ext(p,r,env);if(xr)return xr;
      if(p==='/api/admin/stats'||p==='/api/admin/list'){
        const b=await body(r),ip=r.headers.get('cf-connecting-ip')||'';
        const a=await env.DB.prepare("SELECT * FROM settings WHERE k='admin'").first().catch(()=>null);
        if(!a)return J({e:'noadmin'},503);
        const [salt,hh,fails,last]=a.v.split('|');
        if(+fails>=10&&Date.now()-(+last)<900000)return J({e:'locked'},429);
        if(await hashPin(String(b.key||''),salt)!==hh){await env.DB.prepare("UPDATE settings SET v=? WHERE k='admin'").bind([salt,hh,(+fails)+1,Date.now()].join('|')).run();return J({e:'bad'},401);}
        if(+fails)await env.DB.prepare("UPDATE settings SET v=? WHERE k='admin'").bind([salt,hh,0,0].join('|')).run();
        const q=async(sql,...a)=>(await env.DB.prepare(sql).bind(...a).all()).results;
        if(p==='/api/admin/list'){
          const w=[],a2=[];for(const f of ['district','taluka','kendra']){if(b[f]){w.push(f+'=?');a2.push(String(b[f]))}}
          return J({rows:await q('SELECT name,mobile,cls,med,district,taluka,kendra,school,school_udise,created,last_seen FROM students'+(w.length?' WHERE '+w.join(' AND '):'')+' ORDER BY id DESC LIMIT 1000',...a2)});
        }
        const one=async(sql)=>(await env.DB.prepare(sql).first());
        return J({
          tot:await one("SELECT COUNT(*) n,SUM(date(created)=date('now')) today,SUM(last_seen>=datetime('now','-1 day')) a1,SUM(last_seen>=datetime('now','-7 day')) a7 FROM students"),
          ev:await one("SELECT COUNT(*) n,SUM(ts>=datetime('now','-1 day')) d1 FROM usage"),
          dist:await q("SELECT district d,COUNT(*) n,SUM(last_seen>=datetime('now','-7 day')) a7 FROM students GROUP BY district ORDER BY n DESC"),
          tal:await q("SELECT district d,taluka t,COUNT(*) n FROM students GROUP BY district,taluka ORDER BY n DESC LIMIT 300"),
          ken:await q("SELECT district d,taluka t,kendra k,COUNT(*) n,SUM(last_seen>=datetime('now','-7 day')) a7 FROM students GROUP BY district,taluka,kendra ORDER BY n DESC LIMIT 500"),
          cls:await q("SELECT cls c,med m,COUNT(*) n FROM students GROUP BY cls,med ORDER BY cls,med"),
          top:await q("SELECT cls c,med m,subj s,COUNT(*) n FROM usage GROUP BY cls,med,subj ORDER BY n DESC LIMIT 25"),
          fb:await q("SELECT f.type t,f.text x,f.lesson l,f.ts ts,s.name n,s.school sc,s.taluka tk,s.cls c FROM feedback f LEFT JOIN students s ON s.id=f.sid ORDER BY f.id DESC LIMIT 50"),
          day:await q("SELECT date(ts) d,COUNT(*) n,COUNT(DISTINCT sid) u FROM usage WHERE ts>=datetime('now','-14 day') GROUP BY date(ts) ORDER BY d")
        });
      }
      if(p==='/api/register'){
        const b=await body(r);
        const mobile=cl(b.mobile,10),name=cl(b.name,60),pin=cl(b.pin,6);
        if(!okMob(mobile))return J({e:'mobile'},400);
        if(name.length<2)return J({e:'name'},400);
        if(!okPin(pin))return J({e:'pin'},400);
        if(!b.consent)return J({e:'consent'},400);
        const cls=parseInt(b.cls)||0,med=['kn','en'].includes(b.med)?b.med:'mr';
        if(cls<1||cls>8)return J({e:'cls'},400);
        let salt=rnd(8),h=null,key=mobile;
        const ex=await env.DB.prepare("SELECT * FROM students WHERE mobile=? OR mobile LIKE ? ORDER BY id").bind(mobile,mobile+'-%').all();
        if(ex.results.length){
          const f=ex.results[0];
          if(f.fails>=8)return J({e:'locked'},429);
          if(await hashPin(pin,f.salt)!==f.pin_hash)return J({e:'exists'},409);
          if(ex.results.some(x=>x.cls===cls&&x.med===med&&x.name.trim().toLowerCase()===name.toLowerCase()))return J({e:'dup'},409);
          if(ex.results.length>=6)return J({e:'many'},409);
          salt=f.salt;h=f.pin_hash;key=mobile+'-'+(ex.results.length+1);
        }else h=await hashPin(pin,salt);
        const tok=rnd(24),mobileFull=key;
        await env.DB.prepare('INSERT INTO students(mobile,name,cls,med,salt,pin_hash,district,taluka,kendra,school,school_udise,token,last_seen) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
          .bind(mobileFull,name,cls,med,salt,h,cl(b.district,60),cl(b.taluka,60),cl(b.kendra,80),cl(b.school,100),cl(b.udise,11).replace(/\D/g,''),tok).run();
        return J({ok:1,token:tok,profile:{name,cls,med,mobile:mobileFull,district:cl(b.district,60),taluka:cl(b.taluka,60),kendra:cl(b.kendra,80),school:cl(b.school,100),udise:cl(b.udise,11)}});
      }
      if(p==='/api/login'){
        const b=await body(r),mobile=cl(b.mobile,10),pin=cl(b.pin,6);
        const rs=(await env.DB.prepare("SELECT * FROM students WHERE mobile=? OR mobile LIKE ? ORDER BY id").bind(mobile,mobile+'-%').all()).results;
        const s=rs[0];
        if(!s)return J({e:'bad'},401);
        if(s.fails>=8)return J({e:'locked'},429);
        if(await hashPin(pin,s.salt)!==s.pin_hash){await env.DB.prepare('UPDATE students SET fails=fails+1 WHERE id=?').bind(s.id).run();return J({e:'bad'},401);}
        const pf=(x,t)=>({token:t,profile:{name:x.name,cls:x.cls,med:x.med,mobile:x.mobile,district:x.district,taluka:x.taluka,kendra:x.kendra,school:x.school,udise:x.school_udise}});
        const list=[];
        for(const x of rs){const t=rnd(24);await env.DB.prepare('UPDATE students SET fails=0,token=?,last_seen=CURRENT_TIMESTAMP WHERE id=?').bind(t,x.id).run();list.push(pf(x,t));}
        return J({ok:1,token:list[0].token,profile:list[0].profile,list});
      }
      if(p==='/api/event'){
        const s=await me(env,r);if(!s)return J({e:'auth'},401);
        const b=await body(r),ev=(Array.isArray(b.events)?b.events:[]).slice(0,50);
        const st=ev.map(x=>env.DB.prepare('INSERT INTO usage(sid,ev,cls,med,subj,lesson) VALUES(?,?,?,?,?,?)').bind(s.id,cl(x.ev,20),parseInt(x.cls)||null,cl(x.med,2),cl(x.subj,60),cl(x.lesson,20)));
        st.push(env.DB.prepare('UPDATE students SET last_seen=CURRENT_TIMESTAMP WHERE id=?').bind(s.id));
        await env.DB.batch(st);
        return J({ok:1});
      }
      if(p==='/api/feedback'){
        const s=await me(env,r);if(!s)return J({e:'auth'},401);
        const b=await body(r),t=cl(b.text,800);if(t.length<3)return J({e:'text'},400);
        const n=await env.DB.prepare("SELECT COUNT(*) c FROM feedback WHERE sid=? AND ts>=datetime('now','-1 day')").bind(s.id).first();
        if(n&&n.c>=10)return J({e:'many'},429);
        await env.DB.prepare('INSERT INTO feedback(sid,type,text,cls,lesson) VALUES(?,?,?,?,?)').bind(s.id,cl(b.type,20),t,s.cls,cl(b.lesson,80)).run();
        return J({ok:1});
      }
      if(p==='/api/me'){const s=await me(env,r);return s?J({ok:1,profile:s}):J({e:'auth'},401);}
      return J({e:'nf'},404);
    }catch(e){return J({e:'server'},500);}
  }
};
