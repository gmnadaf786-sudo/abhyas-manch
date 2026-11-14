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
async function gemKey(env){if(env.GEMINI_API_KEY)return env.GEMINI_API_KEY;await slEnsure(env);const q=await env.DB.prepare("SELECT v FROM cfg WHERE k='gemini_key'").first();return(q&&q.v)||''}
async function gemAsk(env,si,contents,gc){const GK=await gemKey(env);if(!GK)return{e:'nokey'};let last='';
  for(const mo of ['gemini-3.5-flash-lite','gemini-3.5-flash','gemini-3.1-flash-lite']){for(let a=0;a<2;a++){try{
    const x=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+mo+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':GK},body:JSON.stringify({systemInstruction:{parts:[{text:si}]},contents,...(gc?{generationConfig:gc}:{})})});
    if(x.ok){const j=await x.json(),tx=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(q=>q.text||'').join('').trim();if(tx)return{t:tx}}else{last=x.status+'';if(![429,500,502,503].includes(x.status))break}
  }catch(e){last='net'}}}
  return{e:'fail',c:last}}
async function lessonPdf(env,path){if(!env.BOOKS||!/^[a-z]{2}-lessons\/[^\0]+\.pdf$/i.test(path)||path.includes('..'))return null;const o=await env.BOOKS.get(path);if(!o||o.size>14e6)return null;const u=new Uint8Array(await o.arrayBuffer());let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
async function scn(env,t){try{const q=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();return q?q.name:''}catch(e){return ''}}
const RQT={'मजकूर':'t','संख्या':'n','तारीख':'d','निवड':'s','होनाही':'y','मोठा':'l'};
function rqParse(txt){const out=[];for(const ln of String(txt||'').split('\n')){const a=ln.split('|').map(x=>x.trim());if(!a[0])continue;let r=0;if(a[a.length-1]==='*'){r=1;a.pop()}const ty=RQT[a[1]||'मजकूर']||'t';out.push({l:cl(a[0],120),t:ty,o:ty==='s'?String(a[2]||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30):[],r});if(out.length>=30)break}return out}
function rqVal(fs,d){const o={};d=d&&typeof d==='object'?d:{};for(let i=0;i<fs.length;i++){const f=fs[i];let v=cl(d['f'+i],f.t==='l'?1000:300).trim();
  if(!v){if(f.r)return{e:'req',l:f.l};continue}
  if(f.t==='n'&&!/^-?\d+(\.\d+)?$/.test(v))return{e:'num',l:f.l};
  if(f.t==='d'&&!/^\d{4}-\d{2}-\d{2}$/.test(v))return{e:'date',l:f.l};
  if(f.t==='s'&&!f.o.includes(v))return{e:'opt',l:f.l};
  if(f.t==='y'&&v!=='हो'&&v!=='नाही')return{e:'opt',l:f.l};
  o['f'+i]=v}return{d:o}}
const istD=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
async function rqList(env,aud,wt,wid){const rs=((await env.DB.prepare("SELECT id,title,due,fields FROM req WHERE active=1 AND (aud=? OR aud='b') ORDER BY created DESC").bind(aud).all()).results||[]);const td=istD(),out=[];
  for(const q of rs){const m=await env.DB.prepare('SELECT data,ts FROM resp WHERE rid=? AND wt=? AND wid=?').bind(q.id,wt,wid).first();let f=[],d={};try{f=JSON.parse(q.fields)}catch(e){}try{d=m?JSON.parse(m.data):{}}catch(e){}out.push({id:q.id,title:q.title,due:q.due,closed:!!(q.due&&q.due<td),f,mine:m?{d,ts:m.ts}:null})}
  return out}
async function rqSub(env,aud,wt,wid,name,sch,b){const q=await env.DB.prepare("SELECT id,due,fields,aud FROM req WHERE id=? AND active=1").bind(cl(b.id,40)).first();if(!q||(q.aud!==aud&&q.aud!=='b'))return J({e:'nf'},404);if(q.due&&q.due<istD())return J({e:'closed'},400);
  let f=[];try{f=JSON.parse(q.fields)}catch(e){}const v=rqVal(f,b.data);if(v.e)return J({e:v.e,l:v.l},400);
  await env.DB.prepare('INSERT INTO resp(rid,wt,wid,name,sch,data,ts) VALUES(?,?,?,?,?,?,?) ON CONFLICT(rid,wt,wid) DO UPDATE SET name=excluded.name,sch=excluded.sch,data=excluded.data,ts=excluded.ts').bind(q.id,wt,wid,cl(name,100),cl(sch,120),JSON.stringify(v.d),new Date(Date.now()+19800000).toISOString().slice(0,16).replace('T',' ')).run();return J({ok:1})}
async function ensS(env){}
// ---- School login (UDISE + password) ----
const SCH_COMM=[['C001','शाळा व्यवस्थापन समिती (SMC)'],['C002','सखी सावित्री समिती'],['C003','महिला तक्रार निवारण समिती'],['C004','विद्यार्थी सुरक्षा समिती'],['C005','माजी विद्यार्थी संघ']];
const TNE=["अनुक्रमांक", "लिंग", "संबोधन", "नाव", "मधले नाव", "आडनाव", "Shalarth ID", "जन्मतारीख", "प्रथम नियुक्ती दिनांक", "जिल्ह्यात रुजू दिनांक", "सेवानिवृत्ती दिनांक", "PAN क्रमांक", "केंद्राचे नाव"];
const SCH_DIST=['uni','book','shoe','bag'];
const CEN={"CLU3603574": "ACHANKAN HALLI", "CLU3603586": "ASANGI TURK", "CLU3603584": "AWANDI", "CLU3603592": "BAJ", "CLU3603590": "BANALI", "CLU3603593": "BILUR", "CLU3603576": "BORGI", "CLU3603580": "DAFALAPUR", "CLU3603598": "DARIBADACHI", "CLU3603591": "GIRAGAON", "CLU3603597": "GUDDAPUR", "CLU3603594": "JADRABOBALAD", "CLU3603573": "JAT KANYA", "CLU3603596": "JIRGYAL", "CLU3603577": "KHOJANWADI", "CLU3603595": "KO. BOBALAD", "CLU3603575": "KUMBHARI", "CLU3603589": "MUCHANDI", "CLU3603587": "NIGADI KD", "CLU3603579": "SANKH", "CLU3603582": "SANMADI", "CLU3603578": "SHEGAON", "CLU3603581": "SINDUR", "CLU3603583": "TIKONDI", "CLU3603588": "UMADI", "CLU3603600": "UTAGI", "CLU3603599": "WALEKHINDI", "CLU3603585": "WALSANG"};
let SLOK=false;
async function slEnsure(env){if(SLOK)return;const SV='sv'+String(slEnsure).length;try{const q=await env.DB.prepare("SELECT v FROM cfg WHERE k='slv'").first();if(q&&q.v===SV){SLOK=true;return}}catch(e){}await env.DB.batch([env.DB.prepare("CREATE TABLE IF NOT EXISTS school_login(udise TEXT PRIMARY KEY, salt TEXT, pw TEXT, changed INTEGER DEFAULT 0, fails INTEGER DEFAULT 0, token TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_cmember(udise TEXT, cid TEXT, id INTEGER, name TEXT, desig TEXT, mtype TEXT, mobile TEXT, joined TEXT, active INTEGER, PRIMARY KEY(udise,cid,id))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_dist(udise TEXT, kind TEXT, pen TEXT, got INTEGER, date TEXT, upd TEXT, PRIMARY KEY(udise,kind,pen))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_books(udise TEXT, cls TEXT, names TEXT, PRIMARY KEY(udise,cls))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_form(udise TEXT PRIMARY KEY, data TEXT, upd TEXT, by TEXT, submitted TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_center(udise TEXT PRIMARY KEY, code TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_bank(udise TEXT, kind TEXT, holder TEXT, bank TEXT, branch TEXT, acct TEXT, ifsc TEXT, upd TEXT, by TEXT, PRIMARY KEY(udise,kind))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS off_login(uname TEXT PRIMARY KEY, salt TEXT, pw TEXT, changed INTEGER DEFAULT 0, fails INTEGER DEFAULT 0, token TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tt(id INTEGER PRIMARY KEY AUTOINCREMENT, cls TEXT, period TEXT, d1 TEXT,d2 TEXT,d3 TEXT,d4 TEXT,d5 TEXT,d6 TEXT, t1 TEXT,t2 TEXT,t3 TEXT,t4 TEXT,t5 TEXT,t6 TEXT, rtype TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS tt_c ON tt(cls)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tach(id INTEGER PRIMARY KEY AUTOINCREMENT, medium TEXT, cls TEXT, subject TEXT, lesson TEXT, points TEXT, exp TEXT, assess TEXT, material TEXT, locode TEXT, lodesc TEXT, activity TEXT, notes TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS tach_k ON tach(medium,cls,subject,lesson)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tax_in(shalarth TEXT PRIMARY KEY, data TEXT, upd TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS cfg(k TEXT PRIMARY KEY, v TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS panch(d TEXT PRIMARY KEY, data TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_img(shalarth TEXT PRIMARY KEY, photo TEXT, sign TEXT, hami TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS req(id TEXT PRIMARY KEY, title TEXT, aud TEXT, due TEXT, fields TEXT, active INTEGER DEFAULT 1, created TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS resp(rid TEXT, wt TEXT, wid TEXT, name TEXT, sch TEXT, data TEXT, ts TEXT, PRIMARY KEY(rid,wt,wid))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS dir(id INTEGER PRIMARY KEY AUTOINCREMENT, desig TEXT, name TEXT, area TEXT, mobile TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS fb(id INTEGER PRIMARY KEY AUTOINCREMENT, shalarth TEXT, name TEXT, school TEXT, rating TEXT, typ TEXT, msg TEXT, ts TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS syl(id INTEGER PRIMARY KEY AUTOINCREMENT, medium TEXT, month TEXT, week INTEGER, cls TEXT, subject TEXT, topic TEXT, tname TEXT, sank TEXT, akar TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS syl_mc ON syl(medium,cls)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_rec(id INTEGER PRIMARY KEY AUTOINCREMENT, shalarth TEXT, kind TEXT, fd TEXT, td TEXT, udise TEXT, typ TEXT, rm TEXT, status TEXT, upd TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS tch_rec_sh ON tch_rec(shalarth)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_edit(shalarth TEXT PRIMARY KEY, data TEXT, status TEXT, remark TEXT, upd TEXT, sub TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_info(shalarth TEXT PRIMARY KEY, data TEXT, upd TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS pw_req(udise TEXT PRIMARY KEY, name TEXT, mobile TEXT, ts TEXT)")]);for(const c of ['sz1','sz2'])try{await env.DB.prepare('ALTER TABLE sch_dist ADD COLUMN '+c+' TEXT').run()}catch(e){}
  try{await env.DB.prepare("INSERT INTO cfg(k,v) VALUES('slv',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(SV).run()}catch(e){}SLOK=true}
async function schoolAuth(env,b){
  const t=cl(b.token,64);if(!t)return null;await slEnsure(env);
  return await env.DB.prepare('SELECT * FROM school_login WHERE token=?').bind(t).first();
}

async function offAuth(env,b){const u=cl(b.u,12).toUpperCase(),t=cl(b.token,64);if(!u||t.length<20)return null;const x=await env.DB.prepare('SELECT * FROM off_login WHERE uname=? AND token=?').bind(u,t).first();return x||null}
async function offApi(p,r,env){
  if(!p.startsWith('/api/o/'))return null;
  await slEnsure(env);const b=await body(r);
  if(p==='/api/o/login'){
    let u=cl(b.u,14).toUpperCase().replace(/\s/g,''),pw=cl(b.pw,40);if(/^\d{7}$/.test(u))u='CLU'+u;
    if(u!=='BEO'&&!CEN[u])return J({e:'bad'},401);
    let x=await env.DB.prepare('SELECT * FROM off_login WHERE uname=?').bind(u).first();
    if(!x){const salt=rnd(8);await env.DB.prepare('INSERT OR IGNORE INTO off_login(uname,salt,pw,changed,fails) VALUES(?,?,?,0,0)').bind(u,salt,await hashPin('123456',salt)).run();x=await env.DB.prepare('SELECT * FROM off_login WHERE uname=?').bind(u).first()}
    if(x.fails>=8)return J({e:'locked'},429);
    if((await hashPin(pw,x.salt))!==x.pw){await env.DB.prepare('UPDATE off_login SET fails=fails+1 WHERE uname=?').bind(u).run();return J({e:'bad'},401)}
    const tok=rnd(24);await env.DB.prepare('UPDATE off_login SET fails=0,token=? WHERE uname=?').bind(tok,u).run();
    return J({ok:1,token:tok,u,role:u==='BEO'?'BEO':'KP',label:u==='BEO'?'गटशिक्षणाधिकारी (BEO) – जत':'केंद्र: '+CEN[u],changed:x.changed?1:0});
  }
  const t=await offAuth(env,b);if(!t)return J({e:'auth'},401);
  const kp=t.uname!=='BEO';
  if(p==='/api/o/chpw'){
    const old=cl(b.old,40),nw=cl(b.nw,40);
    if(nw.length<6||nw==='123456')return J({e:'weak'},400);
    if((await hashPin(old,t.salt))!==t.pw)return J({e:'bad'},401);
    const salt=rnd(8);await env.DB.prepare('UPDATE off_login SET salt=?,pw=?,changed=1 WHERE uname=?').bind(salt,await hashPin(nw,salt),t.uname).run();
    return J({ok:1});
  }
  const ss=(kp?await env.DB.prepare('SELECT c.udise,c.code,s.name FROM sch_center c LEFT JOIN schools s ON s.udise=c.udise WHERE c.code=? ORDER BY c.udise').bind(t.uname).all():await env.DB.prepare('SELECT c.udise,c.code,s.name FROM sch_center c LEFT JOIN schools s ON s.udise=c.udise ORDER BY c.code,c.udise').all()).results;
  const ok=new Set(ss.map(x=>x.udise));
  if(p==='/api/o/sum'){
    const [f,d,ro,pm]=await Promise.all([
      env.DB.prepare('SELECT udise,upd,submitted,(SELECT COUNT(*) FROM json_each(data)) n FROM sch_form').all(),
      env.DB.prepare('SELECT udise,kind,SUM(got) g FROM sch_dist GROUP BY udise,kind').all(),
      env.DB.prepare('SELECT udise,COUNT(*) n FROM roster GROUP BY udise').all(),
      env.DB.prepare('SELECT udise,MAX(date) d,COUNT(*) c FROM pm_daily GROUP BY udise').all().catch(()=>({results:[]}))]);
    const F={},D={},R={},P={};f.results.forEach(x=>F[x.udise]=x);d.results.forEach(x=>{(D[x.udise]=D[x.udise]||{})[x.kind]=x.g});ro.results.forEach(x=>R[x.udise]=x.n);pm.results.forEach(x=>P[x.udise]=x);
    return J({ok:1,role:kp?'KP':'BEO',cen:CEN,rows:ss.map(s=>{const x=F[s.udise]||{},g=D[s.udise]||{};return{u:s.udise,nm:s.name||'',c:s.code,fn:x.n||0,fs:x.submitted||'',fu:x.upd||'',n:R[s.udise]||0,uni:g.uni||0,book:g.book||0,shoe:g.shoe||0,bag:g.bag||0,pm:(P[s.udise]||{}).d||'',pmc:(P[s.udise]||{}).c||0}})});
  }
  if(p==='/api/o/sna'){
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS school_sna(udise TEXT PRIMARY KEY, mhsn TEXT, bank TEXT, acct TEXT, ifsc TEXT, branch TEXT, hm TEXT, hm_mob TEXT, upd TEXT)").run();
    const q=(await env.DB.prepare('SELECT udise,mhsn,bank,acct,ifsc,branch FROM school_sna').all()).results;
    return J({ok:1,rows:q.filter(x=>ok.has(x.udise))});
  }
  if(p==='/api/o/timg'){
    const sh=cl(b.sh,20).toUpperCase().replace(/\s/g,''),t=await env.DB.prepare('SELECT udise FROM teachers WHERE shalarth=?').bind(sh).first();
    if(!t||!ok.has(t.udise))return J({e:'na'},403);
    const q=await env.DB.prepare('SELECT photo,sign,hami FROM tch_img WHERE shalarth=?').bind(sh).first().catch(()=>null);
    return J({ok:1,photo:q?q.photo:'',sign:q?q.sign:'',hami:q?q.hami:''});
  }
  if(p==='/api/o/stu'){
    const u=cl(b.udise,11).replace(/\D/g,'');
    if(u){if(!ok.has(u))return J({e:'na'},403);
      const q=(await env.DB.prepare('SELECT r.pen,r.name,r.cls,r.div,i.gender,i.dob,i.roll FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen WHERE r.udise=? ORDER BY r.cls,r.div,r.name').bind(u).all()).results;
      return J({ok:1,rows:q});}
    const q=(await env.DB.prepare('SELECT r.udise u,r.cls,COUNT(*) n,SUM(i.gender=\'M\') m,SUM(i.gender=\'F\') f FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen GROUP BY r.udise,r.cls').all()).results;
    return J({ok:1,rows:q.filter(x=>ok.has(x.u))});
  }
  if(p==='/api/o/teachers'){
    await slEnsure(env);const rs=(await env.DB.prepare('SELECT t.id,t.shalarth,t.name,t.mobile,t.udise,t.status,t.conf,s.name sc,(SELECT status FROM tch_edit e WHERE e.shalarth=t.shalarth) es FROM teachers t LEFT JOIN schools s ON s.udise=t.udise ORDER BY t.udise,t.name').all()).results;
    const cm={};ss.forEach(x=>cm[x.udise]=x.code);
    return J({ok:1,rows:rs.filter(x=>ok.has(x.udise)).map(x=>({id:x.id,sh:x.shalarth,n:x.name,m:x.mobile,u:x.udise,sc:x.sc||'',c:cm[x.udise],st:x.status,cf:x.conf?1:0,es:x.es||''}))});
  }
  if(p==='/api/o/tinfo'){
    const sh=cl(b.sh,20).toUpperCase().replace(/\s/g,''),t=await env.DB.prepare('SELECT t.name,t.mobile,t.udise,s.name sc FROM teachers t LEFT JOIN schools s ON s.udise=t.udise WHERE t.shalarth=?').bind(sh).first();
    if(!t||!ok.has(t.udise))return J({e:'na'},403);
    const q=await env.DB.prepare('SELECT data,upd FROM tch_info WHERE shalarth=?').bind(sh).first(),e=await env.DB.prepare('SELECT data,status,remark,upd,sub FROM tch_edit WHERE shalarth=?').bind(sh).first();
    const rc=(await env.DB.prepare('SELECT id,kind,fd,td,udise,typ,rm,status FROM tch_rec WHERE shalarth=? ORDER BY kind,fd').bind(sh).all()).results;
    return J({ok:1,name:t.name,mobile:t.mobile,udise:t.udise,sc:t.sc||'',data:q?q.data:'',upd:q?q.upd:'',ed:e||null,recs:rc});
  }
  if(p==='/api/o/treport'){
    await slEnsure(env);const fs=(Array.isArray(b.f)?b.f:[]).map(x=>cl(x,80)).filter(Boolean).slice(0,40);
    const uq=(Array.isArray(b.us)?b.us:[]).map(u=>cl(u,11).replace(/\D/g,'')).filter(u=>ok.has(u)).slice(0,90);const rs=(await env.DB.prepare('SELECT t.shalarth,t.name,t.udise,s.name sc,i.data FROM teachers t LEFT JOIN schools s ON s.udise=t.udise LEFT JOIN tch_info i ON i.shalarth=t.shalarth WHERE t.status=\'ok\''+(uq.length?' AND t.udise IN ('+uq.map(()=>'?').join(',')+')':'')+' ORDER BY t.udise,t.name').bind(...uq).all()).results;
    const cm={};ss.forEach(x=>cm[x.udise]=x.code);
    return J({ok:1,rows:rs.filter(x=>ok.has(x.udise)).map(x=>{let d={};try{d=JSON.parse(x.data||'{}')}catch(e){}const o={};fs.forEach(f=>{if(d[f]!=null)o[f]=d[f]});return{sh:x.shalarth,n:x.name,u:x.udise,sc:x.sc||'',c:cm[x.udise],d:o,h:x.data?1:0}})});
  }
  if(p==='/api/o/sreport'){
    await slEnsure(env);const ks=(Array.isArray(b.f)?b.f:[]).map(x=>cl(x,80)).filter(Boolean).slice(0,200),uq=(Array.isArray(b.us)?b.us:[]).map(u=>cl(u,11).replace(/\D/g,'')).filter(u=>ok.has(u));
    const q=(await env.DB.prepare('SELECT udise,data FROM sch_form').all()).results,F={};q.forEach(x=>F[x.udise]=x.data);
    const ex=ks.some(k=>k[0]==='@'),SN={},SB={},CK={};
    if(ex){
      (await env.DB.prepare('SELECT udise,mhsn,bank,acct,ifsc,branch FROM school_sna').all().catch(()=>({results:[]}))).results.forEach(x=>SN[x.udise]=x);
      (await env.DB.prepare('SELECT udise,tan,acct FROM school_bank').all().catch(()=>({results:[]}))).results.forEach(x=>SB[x.udise]=x);
      (await env.DB.prepare('SELECT udise,name,role,gender,bank,ifsc,acct,aadhaar,addr,pin FROM pm_cook ORDER BY udise,name').all().catch(()=>({results:[]}))).results.forEach(x=>(CK[x.udise]=CK[x.udise]||[]).push(x));
    }
    const J2=(a,f)=>a.map(f).join('; '),lg=g=>g==='F'?'महिला':g==='M'?'पुरुष':'';
    return J({ok:1,rows:ss.filter(x=>!uq.length||uq.includes(x.udise)).map(x=>{let o={};try{o=JSON.parse(F[x.udise]||'{}')}catch(e){}const d={};ks.forEach(k=>{if(k[0]!=='@'&&o[k]!=null&&o[k]!=='')d[k]=o[k]});
      if(ex){const n=SN[x.udise]||{},t=SB[x.udise]||{},c=CK[x.udise]||[],set=(k,v)=>{if(v!=null&&v!==''&&ks.includes(k))d[k]=v};
        set('@mhsn',n.mhsn);set('@sbank',n.bank);set('@sbranch',n.branch);set('@sacct',n.acct);set('@sifsc',n.ifsc);set('@tan',t.tan);set('@tacct',t.acct);
        if(ks.includes('@cn'))d['@cn']=String(c.length);
        set('@cnames',J2(c,y=>y.name));set('@crole',J2(c,y=>(y.role==='madatnis'?'मदतनीस':'स्वयंपाकी')+(lg(y.gender)?' ('+lg(y.gender)+')':'')));
        set('@cbank',J2(c,y=>[y.bank,y.acct,y.ifsc].filter(Boolean).join(', ')));set('@caddr',J2(c,y=>[y.addr,y.pin].filter(Boolean).join(' ')));
        set('@cadh',J2(c,y=>y.aadhaar?'XXXX-XXXX-'+String(y.aadhaar).slice(-4):''));}
      return{u:x.udise,sc:x.name||'',c:x.code,d}})});
  }
  if(p==='/api/o/vreport'){
    const uq=(Array.isArray(b.us)?b.us:[]).map(u=>cl(u,11).replace(/\D/g,'')).filter(u=>ok.has(u)).slice(0,90);
    if(!uq.length)return J({e:'scope'},400);
    const q=(await env.DB.prepare('SELECT r.pen,r.name,r.udise u,r.cls,r.div,r.med,i.gender,i.cat,i.tongue,i.status,i.dob,i.father,i.mother,i.mobile,i.addr,i.roll,i.gr,i.saral FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen WHERE r.udise IN ('+uq.map(()=>'?').join(',')+') ORDER BY r.udise,r.cls,r.div,r.name LIMIT 20000').bind(...uq).all()).results;
    return J({ok:1,rows:q});
  }
  if(p==='/api/o/bday'){
    const td=istDay(),mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(td.slice(5,7))-1],dd=parseInt(td.slice(8,10));
    const rs=(await env.DB.prepare("SELECT t.shalarth sh,t.name n,t.udise u,s.name sc,json_extract(i.data,'$.\"जन्मतारीख\"') dob FROM teachers t JOIN tch_info i ON i.shalarth=t.shalarth LEFT JOIN schools s ON s.udise=t.udise WHERE t.status='ok' AND json_extract(i.data,'$.\"जन्मतारीख\"') LIKE ?").bind(mo+' '+dd+', %').all().catch(()=>({results:[]}))).results;
    const cm={};ss.forEach(x=>cm[x.udise]=x.code);
    return J({ok:1,today:td,rows:rs.filter(x=>ok.has(x.u)).map(x=>({n:x.n,sh:x.sh,u:x.u,sc:x.sc||'',c:cm[x.u],y:parseInt(String(x.dob).slice(-4))||0}))});
  }
  if(p==='/api/o/tdecide'){
    const sh=cl(b.sh,20).toUpperCase().replace(/\s/g,''),t=await env.DB.prepare('SELECT udise FROM teachers WHERE shalarth=?').bind(sh).first();
    if(!t||!ok.has(t.udise))return J({e:'na'},403);
    const e=await env.DB.prepare('SELECT data,status FROM tch_edit WHERE shalarth=?').bind(sh).first();
    if(!e||e.status!=='Forwarded')return J({e:'state'},409);
    if(b.act==='ok'){
      const q=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(sh).first();let base={},ch={};try{base=JSON.parse(q&&q.data||'{}');ch=JSON.parse(e.data||'{}')}catch(x){}
      Object.assign(base,ch);
      await env.DB.batch([env.DB.prepare('INSERT INTO tch_info(shalarth,data,upd) VALUES(?,?,?) ON CONFLICT(shalarth) DO UPDATE SET data=excluded.data,upd=excluded.upd').bind(sh,JSON.stringify(base),istDay()),env.DB.prepare("UPDATE tch_edit SET status='Approved',remark='',data='{}',upd=? WHERE shalarth=?").bind(istDay(),sh),env.DB.prepare("UPDATE tch_rec SET status='Approved' WHERE shalarth=? AND status='Forwarded'").bind(sh)]);
      return J({ok:1,status:'Approved'});
    }
    if(b.act==='ret'){const rm=cl(b.remark,300);if(rm.length<3)return J({e:'remark'},400);await env.DB.batch([env.DB.prepare("UPDATE tch_edit SET status='Returned',remark=?,upd=? WHERE shalarth=?").bind(rm,istDay(),sh),env.DB.prepare("UPDATE tch_rec SET status='Returned' WHERE shalarth=? AND status='Forwarded'").bind(sh)]);return J({ok:1,status:'Returned'});}
    return J({e:'bad'},400);
  }
  if(p==='/api/o/form'){
    const us=(Array.isArray(b.udise)?b.udise:[b.udise]).map(u=>cl(u,11).replace(/\D/g,'')).filter(u=>ok.has(u)).slice(0,40);
    if(!us.length)return J({ok:1,rows:[]});
    const q=await env.DB.prepare('SELECT f.udise,s.name sc,f.data,f.upd,f.by,f.submitted FROM sch_form f LEFT JOIN schools s ON s.udise=f.udise WHERE f.udise IN ('+us.map(()=>'?').join(',')+')').bind(...us).all();
    return J({ok:1,rows:q.results});
  }
  return J({e:'nf'},404);
}
async function schoolApi(p,r,env){
  if(!p.startsWith('/api/s/'))return null;
  await slEnsure(env);const b=await body(r);
  if(p==='/api/s/login'){
    const u=cl(b.udise,11).replace(/\D/g,''),pw=cl(b.pw,40);
    if(u.length!==11)return J({e:'bad'},401);
    let sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(u).first();
    if(!sc){const sb=await env.DB.prepare('SELECT 1 x FROM school_bank WHERE udise=?').bind(u).first().catch(()=>null);if(!sb)return J({e:'bad'},401);sc={name:'UDISE '+u}}
    let x=await env.DB.prepare('SELECT * FROM school_login WHERE udise=?').bind(u).first();
    if(!x){const salt=rnd(8);await env.DB.prepare('INSERT OR IGNORE INTO school_login(udise,salt,pw,changed,fails) VALUES(?,?,?,0,0)').bind(u,salt,await hashPin('123456',salt)).run();x=await env.DB.prepare('SELECT * FROM school_login WHERE udise=?').bind(u).first()}
    if(x.fails>=8)return J({e:'locked'},429);
    if((await hashPin(pw,x.salt))!==x.pw){await env.DB.prepare('UPDATE school_login SET fails=fails+1 WHERE udise=?').bind(u).run();return J({e:'bad'},401)}
    const tok=rnd(24);await env.DB.prepare('UPDATE school_login SET fails=0,token=? WHERE udise=?').bind(tok,u).run();
    return J({ok:1,token:tok,udise:u,school:sc.name,changed:x.changed?1:0});
  }
  if(p==='/api/s/forgot'){
    const u=cl(b.udise,11).replace(/\D/g,''),nm=cl(b.name,60),mo=cl(b.mobile,10);
    if(u.length!==11||nm.length<2||!okMob(mo))return J({e:'bad'},400);
    const ok=await env.DB.prepare('SELECT 1 x FROM schools WHERE udise=?').bind(u).first()||await env.DB.prepare('SELECT 1 x FROM school_bank WHERE udise=?').bind(u).first().catch(()=>null);
    if(!ok)return J({e:'bad'},400);
    await env.DB.prepare('INSERT INTO pw_req(udise,name,mobile,ts) VALUES(?,?,?,?) ON CONFLICT(udise) DO UPDATE SET name=excluded.name,mobile=excluded.mobile,ts=excluded.ts').bind(u,nm,mo,new Date(Date.now()+19800000).toISOString().slice(0,16).replace('T',' ')).run();
    return J({ok:1});
  }
  const t=await schoolAuth(env,b);if(!t)return J({e:'auth'},401);
  if(p==='/api/s/chpw'){
    const old=cl(b.old,40),nw=cl(b.nw,40);
    if(nw.length<6||nw==='123456')return J({e:'weak'},400);
    if((await hashPin(old,t.salt))!==t.pw)return J({e:'bad'},401);
    const salt=rnd(8);await env.DB.prepare('UPDATE school_login SET salt=?,pw=?,changed=1 WHERE udise=?').bind(salt,await hashPin(nw,salt),t.udise).run();
    return J({ok:1});
  }
  if(p==='/api/s/dist'){
    const k=cl(b.kind,10);if(!SCH_DIST.includes(k))return J({e:'bad'},400);
    const rows=(await env.DB.prepare('SELECT r.pen,r.cls,r.div,r.name,r.med,s.gender,d.got,d.date,d.sz1,d.sz2 FROM roster r LEFT JOIN sinfo s ON s.pen=r.pen LEFT JOIN sch_dist d ON d.pen=r.pen AND d.udise=r.udise AND d.kind=? WHERE r.udise=? ORDER BY r.cls,r.div,r.name LIMIT 1000').bind(k,t.udise).all()).results;
    return J({ok:1,rows});
  }
  if(p==='/api/s/distsave'){
    const k=cl(b.kind,10);if(!SCH_DIST.includes(k))return J({e:'bad'},400);
    const now=istDay(),st=[];
    for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,200)){
      const pen=cl(x.pen,11).replace(/\D/g,'');if(pen.length!==11)continue;
      const s1=cl(x.s1,10),s2=cl(x.s2,10);
      if(!x.got&&!s1&&!s2){st.push(env.DB.prepare('DELETE FROM sch_dist WHERE udise=? AND kind=? AND pen=?').bind(t.udise,k,pen));continue}
      const d=x.got&&/^\d{4}-\d\d-\d\d$/.test(x.date||'')?x.date:'';
      st.push(env.DB.prepare('INSERT INTO sch_dist(udise,kind,pen,got,date,upd,sz1,sz2) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM roster WHERE pen=? AND udise=?) ON CONFLICT(udise,kind,pen) DO UPDATE SET got=excluded.got,date=excluded.date,upd=excluded.upd,sz1=excluded.sz1,sz2=excluded.sz2').bind(t.udise,k,pen,x.got?1:0,d,now,s1,s2,pen,t.udise));
    }
    if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length});
  }
  if(p==='/api/s/reqs'||p==='/api/s/reqsub'){
    const nm=((await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first())||{}).name||t.udise;
    if(p==='/api/s/reqs')return J({ok:1,rows:await rqList(env,'s','s',t.udise)});
    return rqSub(env,'s','s',t.udise,nm,t.udise,b);
  }
  if(p==='/api/s/form'){
    const x=await env.DB.prepare('SELECT data,upd,by,submitted FROM sch_form WHERE udise=?').bind(t.udise).first();
    let d={};try{d=x&&x.data?JSON.parse(x.data):{}}catch(e){}
    return J({ok:1,data:d,upd:x?x.upd:'',by:x?x.by:'',submitted:x?x.submitted:''});
  }
  if(p==='/api/s/formsave'){
    const ch=b.data&&typeof b.data==='object'?b.data:{};
    const x=await env.DB.prepare('SELECT data FROM sch_form WHERE udise=?').bind(t.udise).first();
    let d={};try{d=x&&x.data?JSON.parse(x.data):{}}catch(e){}
    for(const k of Object.keys(ch).slice(0,400)){
      if(!/^[A-Z0-9_]{2,60}(#\d{1,2})?$/.test(k))continue;
      const v=ch[k];
      if(v===null||v===''||(Array.isArray(v)&&!v.length)){delete d[k];continue}
      d[k]=Array.isArray(v)?v.slice(0,20).map(s=>cl(s,80)):cl(v,1000);
    }
    const js=JSON.stringify(d);if(js.length>150000)return J({e:'big'},400);
    const sub=b.submit?istDay():null;
    await env.DB.prepare('INSERT INTO sch_form(udise,data,upd,by,submitted) VALUES(?,?,?,?,?) ON CONFLICT(udise) DO UPDATE SET data=excluded.data,upd=excluded.upd,by=excluded.by,submitted=COALESCE(excluded.submitted,sch_form.submitted)').bind(t.udise,js,istDay(),cl(b.by,40),sub).run();
    return J({ok:1,n:Object.keys(d).length});
  }
  if(p==='/api/s/books'){
    const rs=(await env.DB.prepare('SELECT cls,names FROM sch_books WHERE udise=?').bind(t.udise).all()).results;
    return J({ok:1,rows:rs});
  }
  if(p==='/api/s/bookssave'){
    const c=cl(b.cls,3).replace(/\D/g,'');if(!c)return J({e:'bad'},400);
    const nm=(Array.isArray(b.names)?b.names:[]).map(x=>cl(x,40)).filter(Boolean).slice(0,15);
    if(!nm.length)await env.DB.prepare('DELETE FROM sch_books WHERE udise=? AND cls=?').bind(t.udise,c).run();
    else await env.DB.prepare('INSERT INTO sch_books(udise,cls,names) VALUES(?,?,?) ON CONFLICT(udise,cls) DO UPDATE SET names=excluded.names').bind(t.udise,c,JSON.stringify(nm)).run();
    return J({ok:1});
  }
  if(p==='/api/s/bank'){
    const g=async(q,...a)=>{try{return await env.DB.prepare(q).bind(...a).first()}catch(e){return null}};
    const ga=async(q,...a)=>{try{return (await env.DB.prepare(q).bind(...a).all()).results}catch(e){return []}};
    const pm=await g('SELECT tan,acct FROM school_bank WHERE udise=?',t.udise);
    const sna=await g('SELECT mhsn,bank,branch,acct,ifsc,hm,hm_mob FROM school_sna WHERE udise=?',t.udise);
    const cooks=await ga('SELECT name,role,bank,ifsc,acct FROM pm_cook WHERE udise=? ORDER BY name',t.udise);
    const own=await ga('SELECT kind,holder,bank,branch,acct,ifsc,upd FROM sch_bank WHERE udise=?',t.udise);
    const o={};own.forEach(x=>o[x.kind]=x);
    return J({ok:1,pm:pm||{},sna:sna||{},cooks,own:o});
  }
  if(p==='/api/s/banksave'){
    const kind=b.kind==='shalarth'||b.kind==='nbs'?b.kind:'';if(!kind)return J({e:'bad'},400);
    const f=b.f||{},acct=cl(f.acct,24).replace(/\s/g,''),ifsc=cl(f.ifsc,11).toUpperCase().replace(/\s/g,'');
    if(acct&&!/^\d{9,18}$/.test(acct))return J({e:'acct'},400);
    if(ifsc&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))return J({e:'ifsc'},400);
    await env.DB.prepare('INSERT INTO sch_bank(udise,kind,holder,bank,branch,acct,ifsc,upd,by) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,kind) DO UPDATE SET holder=excluded.holder,bank=excluded.bank,branch=excluded.branch,acct=excluded.acct,ifsc=excluded.ifsc,upd=excluded.upd,by=excluded.by').bind(t.udise,kind,cl(f.holder,80),cl(f.bank,80),cl(f.branch,80),acct,ifsc,istDay(),cl(b.by,40)).run();
    return J({ok:1});
  }
  if(p==='/api/s/comm'){
    const rows=(await env.DB.prepare('SELECT cid,id,name,desig,mtype,mobile,joined,active FROM sch_cmember WHERE udise=? ORDER BY cid,id').bind(t.udise).all()).results;
    return J({ok:1,committees:SCH_COMM.map(c=>({id:c[0],name:c[1],members:rows.filter(x=>x.cid===c[0]).map(x=>({name:x.name,desig:x.desig,type:x.mtype,mobile:x.mobile,joined:x.joined,active:x.active?'Yes':'No'}))}))});
  }
  if(p==='/api/s/commsave'){
    const cid=cl(b.id,8);if(!SCH_COMM.some(c=>c[0]===cid))return J({e:'bad'},400);
    const ms=(Array.isArray(b.members)?b.members:[]).slice(0,40),st=[env.DB.prepare('DELETE FROM sch_cmember WHERE udise=? AND cid=?').bind(t.udise,cid)];let i=0;
    for(const m of ms){const nm=cl(m.name,80),mo=cl(m.mobile,10).replace(/\D/g,'');if(nm.length<2)continue;
      st.push(env.DB.prepare('INSERT INTO sch_cmember(udise,cid,id,name,desig,mtype,mobile,joined,active) VALUES(?,?,?,?,?,?,?,?,?)').bind(t.udise,cid,++i,nm,cl(m.desig,30),cl(m.type,40),mo,/^\d{4}-\d\d-\d\d$/.test(m.joined||'')?m.joined:'',m.active==='No'?0:1))}
    await env.DB.batch(st);return J({ok:1,n:i});
  }
  if(p==='/api/s/me'){const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();return J({ok:1,udise:t.udise,school:sc?sc.name:'',changed:t.changed?1:0})}
  return J({e:'nf'},404);
}
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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_cfg(udise TEXT PRIMARY KEY, grp TEXT)"),
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
async function pmSg(env,u){const c=await env.DB.prepare('SELECT grp FROM pm_cfg WHERE udise=?').bind(u).first();if(c&&c.grp)return c.grp;const r=await env.DB.prepare('SELECT MIN(cls) a,MAX(cls) z FROM roster WHERE udise=?').bind(u).first();if(r&&r.a){if(r.z<=5)return '15';if(r.a>=6)return '68'}return 'both'}
const PM_ITEMS=['तांदूळ','हिरवा वाटाणा','मुगडाळ','चवळी','हरभरा','सोयाबडी','मसूरडाळ','मटकी','मूग','तूरडाळ','हळद','मीठ','कांदा लसूण मसाला','जिरे','मोहरी','मिरची पावडर','गरम मसाला','तेल'];
const istDay=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const dOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s));
async function pmApi(p,r,env){
  if(!p.startsWith('/api/pm/'))return null;
  const b=await body(r),t=await schoolAuth(env,b);
  if(!t)return J({e:'auth'},401);
  await pmEnsure(env);
  const u=t.udise,by=cl(b.by,40)||'शाळा';
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
  if(p==='/api/pm/cfgsave'){const g=['15','68','both'].includes(b.grp)?b.grp:'both';await env.DB.prepare('INSERT INTO pm_cfg(udise,grp) VALUES(?,?) ON CONFLICT(udise) DO UPDATE SET grp=excluded.grp').bind(u,g).run();return J({ok:1})}
  if(p==='/api/pm/sbank'){const x=await env.DB.prepare('SELECT tan,acct FROM school_bank WHERE udise=?').bind(u).first();return J({ok:1,tan:x?x.tan:'',acct:x?x.acct:''})}
  if(p==='/api/pm/cooks'){
    const rows=(await env.DB.prepare('SELECT id,name,role,gender,bank,ifsc,acct,aadhaar,addr,pin FROM pm_cook WHERE udise=? ORDER BY name').bind(u).all()).results;
    const mk=s=>s?'XXXX'+String(s).slice(-4):'',ma=s=>s?'XXXX XXXX '+String(s).slice(-4):'';
    return J({ok:1,rows:rows.map(x=>({id:x.id,name:x.name,role:x.role,gender:x.gender,bank:x.bank,ifsc:x.ifsc,acct:mk(x.acct),aadhaar:ma(x.aadhaar),addr:x.addr,pin:x.pin}))});
  }
  if(p==='/api/pm/cookget'||p==='/api/pm/cooksave'||p==='/api/pm/cookdel')return J({e:'off'},403);
  if(false&&p==='/api/pm/cookget'){
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
    return J({ok:1,fy,udise:u,school:sc?sc.name:'',teacher:by,daily:d,stock:st,rcpt:rc,hol,rate:(await env.DB.prepare('SELECT d,r15,r68 FROM pm_rate ORDER BY d').all()).results,sg:await pmSg(env,u),cookn:((await env.DB.prepare('SELECT COUNT(*) c FROM pm_cook WHERE udise=?').bind(u).first())||{}).c||0});
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
  {const sr=await schoolApi(p,r,env);if(sr)return sr}
  {const orr=await offApi(p,r,env);if(orr)return orr}
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
  if(p==='/api/ai/lesson'){
    const s=await me(env,r);if(!s)return J({e:'auth'},401);
    const b=await body(r),kn=/kn|कन्नड|kannada/i.test(String(s.med||'')),mc=kn?'kn':'mr',path=cl(b.path,300);
    if(!path.startsWith(mc+'-lessons/'))return J({e:'bad'},400);
    const mode=['sum','quiz','ask','words','qa'].includes(b.mode)?b.mode:'quiz',les=cl(b.les,200),sub=cl(b.sub,80),cls=String(s.cls||'');
    const LG=(x=>{if(/हिंदी|हिन्दी|ಹಿಂದಿ|hindi/i.test(x))return['Hindi (Devanagari script)','["सही","गलत"]','जोड़ी मिलाइए'];if(/इंग्रजी|इंग्लिश|अंग्रेजी|अंग्रेज़ी|english|ಇಂಗ್ಲಿಷ್|ಇಂಗ್ಲೀಷ್|ಆಂಗ್ಲ/i.test(x))return['English','["True","False"]','Match the pairs'];if(/मराठी|marathi|ಮರಾಠಿ/i.test(x))return['Marathi (Devanagari script)','["बरोबर","चूक"]','जोड्या लावा'];if(/कन्नड|kannada|ಕನ್ನಡ/i.test(x))return['Kannada (ಕನ್ನಡ script)','["ಸರಿ","ತಪ್ಪು"]','ಜೋಡಿಸಿ'];return kn?['Kannada (ಕನ್ನಡ script)','["ಸರಿ","ತಪ್ಪು"]','ಜೋಡಿಸಿ']:['Marathi (Devanagari script)','["बरोबर","चूक"]','जोड्या लावा']})(sub),lang=LG[0];
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ai_sum(path TEXT PRIMARY KEY, t TEXT, upd TEXT)").run();
    const ck=mode==='sum'?path:mode==='words'?path+'#w':mode==='qa'?path+'#qa':'';
    if(ck){const c=await env.DB.prepare('SELECT t FROM ai_sum WHERE path=?').bind(ck).first();if(c&&c.t){if(mode==='sum')return J({ok:1,t:c.t,cached:1});try{return J({ok:1,l:JSON.parse(c.t),cached:1})}catch(e){}}}
    const pdf=await lessonPdf(env,path);if(!pdf)return J({e:'nopdf'},404);
    const day=istDay(),ctx='Class: '+cls+'\nSubject: '+sub+'\nLesson: '+les,PD={inlineData:{mimeType:'application/pdf',data:pdf}};
    const parseJ=(tx,k)=>{try{const s2=tx.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(),a=s2.search(/[\[{]/),z=Math.max(s2.lastIndexOf('}'),s2.lastIndexOf(']'));const o=JSON.parse(s2.slice(a,z+1));return k?o[k]:o}catch(e){return null}};
    let g;
    if(mode==='sum'){
      const si='You are a friendly Maharashtra State Board primary-school teacher. Using ONLY the attached textbook lesson PDF, write a summary for a class '+cls+' child. Write everything in '+lang+'. Format (plain text, use ** for bold, • for bullets): 1) one line: what this lesson is about; 2) 5 to 8 key points as • bullets; 3) "important words" with simple meanings (up to 6); 4) one thinking question at the end. Maximum 250 words. Do not add facts that are not in the lesson.';
      g=await gemAsk(env,si,[{role:'user',parts:[PD,{text:ctx}]}]);
      if(!g.t)return J({e:g.e==='nokey'?'nokey':'fail'},503);
      await env.DB.prepare('INSERT INTO ai_sum(path,t,upd) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET t=excluded.t,upd=excluded.upd').bind(path,g.t,day).run();
      return J({ok:1,t:g.t});
    }
    if(mode==='words'||mode==='qa'){
      const si=mode==='words'
        ?'You are a primary-school teacher. From the attached textbook lesson PDF (class '+cls+') pick 10 to 14 important or difficult words a child should learn. Write in '+lang+'. Output ONLY JSON: {"items":[{"w":"word as in the lesson","m":"simple meaning or short explanation in one line"}]}. Use only words from the lesson.'
        :'You are a primary-school teacher. From the attached textbook lesson PDF (class '+cls+') write 8 to 10 important exam-style questions with short model answers (1-3 sentences) that a child can learn. Write in '+lang+'. Output ONLY JSON: {"items":[{"q":"question","a":"short model answer"}]}. Use only facts from the lesson.';
      g=await gemAsk(env,si,[{role:'user',parts:[PD,{text:ctx}]}],{temperature:.4,responseMimeType:'application/json'});
      if(!g.t)return J({e:g.e==='nokey'?'nokey':'fail'},503);
      const it=parseJ(g.t,'items'),out=(Array.isArray(it)?it:[]).slice(0,14).map(x=>mode==='words'?{w:cl(x&&x.w,80),m:cl(x&&x.m,300)}:{q:cl(x&&x.q,300),a:cl(x&&x.a,600)}).filter(x=>mode==='words'?x.w&&x.m:x.q&&x.a);
      if(out.length<3)return J({e:'parse'},502);
      await env.DB.prepare('INSERT INTO ai_sum(path,t,upd) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET t=excluded.t,upd=excluded.upd').bind(ck,JSON.stringify(out),day).run();
      return J({ok:1,l:out});
    }
    if(mode==='ask'){
      const hs=[];for(const x of (Array.isArray(b.m)?b.m:[]).slice(-8)){const role=x&&x.r==='a'?'model':'user',tx=cl(x&&x.t,600);if(!tx)continue;if(hs.length&&hs[hs.length-1].role===role)hs.pop();hs.push({role,parts:[{text:tx}]})}
      while(hs.length&&hs[0].role!=='user')hs.shift();
      if(!hs.length||hs[hs.length-1].role!=='user')return J({e:'empty'},400);
      const si='You are a kind AI teacher for a class '+cls+' child (Maharashtra State Board). The attached PDF is the textbook lesson the child is studying. Answer ONLY about this lesson and its subject, using the lesson as your main source. Always reply in '+lang+' (the language of this subject), even if the child writes in another language, in very simple short sentences (max 120 words). Explain step by step; for maths show steps. If asked to explain simply, use an everyday example. If the question is unrelated to studies or unsafe, politely refuse and bring the child back to the lesson. Never ask for personal information. If the lesson does not contain the answer, say so and suggest asking the teacher. End with one tiny practice question when it fits.';
      g=await gemAsk(env,si,[{role:'user',parts:[PD,{text:ctx}]},{role:'model',parts:[{text:'OK'}]}].concat(hs));
      if(!g.t)return J({e:g.e==='nokey'?'nokey':'fail'},503);
      return J({ok:1,t:g.t});
    }
    const N=b.n===5?5:20,ty=['fill','tf','mcq','match','mix'].includes(b.type)?b.type:'mix',lv={easy:'EASY: direct recall of facts from the lesson',med:'MEDIUM: understanding, reasons and simple inference',hard:'HARD: application, reasoning and tricky distractors'}[b.level]||'MEDIUM: understanding, reasons and simple inference';
    const tfo=LG[1],ms=N===5?2:5;
    const dist={fill:'Make exactly '+N+' questions, all type "fill".',tf:'Make exactly '+N+' questions, all type "tf".',mcq:'Make exactly '+N+' questions, all type "mcq".',match:'Make exactly '+ms+' questions, all type "match" (each with 4 pairs).',mix:N===5?'Make exactly 5 questions: 1 "fill", 1 "tf", 2 "mcq", 1 "match", in shuffled order.':'Make exactly 20 questions: 6 "fill", 5 "tf", 6 "mcq", 3 "match", in shuffled order.'}[ty];
    const avoid=(Array.isArray(b.avoid)?b.avoid:[]).slice(0,40).map(x=>cl(x,90)).filter(Boolean);
    const si='You are a Maharashtra State Board primary-school teacher making a self-practice quiz for a class '+cls+' child. Use ONLY the attached textbook lesson PDF as the source; never add facts that are not in the lesson. Write ALL text (questions, options, explanations) in '+lang+'. Keep language simple and child-friendly. Difficulty: '+lv+'. '+dist+' Cover different parts of the lesson; no two questions may test the same fact.'
     +' Output ONLY JSON: {"questions":[...]}. Schemas: fill: {"type":"fill","q":"sentence with ____ blank","options":[4 strings],"answer":index_of_correct_option,"explanation":"one short line"}; tf: {"type":"tf","q":"statement","options":'+tfo+',"answer":0_or_1_index_of_correct_option,"explanation":"..."}; mcq: {"type":"mcq","q":"question","options":[4 strings],"answer":index,"explanation":"..."}; match: {"type":"match","q":"'+LG[2]+'","pairs":[[left,right],[left,right],[left,right],[left,right]],"explanation":""}. Spread the correct answer position randomly across questions.'
     +(avoid.length?' The child already practised the questions below. Do NOT repeat or paraphrase them; ask about other facts:\n- '+avoid.join('\n- '):'')+'\nVariation token (make this set different from any other): '+Math.random().toString(36).slice(2,8);
    g=await gemAsk(env,si,[{role:'user',parts:[PD,{text:ctx}]}],{temperature:1.1,responseMimeType:'application/json'});
    if(!g.t)return J({e:g.e==='nokey'?'nokey':'fail'},503);
    const q=parseJ(g.t,'questions'),out=[];
    for(const z of (Array.isArray(q)?q:[])){
      const t0=['fill','tf','mcq','match'].includes(z.type)?z.type:'';if(!t0)continue;const e0=cl(z.explanation,300);
      if(t0==='match'){const pr=(Array.isArray(z.pairs)?z.pairs:[]).filter(a=>Array.isArray(a)&&a.length>=2).slice(0,5).map(a=>[cl(a[0],80),cl(a[1],80)]).filter(a=>a[0]&&a[1]);if(pr.length>=3)out.push({type:t0,q:cl(z.q,100),pairs:pr,e:e0});continue}
      const op=(Array.isArray(z.options)?z.options:[]).slice(0,4).map(o=>cl(o,150)),an=parseInt(z.answer);
      if(op.length<2||!(an>=0&&an<op.length)||!cl(z.q,400))continue;out.push({type:t0,q:cl(z.q,400),options:op,answer:an,e:e0});
    }
    if(out.length<Math.min(5,N))return J({e:'parse'},502);
    return J({ok:1,q:out.slice(0,20)});
  }
  if(p==='/api/ai/score'){
    const s=await me(env,r);if(!s)return J({e:'auth'},401);const b=await body(r);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ai_score(id INTEGER PRIMARY KEY AUTOINCREMENT, sid INTEGER, ts TEXT, sub TEXT, les TEXT, ty TEXT, lv TEXT, score INTEGER, total INTEGER, kind TEXT)").run();
    const sc=parseInt(b.score),tt=parseInt(b.total);if(!(tt>=1&&tt<=20&&sc>=0&&sc<=tt))return J({e:'bad'},400);
    await env.DB.prepare('INSERT INTO ai_score(sid,ts,sub,les,ty,lv,score,total,kind) VALUES(?,?,?,?,?,?,?,?,?)').bind(s.id,istDay(),cl(b.sub,60),cl(b.les,120),cl(b.type,10),cl(b.level,6),sc,tt,b.kind==='daily'?'daily':'quiz').run();
    return J({ok:1});
  }
  if(p==='/api/t/aiscores'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const cls=parseInt(b.cls)||0,dv=cl(b.div,2).toUpperCase(),ud=cl(b.udise,11);
    if(!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,ud,cls,dv).first())return J({e:'nf'},404);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ai_score(id INTEGER PRIMARY KEY AUTOINCREMENT, sid INTEGER, ts TEXT, sub TEXT, les TEXT, ty TEXT, lv TEXT, score INTEGER, total INTEGER, kind TEXT)").run();
    const rows=(await env.DB.prepare("SELECT r.pen,r.name,COUNT(a.id) n,ROUND(AVG(100.0*a.score/a.total)) avg,MAX(a.ts) last FROM roster r LEFT JOIN students s ON s.mobile='P'||r.pen LEFT JOIN ai_score a ON a.sid=s.id WHERE r.udise=? AND r.cls=? AND r.div=? GROUP BY r.pen ORDER BY r.name").bind(ud,cls,dv).all()).results;
    let det=[];const pen=cl(b.pen,11).replace(/\D/g,'');
    if(pen.length===11)det=(await env.DB.prepare("SELECT a.ts,a.sub,a.les,a.score,a.total,a.lv,a.kind FROM ai_score a JOIN students s ON s.id=a.sid JOIN roster r ON 'P'||r.pen=s.mobile WHERE r.pen=? AND r.udise=? ORDER BY a.id DESC LIMIT 20").bind(pen,ud).all()).results;
    return J({ok:1,rows,det});
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
    const known=await env.DB.prepare('SELECT 1 x FROM schools WHERE udise=?').bind(udise).first()||await env.DB.prepare('SELECT 1 x FROM roster WHERE udise=? LIMIT 1').bind(udise).first();
    const ins=known?await env.DB.prepare('INSERT INTO teachers(shalarth,name,mobile,udise,salt,pw) VALUES(?,?,?,?,?,?)').bind(sh,name,mob,udise,salt,h).run():await env.DB.prepare("INSERT INTO teachers(shalarth,name,mobile,udise,salt,pw,status) VALUES(?,?,?,?,?,?,'ok')").bind(sh,name,mob,udise,salt,h).run();
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
    if(u.length!==11)return J({e:'nf'},404);
    if(!await env.DB.prepare('SELECT 1 x FROM schools WHERE udise=?').bind(u).first()){if(!b.nolist)return J({e:'nf'},404)}
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
  if(p==='/api/t/delcls'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const k=parseInt(b.cls)||0,dv=cl(b.div,2).toUpperCase();if(k<1||k>8||!/^[A-Z]{1,2}$/.test(dv))return J({e:'args'});
    await env.DB.prepare('DELETE FROM tclasses WHERE tid=? AND cls=? AND div=?').bind(t.id,k,dv).run();return J({ok:1});
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
  if(p==='/api/t/info'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const [i,e]=await Promise.all([env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first(),env.DB.prepare('SELECT data,status,remark,upd,sub FROM tch_edit WHERE shalarth=?').bind(t.shalarth).first()]);
    return J({ok:1,sc:await scn(env,t),base:i?i.data:'{}',ed:e||{data:'{}',status:'',remark:''}});
  }
  if(p==='/api/t/infosave'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const e=await env.DB.prepare('SELECT data,status FROM tch_edit WHERE shalarth=?').bind(t.shalarth).first();
    if(e&&e.status==='Forwarded')return J({e:'locked'},409);
    let d={};try{d=JSON.parse(e&&e.data||'{}')}catch(x){}
    const NE=new Set(TNE);let n=0;
    if(b.d&&typeof b.d==='object')for(const k of Object.keys(b.d)){if(n++>150)break;const kk=cl(k,80);if(!kk||NE.has(kk))continue;const v=cl(b.d[k],600);if(v==='')delete d[kk];else d[kk]=v}
    const js=JSON.stringify(d);if(js.length>60000)return J({e:'big'},400);
    const sub=b.submit?1:0,st=sub?'Forwarded':'Draft';
    await env.DB.prepare("INSERT INTO tch_edit(shalarth,data,status,remark,upd,sub) VALUES(?,?,?,?,?,?) ON CONFLICT(shalarth) DO UPDATE SET data=excluded.data,status=excluded.status,remark=CASE WHEN excluded.status='Forwarded' THEN '' ELSE tch_edit.remark END,upd=excluded.upd,sub=CASE WHEN excluded.status='Forwarded' THEN excluded.sub ELSE tch_edit.sub END").bind(t.shalarth,js,st,'',istDay(),sub?istDay():'').run();
    if(sub)await env.DB.prepare("UPDATE tch_rec SET status='Forwarded' WHERE shalarth=? AND status IN ('Draft','Returned')").bind(t.shalarth).run();
    return J({ok:1,status:st});
  }
  if(p==='/api/t/recs'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    return J({ok:1,rows:(await env.DB.prepare('SELECT id,kind,fd,td,udise,typ,rm,status FROM tch_rec WHERE shalarth=? ORDER BY kind,fd').bind(t.shalarth).all()).results});
  }
  if(p==='/api/t/recsave'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const k=b.kind==='S'?'S':'L',dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(cl(v,10))?cl(v,10):'',fd=dt(b.fd),td=dt(b.td);
    if(!fd||!td||td<fd)return J({e:'date'},400);
    const ud=cl(b.udise,11).replace(/\D/g,''),ty=cl(b.typ,60),rm=cl(b.rm,200);
    if(!ty)return J({e:'typ'},400);
    const n=(await env.DB.prepare('SELECT COUNT(*) c FROM tch_rec WHERE shalarth=?').bind(t.shalarth).first()).c;if(n>=300)return J({e:'max'},400);
    await env.DB.prepare("INSERT INTO tch_rec(shalarth,kind,fd,td,udise,typ,rm,status,upd) VALUES(?,?,?,?,?,?,?,'Draft',?)").bind(t.shalarth,k,fd,td,ud,ty,rm,istDay()).run();
    return J({ok:1});
  }
  if(p==='/api/t/recdel'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    await env.DB.prepare("DELETE FROM tch_rec WHERE id=? AND shalarth=? AND status IN ('Draft','Returned')").bind(parseInt(b.id)||0,t.shalarth).run();
    return J({ok:1});
  }
  if(p==='/api/t/plopts'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const have=(await env.DB.prepare('SELECT DISTINCT medium m,cls c FROM syl').all()).results,HS=new Set(have.map(x=>x.m+'|'+x.c));
    const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();let tm='';try{tm=JSON.parse(ti&&ti.data||'{}')['अध्यापनाचे माध्यम']||''}catch(e){}
    const fb=tm==='कन्नड'?'कन्नड':'मराठी',MP={kn:'कन्नड',mr:'मराठी'};
    const tc=(await env.DB.prepare('SELECT DISTINCT udise,cls,div FROM tclasses WHERE tid=?').bind(t.id).all()).results,out=[],seen=new Set();
    for(const x of tc){const q=await env.DB.prepare('SELECT med,COUNT(*) n FROM roster WHERE udise=? AND cls=? AND div=? GROUP BY med ORDER BY n DESC LIMIT 1').bind(x.udise,x.cls,x.div).first();const m=(q&&MP[q.med])||fb,k=m+'|'+x.cls;if(!seen.has(k)&&HS.has(k)){seen.add(k);out.push({m:m,c:String(x.cls)})}}
    if(!out.length)have.filter(x=>x.m===fb).forEach(x=>out.push({m:x.m,c:x.c}));
    out.sort((a,b)=>(parseInt(a.c)||0)-(parseInt(b.c)||0));
    return J({ok:1,rows:out,mine:tc.length>0});
  }
  if(p==='/api/t/plan'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const m=cl(b.medium,40),c=cl(b.cls,6);if(!m||!c)return J({e:'bad'},400);
    const rs=(await env.DB.prepare('SELECT month mo,week w,subject s,topic t,tname tn FROM syl WHERE medium=? AND cls=? ORDER BY id').bind(m,c).all()).results;
    const sc=await env.DB.prepare('SELECT s.name FROM schools s WHERE s.udise=?').bind(t.udise).first();
    return J({ok:1,rows:rs,teacher:t.name,school:sc?sc.name:'',udise:t.udise});
  }
  if(p==='/api/t/tt'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const cs=(await env.DB.prepare('SELECT DISTINCT cls c FROM tt').all()).results.map(x=>x.c).sort((a,b)=>(parseInt(a)||0)-(parseInt(b)||0));
    const mine=(await env.DB.prepare('SELECT DISTINCT cls c FROM tclasses WHERE tid=? ORDER BY cls').bind(t.id).all()).results.map(x=>String(x.c));
    const c=cl(b.cls,4);let rows=[];
    if(c)rows=(await env.DB.prepare('SELECT period p,d1,d2,d3,d4,d5,d6,t1,t2,t3,t4,t5,t6,rtype r FROM tt WHERE cls=? ORDER BY id').bind(c).all()).results;
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();
    return J({ok:1,classes:cs,mine:mine,rows:rows,teacher:t.name,school:sc?sc.name:'',udise:t.udise});
  }
  if(p==='/api/t/tachan'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const c=cl(b.cls,4),dm=cl(b.date,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!c||!dm)return J({e:'bad'},400);
    const dt=new Date(Date.UTC(+dm[1],+dm[2]-1,+dm[3])),wd=dt.getUTCDay();if(wd===0)return J({ok:1,rows:[],day:0,cls:c});
    const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'],mo=MONTHS[+dm[2]-1],wk=Math.min(4,Math.ceil(+dm[3]/7));
    const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();let tm='';try{tm=JSON.parse(ti&&ti.data||'{}')['अध्यापनाचे माध्यम']||''}catch(e){}
    const rq=await env.DB.prepare('SELECT med,COUNT(*) n FROM roster WHERE udise=? AND cls=? GROUP BY med ORDER BY n DESC LIMIT 1').bind(t.udise,c).first();
    const med=(rq&&({kn:'कन्नड',mr:'मराठी'})[rq.med])||(tm==='कन्नड'?'कन्नड':'मराठी'),kn=med==='कन्नड';
    const av=new Set((await env.DB.prepare('SELECT DISTINCT subject s FROM syl WHERE medium=? AND cls=?').bind(med,c).all()).results.map(x=>x.s));
    const A=kn?{'मराठी':['मराठी-सुगमभारती','ಕನ್ನಡ'],'गणित':['ಗಣಿತ'],'इंग्रजी':['इंग्रजी'],'आस जग १':['ಪರಿಸರ ಅಭ್ಯಾಸ - ೧'],'परिसर अभ्यास १':['ಪರಿಸರ ಅಭ್ಯಾಸ - ೧'],'आस जग २':['ಪರಿಸರ ಅಭ್ಯಾಸ - ೨'],'परिसर अभ्यास २':['ಪರಿಸರ ಅಭ್ಯಾಸ - ೨'],'इतिहास':['ಇತಿಹಾಸ','ಇತಿಹಾಸ - ನಾಗರಿಕಶಾಶ್ತ್ರ','ನಾಗರಿಕ ಶಾಸ್ತ್ರ'],'भूगोल':['ಭೂಗೋಲ'],'विज्ञान':['ಸಾಮಾನ್ಯ ವಿಜ್ಞಾನ'],'हिंदी':['हिंदी-सुगमभारती'],'कलाशिक्षण':['ಕಲಿಯೋಣ'],'शिकू (कलाशिक्षण)':['ಕಲಿಯೋಣ'],'कार्यशिक्षण':['ಮಾಡೋಣ'],'करू (कार्यशिक्षण)':['ಮಾಡೋಣ'],'शाशि':['ಆಡೋಣ'],'खेळू (शाशि)':['ಆಡೋಣ']}:{'मराठी':['मराठी'],'गणित':['गणित'],'इंग्रजी':['इंग्रजी'],'आस जग १':['आपल्या सभोवतालचे जग भाग १','परिसर अभ्यास भाग १'],'परिसर अभ्यास १':['परिसर अभ्यास भाग १','आपल्या सभोवतालचे जग भाग १'],'आस जग २':['आपल्या सभोवतालचे जग भाग २','परिसर अभ्यास भाग २'],'परिसर अभ्यास २':['परिसर अभ्यास भाग २','आपल्या सभोवतालचे जग भाग २'],'इतिहास':['इतिहास व नागरिकशास्त्र'],'भूगोल':['भूगोल'],'विज्ञान':['सामान्य विज्ञान'],'हिंदी':['हिंदी सुगमभारती','हिंदी सुलभभारती'],'कलाशिक्षण':['शिकू (कलाशिक्षण)'],'शिकू (कलाशिक्षण)':['शिकू (कलाशिक्षण)'],'कार्यशिक्षण':['करू (कार्यशिक्षण)'],'करू (कार्यशिक्षण)':['करू (कार्यशिक्षण)'],'शाशि':['खेळू (शाशि)'],'खेळू (शाशि)':['खेळू (शाशि)']};
    const sub=n=>{const k=String(n||'').replace(/\s+/g,' ').trim(),cs=A[k]||[];for(const x of cs)if(av.has(x))return x;return av.has(k)?k:''};
    const tmin=s=>{const m=String(s||'').match(/(\d{1,2})[:.](\d{2})/);if(!m)return 9999;let h=+m[1];if(h>=1&&h<=5)h+=12;return h*60+ +m[2]};
    const rows=(await env.DB.prepare("SELECT period p,d1,d2,d3,d4,d5,d6,t1,t2,t3,t4,t5,t6 FROM tt WHERE cls=? AND rtype LIKE '%तासिका%' ORDER BY id").bind(c).all()).results;
    const cnt=(day,s)=>rows.filter(r=>String(r['d'+day]||'').trim()===s).length;
    const out=[];const seenToday={};
    const today=rows.filter(r=>String(r['d'+wd]||'').trim()).sort((a,b)=>tmin(a['t'+wd])-tmin(b['t'+wd]));
    for(const r of today){
      const lab=String(r['d'+wd]).trim(),ss=sub(lab);let top=null,tc=null;
      if(ss){
        const ts=(await env.DB.prepare('SELECT DISTINCT topic t,tname n FROM syl WHERE medium=? AND cls=? AND subject=? AND month=? AND week=? ORDER BY id').bind(med,c,ss,mo,wk).all()).results;
        if(ts.length){let before=0,total=0;for(let d=1;d<=6;d++){const k=cnt(d,lab);total+=k;if(d<wd)before+=k}
          const i=(seenToday[lab]||0);seenToday[lab]=i+1;const occ=before+i;top=ts[Math.min(ts.length-1,Math.floor(occ*ts.length/Math.max(1,total)))];
          tc=await env.DB.prepare('SELECT points,exp,assess,material,locode,lodesc,activity,notes FROM tach WHERE medium=? AND cls=? AND subject=? AND lesson=? LIMIT 1').bind(med,c,ss,top.t).first();
        }
      }
      out.push({p:r.p,tm:r['t'+wd],s:lab,ss:ss,t:top?top.t:'',n:top?top.n:'',tc:tc||null});
    }
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();
    return J({ok:1,rows:out,day:wd,cls:c,medium:med,month:mo,week:wk,teacher:t.name,school:sc?sc.name:'',udise:t.udise});
  }
  if(p==='/api/t/f16'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const cf={};for(const x of (await env.DB.prepare("SELECT k,v FROM cfg WHERE k IN('pay_url','pay_key')").all()).results)cf[x.k]=x.v;
    if(!cf.pay_url||!cf.pay_key)return J({ok:1,none:1,msg:'Form 16 सुविधा अजून सुरू केलेली नाही.'});
    const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();let pan='';try{pan=String(JSON.parse(ti&&ti.data||'{}')['PAN क्रमांक']||'').trim().toUpperCase()}catch(e){}
    if(!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))return J({ok:1,none:1,msg:'आधी "माझी माहिती" मध्ये PAN क्रमांक भरा.'});
    const y=cl(b.year,20).replace(/[^A-Za-z0-9 -]/g,'');if(!y)return J({e:'args'},400);
    let j;try{const rs=await fetch(cf.pay_url+'?key='+encodeURIComponent(cf.pay_key)+'&sh='+encodeURIComponent(t.shalarth)+'&pan='+pan+'&f16='+encodeURIComponent(y),{redirect:'follow'});j=await rs.json()}catch(e){return J({ok:1,none:1,msg:'Form 16 सध्या मिळाला नाही. नंतर प्रयत्न करा.'})}
    if(!j||!j.ok||!Array.isArray(j.parts)||!j.parts.length)return J({ok:1,none:1,msg:(j&&j.msg)||'या वर्षाचा Form 16 उपलब्ध नाही.'});
    return J({ok:1,parts:j.parts.slice(0,2).map(x=>({part:cl(x.part,2),name:cl(x.name,100),data:String(x.data||'')}))});
  }
  if(p==='/api/t/pay'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const cf={};for(const x of (await env.DB.prepare("SELECT k,v FROM cfg WHERE k IN('pay_url','pay_key')").all()).results)cf[x.k]=x.v;
    if(!cf.pay_url||!cf.pay_key)return J({ok:1,none:1,msg:'वेतन पावती सुविधा अजून सुरू केलेली नाही.'});
    const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();let pan='';try{pan=String(JSON.parse(ti&&ti.data||'{}')['PAN क्रमांक']||'').trim().toUpperCase()}catch(e){}
    if(!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))pan='';
    const m=cl(b.month,12).replace(/[^A-Za-z0-9_]/g,'');
    let j;try{const rs=await fetch(cf.pay_url+'?key='+encodeURIComponent(cf.pay_key)+'&sh='+encodeURIComponent(t.shalarth)+'&pan='+pan+(m?'&month='+m:''),{redirect:'follow'});j=await rs.json()}catch(e){return J({ok:1,none:1,msg:'वेतन माहिती सध्या मिळाली नाही. नंतर प्रयत्न करा.'})}
    if(!j||!j.ok)return J({ok:1,none:1,msg:(j&&j.msg)||'वेतन माहिती मिळाली नाही.'});
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();return J({ok:1,months:j.months||[],month:j.month||'',p:j.p||null,nm:j.nm||t.name,ds:j.ds||'',nw:j.nw?1:0,sc:sc?sc.name:'',sh:t.shalarth,pn:pan});
  }
  if(p==='/api/t/panchang'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const d=new Date(Date.now()+19800000).toISOString().slice(0,10),q=await env.DB.prepare('SELECT data FROM panch WHERE d=?').bind(d).first();let o=null;try{o=q&&JSON.parse(q.data)}catch(e){}return J({ok:1,d,p:o});
  }
  if(p==='/api/t/news'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const now=Date.now(),cc=await env.DB.prepare("SELECT v FROM cfg WHERE k='news_cache'").first();if(cc){try{const o=JSON.parse(cc.v);if(now-o.t<1800000)return J({ok:1,g:o.g})}catch(e){}}
    const fq=await env.DB.prepare("SELECT v FROM cfg WHERE k='news_feeds'").first(),g=[];
    const dec=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").trim();
    for(const l of String(fq&&fq.v||'').split('\n').filter(Boolean)){const [n,u]=l.split('|').map(x=>x.trim());try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),6000),rs=await fetch(u,{signal:ctl.signal,headers:{'user-agent':'Mozilla/5.0 AbhyasManch'}});clearTimeout(to);const x=await rs.text(),it=[];for(const m of x.matchAll(/<item[\s>][\s\S]*?<\/item>/g)){const ti=(m[0].match(/<title[^>]*>([\s\S]*?)<\/title>/)||[])[1],li=(m[0].match(/<link[^>]*>([\s\S]*?)<\/link>/)||[])[1];const T=dec(ti||''),L=dec(li||'');if(T&&/^https?:\/\//.test(L))it.push({t:T.slice(0,200),u:L});if(it.length>=8)break}if(it.length)g.push({n,items:it})}catch(e){}}
    await env.DB.prepare("INSERT OR REPLACE INTO cfg(k,v) VALUES('news_cache',?)").bind(JSON.stringify({t:now,g})).run();return J({ok:1,g});
  }
  if(p==='/api/t/feedback'||p==='/api/t/wa'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    if(p==='/api/t/wa'){const q=await env.DB.prepare("SELECT v FROM cfg WHERE k='wa_link'").first();return J({ok:1,u:(q&&q.v)||'https://chat.whatsapp.com/G0r9BnDy4Dr2SRWf5K6EnD?s=sh&p=a&iam=2'})}
    const m=cl(b.msg,1000).trim();if(!m)return J({e:'empty'},400);
    await env.DB.prepare('INSERT INTO fb(shalarth,name,school,rating,typ,msg,ts) VALUES(?,?,?,?,?,?,?)').bind(cl(t.shalarth,20),cl(t.name,80),cl(t.udise,20),cl(b.rating,40),cl(b.typ,60),m,new Date(Date.now()+19800000).toISOString().slice(0,16).replace('T',' ')).run();return J({ok:1});
  }
  if(p==='/api/t/lpmeta'||p==='/api/t/lplan'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const med=cl(b.medium,20),cls=cl(b.cls,4),sub=cl(b.subject,80),les=cl(b.lesson,200);
    if(p==='/api/t/lpmeta'){
      const L=async(sql,...a)=>((await env.DB.prepare(sql).bind(...a).all()).results||[]).map(x=>x.v);
      if(!med)return J({ok:1,l:await L('SELECT DISTINCT medium v FROM tach ORDER BY v')});
      if(!cls)return J({ok:1,l:await L('SELECT DISTINCT cls v FROM tach WHERE medium=? ORDER BY CAST(cls AS INTEGER)',med)});
      if(!sub)return J({ok:1,l:await L('SELECT DISTINCT subject v FROM tach WHERE medium=? AND cls=? ORDER BY subject',med,cls)});
      return J({ok:1,l:await L('SELECT lesson v FROM tach WHERE medium=? AND cls=? AND subject=? GROUP BY lesson ORDER BY MIN(rowid)',med,cls,sub)});
    }
    if(!med||!cls||!sub||!les)return J({e:'bad'},400);
    const pdf=await lessonPdf(env,cl(b.path,300));if(!pdf)return J({e:'nopdf'},404);
    const x={};
    const lang=cl(b.lang,30)||'मराठी',mins=Math.max(20,Math.min(90,parseInt(b.mins)||35));
    let ctx=['माध्यम: '+med,'इयत्ता: '+cls,'विषय: '+sub,'पाठ: '+les,'अध्ययन निष्पत्ती कोड: '+(x.locode||''),'अध्ययन निष्पत्ती: '+(x.lodesc||''),'मुख्य मुद्दे: '+(x.points||''),'स्पष्टीकरण: '+(x.exp||''),'साहित्य: '+(x.material||''),'उपक्रम: '+(x.activity||''),'मूल्यमापन: '+(x.assess||''),'टीप: '+(x.notes||'')].join('\n');
    const nt=cl(b.notes,500).trim();
    const si='तू महाराष्ट्रातील प्राथमिक शाळेच्या अनुभवी शिक्षकांसाठी पाठयोजना तयार करणारा AI Teacher आहेस.\n'+
    'जोडलेल्या पाठाच्या PDF वर आधारित '+mins+' मिनिटांच्या तासिकेसाठी पाठयोजना तयार कर.\n'+
    'महत्त्वाच्या सूचना:\n1. जोडलेल्या पाठ्यपुस्तकाच्या PDF मधील याच पाठाच्या आशयाला प्राथमिक आधार दे; त्यात नसलेली तथ्यात्मक माहिती स्वतःहून जोडू नकोस.\n2. पाठयोजना दिलेल्या अध्ययन निष्पत्तीशी जोड.\n3. '+mins+' मिनिटांत वास्तववादी वेळेचे नियोजन कर (प्रत्येक टप्प्यापुढे मिनिटे लिही).\n4. विद्यार्थीकेंद्रित, प्रत्यक्ष वर्गात वापरता येईल अशी, साधी योजना दे.\n5. उत्तर फक्त '+lang+' भाषेत दे.\n6. #, *, ** अशी मार्कडाउन चिन्हे वापरू नकोस; प्रत्येक घटकाचे शीर्षक क्रमांकासह स्वतंत्र ओळीत लिही.\n'+
    'पाठयोजनेचे घटक: 1. पाठाचे शीर्षक 2. अध्ययन निष्पत्ती / उद्दिष्टे 3. पूर्वज्ञान 4. आवश्यक शैक्षणिक साहित्य 5. प्रस्तावना / पूर्वतयारी 6. शिक्षकाची कृती 7. विद्यार्थ्यांची कृती 8. मुख्य संकल्पना 9. उदाहरणे / कृती 10. सराव 11. मूल्यमापन प्रश्न 12. उपचारात्मक कृती 13. प्रगत विद्यार्थ्यांसाठी कृती 14. गृहपाठ 15. शिक्षकासाठी आवश्यक नोंद.';
    if(nt)ctx+='\nशिक्षकाच्या विशेष सूचना: '+nt;
    const g=await gemAsk(env,si,[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:pdf}},{text:ctx}]}]);
    if(g.t)return J({ok:1,t:g.t});return J({e:g.e||'fail'},g.e==='nokey'?503:502);
  }
  if(p==='/api/t/lptest'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const med=cl(b.medium,20),cls=cl(b.cls,4),sub=cl(b.subject,80),les=cl(b.lesson,200);
    if(!med||!cls||!sub||!les)return J({e:'bad'},400);
    const pdf=await lessonPdf(env,cl(b.path,300));if(!pdf)return J({e:'nopdf'},404);
    const x={};
    const lang=cl(b.lang,30)||'मराठी',n=Math.max(3,Math.min(20,parseInt(b.n)||10)),mk=Math.max(1,Math.min(10,parseInt(b.marks)||1)),qt=cl(b.qtype,40)||'मिश्र प्रश्न',df=cl(b.diff,20)||'मध्यम',tot=n*mk;
    const ctx=['माध्यम: '+med,'इयत्ता: '+cls,'विषय: '+sub,'पाठ: '+les,'अध्ययन निष्पत्ती: '+(x.locode||'')+' '+(x.lodesc||''),'मुख्य मुद्दे: '+(x.points||''),'स्पष्टीकरण: '+(x.exp||''),'उपक्रम: '+(x.activity||''),'मूल्यमापन: '+(x.assess||'')].join('\n');
    const si='तू महाराष्ट्रातील प्राथमिक शाळेच्या शिक्षकांसाठी प्रश्नपत्रिका बनवणारा सहाय्यक आहेस. फक्त जोडलेल्या पाठ्यपुस्तकाच्या PDF मधील याच पाठाच्या आशयावर आधारित प्रश्न तयार कर. संपूर्ण प्रश्नपत्रिका फक्त '+lang+' भाषेत दे. नेमके '+n+' प्रश्न दे. प्रत्येक प्रश्नाला '+mk+' गुण (एकूण '+tot+'). प्रश्नप्रकार: '+qt+'. अवघडपणा: '+df+'. बहुपर्यायी प्रश्नाला नेमके 4 पर्याय दे, इतर प्रश्नांना options रिकामे ठेव. इयत्तेला साजेशी साधी भाषा वापर. उत्तर फक्त STRICT JSON मध्ये दे, कोणतेही अतिरिक्त शब्द किंवा ``` नको: {"questions":[{"question":"...","options":[],"answer":"...","explanation":""}]}';
    const g=await gemAsk(env,si,[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:pdf}},{text:ctx}]}]);
    if(!g.t)return J({e:g.e||'fail'},g.e==='nokey'?503:502);
    let q=null;try{const s=g.t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(),i=s.indexOf('{'),k=s.lastIndexOf('}');q=JSON.parse(s.slice(i,k+1)).questions}catch(e){}
    if(!Array.isArray(q)||!q.length)return J({e:'parse'},502);
    return J({ok:1,sc:await scn(env,t),title:les,total:tot,marks:mk,q:q.slice(0,n).map(z=>({q:cl(z.question,600),o:(Array.isArray(z.options)?z.options:[]).slice(0,4).map(o=>cl(o,200)),a:cl(z.answer,400),e:cl(z.explanation,500)}))});
  }
  if(p==='/api/t/lptype'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const mc=cl(b.medium,4)==='kn'?'kn':'mr',med=mc==='kn'?'कन्नड':'मराठी',cls=cl(b.cls,4),sub=cl(b.subject,80),ty=cl(b.type,20);
    if(!cls||!sub||!/^(संकलित|आकारिक) [12]$/.test(ty))return J({e:'bad'},400);
    const nz=s=>String(s||'').replace(/[\s\-–.()]/g,'').toLowerCase();
    const pr=((await env.DB.prepare('SELECT DISTINCT subject s,topic t,tname n FROM syl WHERE medium=? AND cls=? AND (sank=? OR akar=?)').bind(med,cls,ty,ty).all()).results||[]);
    if(!pr.length)return J({e:'noplan'},404);
    const bj=await (await env.ASSETS.fetch(new Request(new URL('/content/'+cls+'-'+mc+'/books.json',r.url)))).json();
    const bs=(bj.s||[]).find(s=>s.n===sub);if(!bs)return J({e:'nosub'},404);
    const ps=pr.filter(x=>nz(x.s)===nz(sub)||nz(x.s).includes(nz(sub))||nz(sub).includes(nz(x.s)));
    if(!ps.length)return J({e:'nomatch',subs:[...new Set(pr.map(x=>x.s))]},404);
    const used=new Set(),parts=[],names=[],miss=[];let size=0;
    for(const x of ps){
      const l=bs.l.find(z=>!used.has(z[2])&&((x.t&&String(+x.t)===String(+z[0]))||(x.n&&(nz(z[1]).includes(nz(x.n))||nz(x.n).includes(nz(z[1]))))));
      if(!l){miss.push(x.n||x.t);continue}
      used.add(l[2]);const pdf=await lessonPdf(env,l[2]);if(!pdf){miss.push(l[1]);continue}
      if(size+pdf.length>19e6){miss.push(l[1]+' (आकार)');continue}
      size+=pdf.length;parts.push({inlineData:{mimeType:'application/pdf',data:pdf}});names.push(l[1]);
    }
    if(!parts.length)return J({e:'nopdf',miss},404);
    const lang=cl(b.lang,30)||'मराठी',total=Math.max(10,Math.min(100,parseInt(b.total)||(ty[0]==='स'?40:20))),oral=Math.max(0,Math.min(total-5,parseInt(b.oral)||0)),wr=total-oral;
    const ob=Math.round(wr*0.3),vs=Math.round(wr*0.2),sh=Math.round(wr*0.3),lg=wr-ob-vs-sh;
    const cn=parseInt(cls)||0,vis=cn<=2?'इयत्ता 1-2 असल्यामुळे आवश्यक तिथे साधे emoji वापरू शकतो.':'चित्र/emoji वापरू नकोस.';
    const si='तू महाराष्ट्रातील प्राथमिक शाळेच्या शिक्षकांसाठी प्रश्नपत्रिका बनवणारा सहाय्यक आहेस. एकाच '+ty+' चाचणीसाठी जोडलेल्या सर्व पाठांच्या PDF चा एकत्रित अभ्यास करून एकच संपूर्ण प्रश्नपत्रिका तयार कर.\nमाध्यम: '+med+', इयत्ता: '+cls+', विषय: '+sub+', चाचणी: '+ty+', भाषा: '+lang+'\nसमाविष्ट पाठ: '+names.join(', ')+'\n'+
    'एकूण गुण: '+total+' (लेखी '+wr+', तोंडी '+oral+').\nलेखी गुणांची विभागणी: वस्तुनिष्ठ '+ob+', अतिलघुत्तरी '+vs+', लघुत्तरी '+sh+', दीर्घोत्तरी/कृती '+lg+'.\n'+
    'सूचना: 1. सर्व पाठांच्या आशयाचा वापर कर, फक्त एका पाठावर आधारित प्रश्न नकोत. 2. PDF बाहेरील आशय वापरू नकोस. 3. प्रत्येक वर्गवारीच्या गुणांची बेरीज वरील आकड्याशी अचूक जुळली पाहिजे; लेखी गुणांची एकूण बेरीज '+wr+' असावी. 4. तोंडी गुणांसाठी प्रश्न देऊ नकोस. 5. बहुपर्यायी प्रश्नाला नेमके 4 पर्याय दे. 6. सर्व प्रश्नपत्रिका फक्त '+lang+' भाषेत. 7. '+vis+' 8. उत्तर फक्त STRICT JSON, ``` नको: {"questions":[{"category":"वस्तुनिष्ठ","question":"...","options":[],"answer":"...","marks":1,"explanation":""}]}';
    const g=await gemAsk(env,si,[{role:'user',parts:parts.concat([{text:'वरील पाठांवर आधारित '+ty+' प्रश्नपत्रिका तयार कर.'}])}]);
    if(!g.t)return J({e:g.e||'fail'},g.e==='nokey'?503:502);
    let q=null;try{const s=g.t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(),i=s.indexOf('{'),k=s.lastIndexOf('}');q=JSON.parse(s.slice(i,k+1)).questions}catch(e){}
    if(!Array.isArray(q)||!q.length)return J({e:'parse'},502);
    return J({ok:1,sc:await scn(env,t),total,oral,written:wr,names,miss,q:q.slice(0,60).map(z=>({c:cl(z.category,30),q:cl(z.question,700),o:(Array.isArray(z.options)?z.options:[]).slice(0,4).map(o=>cl(o,200)),a:cl(z.answer,500),m:Math.max(0,Math.min(20,Number(z.marks)||0)),e:cl(z.explanation,500)}))});
  }
  if(p==='/api/t/ai'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    await slEnsure(env);const gq=await env.DB.prepare("SELECT v FROM cfg WHERE k='gemini_key'").first(),GK=env.GEMINI_API_KEY||(gq&&gq.v)||'';
    if(!GK)return J({e:'nokey'},503);
    const lang=cl(b.lang,30)||'मराठी',ms=(Array.isArray(b.m)?b.m:[]).slice(-12).map(x=>({role:x&&x.r==='a'?'model':'user',parts:[{text:cl(x&&x.t,3000)}]})).filter(x=>x.parts[0].text);
    if(!ms.length||ms[ms.length-1].role!=='user')return J({e:'empty'},400);
    const si='तू महाराष्ट्रातील शाळेतील शिक्षकांसाठी AI Teacher Assistant आहेस. पाठयोजना, प्रश्नपत्रिका, worksheet, अध्ययन निष्पत्ती, उपक्रम, मूल्यमापन, सराव प्रश्न आणि पालक संदेश तयार करण्यात मदत कर. प्रश्न कोणत्याही भाषेत असला तरी संपूर्ण उत्तर फक्त '+lang+' भाषेत (त्या भाषेची योग्य लिपी वापरून) दे. स्पष्ट, अचूक आणि शिक्षकाला प्रत्यक्ष कामात वापरता येईल असे उत्तर दे. #, ** अशी मार्कडाउन चिन्हे वापरू नकोस.';
    let last='';
    for(const mo of ['gemini-3.5-flash-lite','gemini-3.5-flash','gemini-3.1-flash-lite']){
      for(let a=0;a<2;a++){
        try{
          const x=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+mo+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':GK},body:JSON.stringify({systemInstruction:{parts:[{text:si}]},contents:ms})});
          if(x.ok){const j=await x.json(),tx=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(q=>q.text||'').join('').trim();if(tx)return J({ok:1,t:tx})}
          else{last=x.status+'';if(![429,500,502,503].includes(x.status))break}
        }catch(e){last='net'}
      }
    }
    return J({e:'fail',c:last},502);
  }
  if(p==='/api/t/hols'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await pmEnsure(env);
    return J({ok:1,rows:(await env.DB.prepare('SELECT d1,d2,name,type FROM hol ORDER BY d1').all()).results||[],today:new Date(Date.now()+19800000).toISOString().slice(0,10)});
  }
  if(p==='/api/t/imgget'||p==='/api/t/imgsave'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    if(p==='/api/t/imgget'){const q=await env.DB.prepare('SELECT photo,sign,hami FROM tch_img WHERE shalarth=?').bind(t.shalarth).first();return J({ok:1,photo:(q&&q.photo)||'',sign:(q&&q.sign)||'',hami:(q&&q.hami)||''})}
    const k=cl(b.kind,6),col={photo:'photo',sign:'sign',hami:'hami'}[k];if(!col)return J({e:'bad'},400);
    let v=String(b.data||'');
    if(k==='hami')v=v==='1'?new Date(Date.now()+19800000).toISOString().slice(0,10):'';
    else if(v&&(v.length>160000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+\/=]+$/.test(v)))return J({e:'bad'},400);
    await env.DB.prepare('INSERT INTO tch_img(shalarth,'+col+') VALUES(?,?) ON CONFLICT(shalarth) DO UPDATE SET '+col+'=excluded.'+col).bind(t.shalarth,v).run();return J({ok:1});
  }
  if(p==='/api/t/reqs'||p==='/api/t/reqsub'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    if(p==='/api/t/reqs')return J({ok:1,rows:await rqList(env,'t','t',t.shalarth)});
    return rqSub(env,'t','t',t.shalarth,t.name,await scn(env,t),b);
  }
  if(p==='/api/t/contacts'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const q=await env.DB.prepare('SELECT desig,name,area,mobile FROM dir ORDER BY id').all();return J({ok:1,rows:q.results||[]});
  }
  if(p==='/api/t/taxsave'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const o={},x=b.inp||{};for(const k of ['hra','c80','c1b','d80','hl','oth']){const n=Math.round(Number(x[k]));o[k]=isFinite(n)&&n>0?Math.min(n,100000000):0}
    await env.DB.prepare('INSERT OR REPLACE INTO tax_in(shalarth,data,upd) VALUES(?,?,?)').bind(t.shalarth,JSON.stringify(o),new Date().toISOString()).run();return J({ok:1});
  }
  if(p==='/api/t/tax'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const cf={};for(const x of (await env.DB.prepare("SELECT k,v FROM cfg WHERE k IN('pay_url','pay_key')").all()).results)cf[x.k]=x.v;
    if(!cf.pay_url||!cf.pay_key)return J({ok:1,none:1,msg:'आयकर विवरण सुविधा अजून सुरू केलेली नाही.'});
    const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();let pan='';try{pan=String(JSON.parse(ti&&ti.data||'{}')['PAN क्रमांक']||'').trim().toUpperCase()}catch(e){}
    if(!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))pan='';
    let j;try{const rs=await fetch(cf.pay_url+'?key='+encodeURIComponent(cf.pay_key)+'&sh='+encodeURIComponent(t.shalarth)+'&pan='+pan+'&annual=1',{redirect:'follow'});j=await rs.json()}catch(e){return J({ok:1,none:1,msg:'वेतन माहिती सध्या मिळाली नाही. नंतर प्रयत्न करा.'})}
    if(!j||!j.ok||!Array.isArray(j.ms))return J({ok:1,none:1,msg:(j&&j.msg)||'वेतन माहिती मिळाली नाही. (वेतन स्क्रिप्ट अद्ययावत करा.)'});
    const nm=s=>String(s==null?'':s).trim().replace(/\s+/g,' ').toLowerCase(),nu=v=>{const n=Number(String(v==null?'':v).replace(/[₹,\s]/g,''));return isFinite(n)?n:0};
    const F={basicPay:['basic pay','मूळ वेतन'],da:['d.a','da','महागाई भत्ता','महागाई भत्ता 60%'],totalPay:['total pay','एकूण'],npsEmprAllow:['nps empr allow','nps शासन वर्गणी 14%'],gpf:['gpf','भविष्य निर्वाह निधी'],gis:['gis(zp)','gis (zp)','gis','गट विमा'],npsEmployee:['nps emp contri','nps कर्मचारी वर्गणी 10%'],ngrLic:['ngr(lic)','ngr (lic)','जीवन विमा निगम हप्ता'],pt:['pt','व्यवसाय कर'],incomeTax:['income tax','आयकर']};
    const ML=[['Apr_2026','Apr-26'],['May_2026','May-26'],['Jun_2026','Jun-26'],['Jul_2026','Jul-26'],['Aug_2026','Aug-26'],['Sep_2026','Sep-26'],['Oct_2026','Oct-26'],['Nov_2026','Nov-26'],['Dec_2026','Dec-26'],['Jan_2027','Jan-27'],['Feb_2027','Feb-27'],['Mar_2027','Mar-27']];
    const by={};for(const m of j.ms){const mp={};for(const x of (m.p||[])){const h=nm(x[0]);if(h&&!(h in mp))mp[h]=x[1]}by[m.m]=mp}
    const rows=ML.map(([k,l])=>{const mp=by[k];if(!mp)return {k,l,av:0};const v={};for(const f in F){let s=0;for(const n of F[f]){if(n in mp){s=nu(mp[n]);break}}v[f]=s}return {k,l,av:1,v}});
    let last=-1;rows.forEach((r,i)=>{if(r.av)last=i});
    if(last>=0)for(let i=last+1;i<rows.length;i++){rows[i].pr=1;rows[i].v=Object.assign({},rows[last].v);if(rows[i].k==='Mar_2027')rows[i].v.pt=rows[last].v.pt>0?300:0}
    const tot={};for(const f in F)tot[f]=rows.reduce((s,r)=>s+(r.v?r.v[f]:0),0);
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first(),sv=await env.DB.prepare('SELECT data FROM tax_in WHERE shalarth=?').bind(t.shalarth).first();let inp={};try{inp=JSON.parse(sv&&sv.data||'{}')}catch(e){}
    return J({ok:1,fy:'2026-27',months:rows,totals:tot,inp,profile:{name:t.name,school:sc?sc.name:'',sh:t.shalarth,pan},have:rows.filter(r=>r.av).length});
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
    return J({ok:1,name:t.name,rows:rs,udise:t.udise,school:sc?sc.name:'',conf:t.conf?1:0,lim:sc?0:1});
  }
  if(p==='/api/t/bday'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const md=istDay().slice(5);
    const rs=(await env.DB.prepare("SELECT r.name,r.cls,r.div,i.dob FROM tclasses c JOIN roster r ON r.udise=c.udise AND r.cls=c.cls AND r.div=c.div JOIN sinfo i ON i.pen=r.pen WHERE c.tid=? AND substr(i.dob,6,5)=? ORDER BY r.cls,r.div,r.name").bind(t.id,md).all()).results;
    return J({ok:1,rows:rs,today:istDay()});
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
  if(p==='/api/admin/reqsave'||p==='/api/admin/reqlist'||p==='/api/admin/reqresp'||p==='/api/admin/reqdel'||p==='/api/admin/reqtog'||p==='/api/admin/gkcfg'||p==='/api/admin/snaimp'||p==='/api/admin/wacfg'||p==='/api/admin/fblist'||p==='/api/admin/newscfg'||p==='/api/admin/newsget'||p==='/api/admin/panchimport'||p==='/api/admin/dirsave'||p==='/api/admin/dirlist'||p==='/api/admin/tlist'||p==='/api/admin/tset'||p==='/api/admin/import'||p==='/api/admin/timport'||p==='/api/admin/simport'||p==='/api/admin/hsave'||p==='/api/admin/hdel'||p==='/api/admin/ratesave'||p==='/api/admin/ratedel'||p==='/api/admin/cookimport'||p==='/api/admin/cookmap'||p==='/api/admin/cooknlist'||p==='/api/admin/spwreset'||p==='/api/admin/preqlist'||p==='/api/admin/formlist'||p==='/api/admin/formget'||p==='/api/admin/opwreset'||p==='/api/admin/cenlist'||p==='/api/admin/tinfoimport'||p==='/api/admin/recimport'||p==='/api/admin/sylimport'||p==='/api/admin/ttimport'||p==='/api/admin/tachimport'||p==='/api/admin/paycfg'){
    const b=await body(r),bad=await adminKey(env,b);if(bad)return bad;
    if(p==='/api/admin/spwreset'){await slEnsure(env);const u=cl(b.udise,11).replace(/\D/g,'');if(u.length!==11)return J({e:'bad'},400);await env.DB.batch([env.DB.prepare('DELETE FROM school_login WHERE udise=?').bind(u),env.DB.prepare('DELETE FROM pw_req WHERE udise=?').bind(u)]);return J({ok:1})}
    if(p==='/api/admin/opwreset'){await slEnsure(env);const u=cl(b.u,12).toUpperCase();if(u!=='BEO'&&!CEN[u])return J({e:'bad'},400);await env.DB.prepare('DELETE FROM off_login WHERE uname=?').bind(u).run();return J({ok:1})}
    if(p==='/api/admin/recimport'){await slEnsure(env);const st=[],dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(cl(v,10))?cl(v,10):'';for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,40)){const sh=cl(x.sh,20).toUpperCase().replace(/\s/g,''),k=x.kind==='S'?'S':'L',fd=dt(x.fd),td=dt(x.td),ty=cl(x.typ,60);if(!/^[A-Z0-9]{6,20}$/.test(sh)||!fd||!td||!ty)continue;const ud=cl(x.udise,11).replace(/\D/g,''),rm=cl(x.rm,200);st.push(env.DB.prepare("INSERT INTO tch_rec(shalarth,kind,fd,td,udise,typ,rm,status,upd) SELECT ?,?,?,?,?,?,?,'Approved',? WHERE NOT EXISTS(SELECT 1 FROM tch_rec WHERE shalarth=? AND kind=? AND fd=? AND td=? AND typ=?)").bind(sh,k,fd,td,ud,ty,rm,istDay(),sh,k,fd,td,ty))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/sylimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM syl'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const m=cl(x.m,40),mo=cl(x.mo,20),cls=cl(x.c,6),sub=cl(x.s,120);if(!m||!mo||!cls||!sub)continue;st.push(env.DB.prepare('INSERT INTO syl(medium,month,week,cls,subject,topic,tname,sank,akar) VALUES(?,?,?,?,?,?,?,?,?)').bind(m,mo,Math.min(4,Math.max(1,parseInt(x.w)||1)),cls,sub,cl(x.t,20),cl(x.tn,200),cl(x.sa,40),cl(x.ak,40)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/ttimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM tt'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const c=cl(x.c,4),pe=cl(x.p,40);if(!c||!pe||!Array.isArray(x.d)||!Array.isArray(x.t))continue;const d=[0,1,2,3,4,5].map(i=>cl(x.d[i],120)),t=[0,1,2,3,4,5].map(i=>cl(x.t[i],30));st.push(env.DB.prepare('INSERT INTO tt(cls,period,d1,d2,d3,d4,d5,d6,t1,t2,t3,t4,t5,t6,rtype) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(c,pe,...d,...t,cl(x.r,20)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/panchimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM panch'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,100)){const d=cl(x.d,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;const o={};for(const k of ['वार','शक','संवत्सर','मास','पक्ष','तिथी','नक्षत्र','सूर्योदय','सूर्यास्त'])o[k]=cl(x[k],60);st.push(env.DB.prepare('INSERT OR REPLACE INTO panch(d,data) VALUES(?,?)').bind(d,JSON.stringify(o)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/fblist'){await slEnsure(env);const q=await env.DB.prepare('SELECT name,school,rating,typ,msg,ts FROM fb ORDER BY id DESC LIMIT 100').all(),w=await env.DB.prepare("SELECT v FROM cfg WHERE k='wa_link'").first();return J({ok:1,rows:q.results||[],wa:w?w.v:''})}
    if(p==='/api/admin/snaimp'){await slEnsure(env);await env.DB.prepare("CREATE TABLE IF NOT EXISTS school_sna(udise TEXT PRIMARY KEY, mhsn TEXT, bank TEXT, acct TEXT, ifsc TEXT, branch TEXT, hm TEXT, hm_mob TEXT, upd TEXT)").run();const st=[];for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const u=cl(x.u,11),m=cl(x.m,20).toUpperCase(),ac=cl(x.acct,25),fs=cl(x.ifsc,15).toUpperCase();if(!/^\d{11}$/.test(u)||!/^MHSN\d{3,10}$/.test(m)||!/^\d{6,20}$/.test(ac)||!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(fs))continue;st.push(env.DB.prepare('INSERT OR REPLACE INTO school_sna(udise,mhsn,bank,acct,ifsc,branch,hm,hm_mob,upd) VALUES(?,?,?,?,?,?,?,?,?)').bind(u,m,cl(x.bank,60),ac,fs,cl(x.br,60),cl(x.hm,80),cl(x.mob,10),new Date().toISOString()))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/gkcfg'){await slEnsure(env);const k=cl(b.v,200).trim();if(k&&!/^[\w.-]{20,200}$/.test(k))return J({e:'bad'},400);await env.DB.prepare("INSERT INTO cfg(k,v) VALUES('gemini_key',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(k).run();return J({ok:1})}
    if(p==='/api/admin/wacfg'){await slEnsure(env);const u=cl(b.v,300).trim();if(u&&!/^https:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel|wa\.me)\/\S+$/i.test(u))return J({e:'bad'},400);await env.DB.prepare("INSERT INTO cfg(k,v) VALUES('wa_link',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(u).run();return J({ok:1})}
    if(p==='/api/admin/reqsave'||p==='/api/admin/reqlist'||p==='/api/admin/reqresp'||p==='/api/admin/reqdel'||p==='/api/admin/reqtog'){
      await slEnsure(env);
      if(p==='/api/admin/reqlist'){const rs=((await env.DB.prepare('SELECT id,title,aud,due,active,created,fields FROM req ORDER BY created DESC').all()).results||[]);const tt=((await env.DB.prepare("SELECT COUNT(*) c FROM teachers WHERE status='ok'").first())||{}).c||0,ts=((await env.DB.prepare('SELECT COUNT(*) c FROM schools').first())||{}).c||0,out=[];
        for(const q of rs){const c=async k=>((await env.DB.prepare('SELECT COUNT(*) c FROM resp WHERE rid=? AND wt=?').bind(q.id,k).first())||{}).c||0;out.push({id:q.id,title:q.title,aud:q.aud,due:q.due,active:q.active,n:JSON.parse(q.fields||'[]').length,t:await c('t'),s:await c('s')})}
        return J({ok:1,rows:out,tt,ts})}
      if(p==='/api/admin/reqdel'){const id=cl(b.id,40);await env.DB.batch([env.DB.prepare('DELETE FROM req WHERE id=?').bind(id),env.DB.prepare('DELETE FROM resp WHERE rid=?').bind(id)]);return J({ok:1})}
      if(p==='/api/admin/reqtog'){await env.DB.prepare('UPDATE req SET active=? WHERE id=?').bind(b.active?1:0,cl(b.id,40)).run();return J({ok:1})}
      if(p==='/api/admin/reqresp'){const id=cl(b.id,40),q=await env.DB.prepare('SELECT title,aud,fields FROM req WHERE id=?').bind(id).first();if(!q)return J({e:'nf'},404);
        const rows=((await env.DB.prepare('SELECT wt,wid,name,sch,data,ts FROM resp WHERE rid=? ORDER BY wt,sch,name').bind(id).all()).results||[]);
        let mt=[],ms=[];
        if(q.aud!=='s')mt=((await env.DB.prepare("SELECT t.name,s.name sc FROM teachers t LEFT JOIN schools s ON s.udise=t.udise WHERE t.status='ok' AND t.shalarth NOT IN (SELECT wid FROM resp WHERE rid=? AND wt='t') ORDER BY s.name,t.name LIMIT 600").bind(id).all()).results||[]);
        if(q.aud!=='t')ms=((await env.DB.prepare("SELECT name,udise FROM schools WHERE udise NOT IN (SELECT wid FROM resp WHERE rid=? AND wt='s') ORDER BY name LIMIT 600").bind(id).all()).results||[]);
        return J({ok:1,title:q.title,aud:q.aud,f:JSON.parse(q.fields||'[]'),rows,mt,ms})}
      const title=cl(b.title,150).trim(),aud=['t','s','b'].includes(b.aud)?b.aud:'b',due=/^\d{4}-\d{2}-\d{2}$/.test(String(b.due||''))?b.due:'',f=rqParse(b.text);
      if(!title||!f.length)return J({e:'bad'},400);
      const id=b.id?cl(b.id,40):'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
      await env.DB.prepare('INSERT INTO req(id,title,aud,due,fields,active,created) VALUES(?,?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,aud=excluded.aud,due=excluded.due,fields=excluded.fields').bind(id,title,aud,due,JSON.stringify(f),new Date().toISOString()).run();return J({ok:1,id,n:f.length});
    }
    if(p==='/api/admin/newsget'){await slEnsure(env);const q=await env.DB.prepare("SELECT v FROM cfg WHERE k='news_feeds'").first();return J({ok:1,v:q?q.v:''})}
    if(p==='/api/admin/newscfg'){await slEnsure(env);const L=String(b.v||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,8),ok=[];for(const l of L){const a=l.split('|').map(x=>x.trim());if(a.length<2||!/^https:\/\/[\w.-]+\.[a-z]{2,}\/\S*$/i.test(a[1]))return J({e:'bad',l},400);ok.push(cl(a[0],60)+' | '+cl(a[1],300))}await env.DB.batch([env.DB.prepare("INSERT OR REPLACE INTO cfg(k,v) VALUES('news_feeds',?)").bind(ok.join('\n')),env.DB.prepare("DELETE FROM cfg WHERE k='news_cache'")]);return J({ok:1,n:ok.length})}
    if(p==='/api/admin/dirlist'){await slEnsure(env);const q=await env.DB.prepare('SELECT desig,name,area,mobile FROM dir ORDER BY id').all();return J({ok:1,rows:q.results||[]})}
    if(p==='/api/admin/dirsave'){await slEnsure(env);const st=[env.DB.prepare('DELETE FROM dir')];for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,300)){const d=cl(x.desig,80);if(!d)continue;st.push(env.DB.prepare('INSERT INTO dir(desig,name,area,mobile) VALUES(?,?,?,?)').bind(d,cl(x.name,80),cl(x.area,80),cl(x.mobile,20).replace(/\D/g,'').slice(-12)))}await env.DB.batch(st);return J({ok:1,n:st.length-1})}
    if(p==='/api/admin/tachimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM tach'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,40)){const m=cl(x.m,40),c=cl(x.c,6),sb=cl(x.s,120);if(!m||!c||!sb)continue;st.push(env.DB.prepare('INSERT INTO tach(medium,cls,subject,lesson,points,exp,assess,material,locode,lodesc,activity,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(m,c,sb,cl(x.l,20),cl(x.p,300),cl(x.e,2500),cl(x.a,500),cl(x.t,500),cl(x.lc,200),cl(x.ld,800),cl(x.ac,800),cl(x.n,500)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/paycfg'){await slEnsure(env);const u=cl(b.url,300),k=cl(b.key,100);if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)||k.length<8)return J({e:'bad'},400);await env.DB.batch([env.DB.prepare('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)').bind('pay_url',u),env.DB.prepare('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)').bind('pay_key',k)]);return J({ok:1})}
    if(p==='/api/admin/tinfoimport'){await slEnsure(env);const st=[];for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,20)){const sh=cl(x.sh,20).toUpperCase().replace(/\s/g,'');if(!/^[A-Z0-9]{6,20}$/.test(sh)||!x.d||typeof x.d!=='object')continue;const d={};let n=0;for(const k of Object.keys(x.d)){if(n++>150)break;d[cl(k,80)]=cl(x.d[k],600)}const js=JSON.stringify(d);if(js.length>60000)continue;st.push(env.DB.prepare('INSERT INTO tch_info(shalarth,data,upd) VALUES(?,?,?) ON CONFLICT(shalarth) DO UPDATE SET data=excluded.data,upd=excluded.upd').bind(sh,js,istDay()))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/cenlist'){await slEnsure(env);return J({ok:1,rows:(await env.DB.prepare('SELECT code,COUNT(*) n FROM sch_center GROUP BY code').all()).results,cen:CEN})}
    if(p==='/api/admin/formlist'){await slEnsure(env);return J({ok:1,rows:(await env.DB.prepare('SELECT f.udise,s.name sc,f.upd,f.by,f.submitted,LENGTH(f.data) sz FROM sch_form f LEFT JOIN schools s ON s.udise=f.udise ORDER BY f.upd DESC LIMIT 700').all()).results})}
    if(p==='/api/admin/formget'){await slEnsure(env);const us=(Array.isArray(b.udise)?b.udise:[b.udise]).map(u=>cl(u,11).replace(/\D/g,'')).filter(u=>u.length===11).slice(0,60);if(!us.length)return J({e:'bad'},400);const q=await env.DB.prepare('SELECT f.udise,s.name sc,f.data,f.upd,f.by,f.submitted FROM sch_form f LEFT JOIN schools s ON s.udise=f.udise WHERE f.udise IN ('+us.map(()=>'?').join(',')+')').bind(...us).all();return J({ok:1,rows:q.results})}
    if(p==='/api/admin/preqlist'){await slEnsure(env);return J({ok:1,rows:(await env.DB.prepare('SELECT r.udise,r.name,r.mobile,r.ts,s.name sc FROM pw_req r LEFT JOIN schools s ON s.udise=r.udise ORDER BY r.ts DESC LIMIT 200').all()).results})}
    if(p==='/api/admin/cooknlist'){await pmEnsure(env);return J({ok:1,rows:(await env.DB.prepare("SELECT udise,MIN(sname) sname,COUNT(*) n FROM pm_cook WHERE udise LIKE 'N%' GROUP BY udise ORDER BY sname").all()).results})}
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
      await slEnsure(env);for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,100)){const u=cl(x.u,11).replace(/\D/g,''),n=cl(x.n,120),c=cl(x.c,12).toUpperCase();if(u.length===11&&n){st.push(env.DB.prepare('INSERT OR REPLACE INTO schools(udise,name) VALUES(?,?)').bind(u,n));if(CEN[c])st.push(env.DB.prepare('INSERT OR REPLACE INTO sch_center(udise,code) VALUES(?,?)').bind(u,c))}}
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
    if(/\.workers\.dev$/.test(u.hostname)&&u.pathname.startsWith('/api/'))return J({e:'moved',url:'https://abhyasmanch.in'},410);
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
