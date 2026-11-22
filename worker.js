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
const PAYP=new Set(['/api/admin/payimp','/api/admin/paymons']);
async function payKey(env,b){
  const a=await env.DB.prepare("SELECT * FROM settings WHERE k='payadm'").first().catch(()=>null);
  if(!a)return J({e:'nopay'},503);
  const [salt,hh,fails,last]=a.v.split('|');
  if(+fails>=8&&Date.now()-(+last)<900000)return J({e:'locked'},429);
  if(await hashPin(String(b.pk||''),salt)!==hh){await env.DB.prepare("UPDATE settings SET v=? WHERE k='payadm'").bind([salt,hh,(+fails)+1,Date.now()].join('|')).run();return J({e:'bad'},401)}
  if(+fails)await env.DB.prepare("UPDATE settings SET v=? WHERE k='payadm'").bind([salt,hh,0,0].join('|')).run();
  return null;
}
async function pwOk(pw,salt,stored){return stored&&stored.startsWith('p:')?(await hashPin(pw,salt))===stored.slice(2):(await sha(salt+pw))===stored}
async function teacher(env,b,needOk){
  const t=cl(b.token,64);if(!t)return null;
  const x=await env.DB.prepare('SELECT * FROM teachers WHERE token=?').bind(t).first();
  if(!x||(needOk&&x.status!=='ok'))return null;
  if(!x.tt||Date.now()-x.tt>TTTL)return null;return x;
}
const TTTL=30*864e5;
let TCOK=false;async function tCols(env){if(TCOK)return;for(const c of ['lf INTEGER DEFAULT 0','tt INTEGER DEFAULT 0','district TEXT','taluka TEXT','kendra TEXT','kcode TEXT'])try{await env.DB.prepare('ALTER TABLE teachers ADD COLUMN '+c).run()}catch(e){}TCOK=true}
// नोंदणी फॉर्ममधील जिल्हा/तालुका/केंद्र (स्वतः निवडलेले) – शिक्षक व शाळा नोंदणीत साठवण्यासाठी
let SRCK=false;async function srCols(env){if(SRCK)return;for(const c of ['district TEXT','taluka TEXT','kendra TEXT','kcode TEXT'])try{await env.DB.prepare('ALTER TABLE sch_reg ADD COLUMN '+c).run()}catch(e){}SRCK=true}
function geoIn(b){const kc=cl(b.kcode,14).toUpperCase();return{d:cl(b.district,60),t:cl(b.taluka,60),k:cl(b.kendra,60),kc:/^CLU\d{5,10}$/.test(kc)?kc:''}}
async function tMed(env,t){
  const m={};let d='mr',tm='';
  try{const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();tm=JSON.parse(ti&&ti.data||'{}')['अध्यापनाचे माध्यम']||''}catch(e){}
  if(tm==='कन्नड')d='kn';
  else if(!tm){try{await schCols(env);const sc=await env.DB.prepare('SELECT med FROM schools WHERE udise=?').bind(t.udise).first();if(sc&&/kn|कन्नड|kannada/i.test(String(sc.med||'')))d='kn'}catch(e){}}
  try{const rs=(await env.DB.prepare('SELECT cls,med,COUNT(*) n FROM roster WHERE udise=? GROUP BY cls,med').bind(t.udise).all()).results||[],bst={};
    for(const x of rs){const c=String(x.cls);if(!bst[c]||x.n>bst[c].n)bst[c]={n:x.n,med:x.med}}
    for(const c in bst)m[c]=bst[c].med==='kn'?'kn':'mr'}catch(e){}
  return{d,m};
}
let SCOK=false;
async function schCols(env){if(SCOK)return;for(const c of ['med TEXT','cmin INTEGER','cmax INTEGER']){try{await env.DB.prepare('ALTER TABLE schools ADD COLUMN '+c).run()}catch(e){}}SCOK=true}
async function mailSend(env,to,sub,html){try{if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to||'')))return 0;await slEnsure(env);
  const q=await env.DB.prepare("SELECT k,v FROM cfg WHERE k IN ('brevo_key','mail_from','mail_name')").all(),c={};q.results.forEach(x=>c[x.k]=x.v);
  const key=env.BREVO_API_KEY||c.brevo_key,fr=c.mail_from;if(!key||!fr)return 0;
  const x=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'content-type':'application/json','api-key':key,accept:'application/json'},body:JSON.stringify({sender:{name:c.mail_name||'अभ्यास मंच',email:fr},to:[{email:to}],subject:sub,htmlContent:html})});
  return x.ok?1:0}catch(e){return 0}}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
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
const XK=['caste','minority','bpl','aay','ews','cwsn','imp','blood','adate','medium','rte','aad4','aadst','apaar','apst','mbu','scode','rep','est','mobile2','mobm','email','guardian','pin','pedu','days','ht','wt','dist','prevres','sdms','fac','nat','oosc'];
let XOK=false;
async function ensS(env){if(XOK)return;try{await env.DB.prepare('ALTER TABLE sinfo ADD COLUMN extra TEXT').run()}catch(e){}try{await env.DB.prepare('CREATE TABLE IF NOT EXISTS uimp_pend(udise TEXT,cls INTEGER,dv TEXT,nn TEXT,name TEXT,j TEXT,upd INTEGER,PRIMARY KEY(udise,cls,dv,nn))').run()}catch(e){}XOK=true}
// ---- School login (UDISE + password) ----
const SCH_COMM=[['C001','शाळा व्यवस्थापन समिती (SMC)'],['C002','सखी सावित्री समिती'],['C003','महिला तक्रार निवारण समिती'],['C004','विद्यार्थी सुरक्षा समिती'],['C005','माजी विद्यार्थी संघ']];
const TNE=["अनुक्रमांक", "लिंग", "संबोधन", "नाव", "मधले नाव", "आडनाव", "Shalarth ID", "जन्मतारीख", "प्रथम नियुक्ती दिनांक", "जिल्ह्यात रुजू दिनांक", "सेवानिवृत्ती दिनांक", "PAN क्रमांक", "केंद्राचे नाव"];
const SCH_DIST=['uni','book','shoe','bag'];
const CEN={"CLU3603574": "ACHANKAN HALLI", "CLU3603586": "ASANGI TURK", "CLU3603584": "AWANDI", "CLU3603592": "BAJ", "CLU3603590": "BANALI", "CLU3603593": "BILUR", "CLU3603576": "BORGI", "CLU3603580": "DAFALAPUR", "CLU3603598": "DARIBADACHI", "CLU3603591": "GIRAGAON", "CLU3603597": "GUDDAPUR", "CLU3603594": "JADRABOBALAD", "CLU3603573": "JAT KANYA", "CLU3603596": "JIRGYAL", "CLU3603577": "KHOJANWADI", "CLU3603595": "KO. BOBALAD", "CLU3603575": "KUMBHARI", "CLU3603589": "MUCHANDI", "CLU3603587": "NIGADI KD", "CLU3603579": "SANKH", "CLU3603582": "SANMADI", "CLU3603578": "SHEGAON", "CLU3603581": "SINDUR", "CLU3603583": "TIKONDI", "CLU3603588": "UMADI", "CLU3603600": "UTAGI", "CLU3603599": "WALEKHINDI", "CLU3603585": "WALSANG"};
let SLOK=false;
async function slEnsure(env){if(SLOK)return;const SV='sv'+String(slEnsure).length;try{const q=await env.DB.prepare("SELECT v FROM cfg WHERE k='slv'").first();if(q&&q.v===SV){SLOK=true;return}}catch(e){}await env.DB.batch([env.DB.prepare("CREATE TABLE IF NOT EXISTS school_login(udise TEXT PRIMARY KEY, salt TEXT, pw TEXT, changed INTEGER DEFAULT 0, fails INTEGER DEFAULT 0, token TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_cmember(udise TEXT, cid TEXT, id INTEGER, name TEXT, desig TEXT, mtype TEXT, mobile TEXT, joined TEXT, active INTEGER, PRIMARY KEY(udise,cid,id))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_dist(udise TEXT, kind TEXT, pen TEXT, got INTEGER, date TEXT, upd TEXT, PRIMARY KEY(udise,kind,pen))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_books(udise TEXT, cls TEXT, names TEXT, PRIMARY KEY(udise,cls))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_form(udise TEXT PRIMARY KEY, data TEXT, upd TEXT, by TEXT, submitted TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_center(udise TEXT PRIMARY KEY, code TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_bank(udise TEXT, kind TEXT, holder TEXT, bank TEXT, branch TEXT, acct TEXT, ifsc TEXT, upd TEXT, by TEXT, PRIMARY KEY(udise,kind))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS off_login(uname TEXT PRIMARY KEY, salt TEXT, pw TEXT, changed INTEGER DEFAULT 0, fails INTEGER DEFAULT 0, token TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tt(id INTEGER PRIMARY KEY AUTOINCREMENT, cls TEXT, period TEXT, d1 TEXT,d2 TEXT,d3 TEXT,d4 TEXT,d5 TEXT,d6 TEXT, t1 TEXT,t2 TEXT,t3 TEXT,t4 TEXT,t5 TEXT,t6 TEXT, rtype TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS tt_c ON tt(cls)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tach(id INTEGER PRIMARY KEY AUTOINCREMENT, medium TEXT, cls TEXT, subject TEXT, lesson TEXT, points TEXT, exp TEXT, assess TEXT, material TEXT, locode TEXT, lodesc TEXT, activity TEXT, notes TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS tach_k ON tach(medium,cls,subject,lesson)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tax_in(shalarth TEXT PRIMARY KEY, data TEXT, upd TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS cfg(k TEXT PRIMARY KEY, v TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS panch(d TEXT PRIMARY KEY, data TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_img(shalarth TEXT PRIMARY KEY, photo TEXT, sign TEXT, hami TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS req(id TEXT PRIMARY KEY, title TEXT, aud TEXT, due TEXT, fields TEXT, active INTEGER DEFAULT 1, created TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS resp(rid TEXT, wt TEXT, wid TEXT, name TEXT, sch TEXT, data TEXT, ts TEXT, PRIMARY KEY(rid,wt,wid))"),env.DB.prepare("CREATE TABLE IF NOT EXISTS dir(id INTEGER PRIMARY KEY AUTOINCREMENT, desig TEXT, name TEXT, area TEXT, mobile TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS fb(id INTEGER PRIMARY KEY AUTOINCREMENT, shalarth TEXT, name TEXT, school TEXT, rating TEXT, typ TEXT, msg TEXT, ts TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS syl(id INTEGER PRIMARY KEY AUTOINCREMENT, medium TEXT, month TEXT, week INTEGER, cls TEXT, subject TEXT, topic TEXT, tname TEXT, sank TEXT, akar TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS syl_mc ON syl(medium,cls)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_rec(id INTEGER PRIMARY KEY AUTOINCREMENT, shalarth TEXT, kind TEXT, fd TEXT, td TEXT, udise TEXT, typ TEXT, rm TEXT, status TEXT, upd TEXT)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS tch_rec_sh ON tch_rec(shalarth)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_edit(shalarth TEXT PRIMARY KEY, data TEXT, status TEXT, remark TEXT, upd TEXT, sub TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS tch_info(shalarth TEXT PRIMARY KEY, data TEXT, upd TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS pw_req(udise TEXT PRIMARY KEY, name TEXT, mobile TEXT, ts TEXT)")]);for(const c of ['sz1','sz2'])try{await env.DB.prepare('ALTER TABLE sch_dist ADD COLUMN '+c+' TEXT').run()}catch(e){}
  for(const c of ['lk INTEGER DEFAULT 0','tt INTEGER DEFAULT 0'])try{await env.DB.prepare('ALTER TABLE off_login ADD COLUMN '+c).run()}catch(e){}
  try{await env.DB.prepare("INSERT INTO cfg(k,v) VALUES('slv',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(SV).run()}catch(e){}SLOK=true}
async function schoolAuth(env,b){
  const t=cl(b.token,64);if(!t)return null;await slEnsure(env);
  return await env.DB.prepare('SELECT * FROM school_login WHERE token=?').bind(t).first();
}

const PYL=['मूळ वेतन','महागाई भत्ता','घर भाडे भत्ता','वाहन भत्ता','दिव्यांग/वाहतूक भत्ता','इतर (फरक)','मानधन','NPS शासन वर्गणी 14%','फरकातून NPS शासन वर्गणी','एकूण वेतन','सण अग्रिम','वजा जाता रक्कम','भविष्य निर्वाह निधी','NPS शासन वर्गणी (कपात)','NPS कर्मचारी वर्गणी','गट विमा','व्यवसाय कर','मुद्रांक शुल्क','आयकर','फरकातून NPS','फरकातून NPS (कर्मचारी)','इतर कपात','जीवन विमा निगम','सा.जि.विकास/सह पत संस्था','प्राथ. शिक्षक बँक','एकूण वजाती','निव्वळ आदा करावयाची रक्कम'];
const PYM=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monOrd=m=>{const a=String(m||'').split('_'),i=PYM.indexOf(a[0]);return i<0||!/^\d{4}$/.test(a[1]||'')?0:(+a[1])*100+i};
let PDOK=false;
async function pdEns(env){if(PDOK)return;await env.DB.prepare("CREATE TABLE IF NOT EXISTS payd(mon TEXT,ord INTEGER,hid TEXT,ds TEXT,nm TEXT,v TEXT,PRIMARY KEY(mon,hid,nm))").run();try{await env.DB.prepare("ALTER TABLE payd ADD COLUMN up TEXT").run()}catch(e){}PDOK=true}
async function pdSalt(env){let q=await env.DB.prepare("SELECT v FROM cfg WHERE k='pay_salt'").first();if(q)return q.v;await env.DB.prepare("INSERT OR IGNORE INTO cfg(k,v) VALUES('pay_salt',?)").bind(rnd(16)).run();q=await env.DB.prepare("SELECT v FROM cfg WHERE k='pay_salt'").first();return q.v}
async function pdHid(env,id){return (await sha((await pdSalt(env))+'|'+id)).slice(0,32)}
const nmTok=s=>String(s||'').replace(/[.,()\-_/]/g,' ').split(/\s+/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>1);
function pdPick(rows,nm){if(!rows.length)return null;if(rows.length===1)return rows[0];const t=new Set(nmTok(nm));let best=null,bs=0;for(const r of rows){const sc=nmTok(r.nm).filter(x=>t.has(x)).length;if(sc>bs){bs=sc;best=r}}return best}
// मासिक वेतन: D1 मधून (PAN/केंद्र-हॅश) – फक्त स्वतःची नोंद
async function pdMons(env,hid){const H=[].concat(hid).filter(Boolean);if(!H.length)return [];return (await env.DB.prepare('SELECT DISTINCT mon,ord FROM payd WHERE hid IN ('+H.map(()=>'?').join(',')+') ORDER BY ord DESC').bind(...H).all()).results||[]}
async function pdSlip(env,hid,mon,nm){for(const h of [].concat(hid).filter(Boolean)){const rows=(await env.DB.prepare('SELECT ds,nm,v FROM payd WHERE hid=? AND mon=?').bind(h,mon).all()).results||[];const r=pdPick(rows,nm);if(!r)continue;let v=[];try{v=JSON.parse(r.v)}catch(e){}if(v&&!Array.isArray(v)&&Array.isArray(v.h))return {ds:r.ds||'',nm:r.nm||'',nw:1,p:v.h.map((l,i)=>[l,String(v.v[i]==null?0:v.v[i])])};if(v&&!Array.isArray(v)&&Array.isArray(v.v)){const a=v.v;return {ds:r.ds||'',nm:r.nm||'',nw:0,lb:v.lb||null,p:PYL.map((l,i)=>[l,String(a[i]==null?0:a[i])])}}return {ds:r.ds||'',nm:r.nm||'',nw:0,p:PYL.map((l,i)=>[l,String(v[i]==null?0:v[i])])}}return null}
async function mdmEns(env){await env.DB.batch([env.DB.prepare("CREATE TABLE IF NOT EXISTS mdm(mon TEXT, udise TEXT, d TEXT, up TEXT, PRIMARY KEY(mon,udise))")])}
function mdmUp(env,mon,u,a,now){const d=[];for(let i=0;i<18;i++){let v=parseFloat(a[i]);const sg=i===4||i===11;if(!isFinite(v)||(v<0&&!sg))v=0;if([1,2,8,9].includes(i)&&v>31)v=31;v=Math.round(Math.max(Math.min(v,1e6),sg?-1e6:0)*100)/100;d.push(v)}return env.DB.prepare('INSERT INTO mdm(mon,udise,d,up) VALUES(?,?,?,?) ON CONFLICT(mon,udise) DO UPDATE SET d=excluded.d,up=excluded.up').bind(mon,u,JSON.stringify(d),now)}
async function mdmPrev(env,mon,ok){const [y,m]=mon.split('-').map(Number),pm=m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0'),P={};
  for(const x of (await env.DB.prepare('SELECT udise,d FROM mdm WHERE mon=?').bind(pm).all()).results){if(ok&&!ok.has(x.udise))continue;try{const d=JSON.parse(x.d);P[x.udise]={p1:d[0],p2:d[7],ck:d[14],c1:Math.round((d[4]+d[5]-d[6])*100)/100,c2:Math.round((d[11]+d[12]-d[13])*100)/100}}catch(e){}}return P}
async function mdmAuto(env,mon,ok){const [y,m]=mon.split('-').map(Number),sy=m>=6?y:y-1,yr=sy+'-'+String((sy+1)%100).padStart(2,'0'),ix=(m-6+12)%12,A={};
  try{for(const x of (await env.DB.prepare("SELECT udise,v FROM cce_doc WHERE yr=? AND cls=0 AND kind='days' AND k=''").bind(yr).all()).results){if(!ok.has(x.udise))continue;try{const a=JSON.parse(x.v),w=parseFloat(a&&a[ix]);if(w>0)(A[x.udise]=A[x.udise]||{n:0,c1:0,c2:0,b1:0,b2:0}).wd=w}catch(e){}}}catch(e){}
  try{for(const x of (await env.DB.prepare("SELECT udise,p15,p68,cooked FROM pm_daily WHERE date LIKE ?").bind(mon+'-%').all()).results){if(!ok.has(x.udise)||x.cooked==='नाही')continue;const o=A[x.udise]=A[x.udise]||{n:0,c1:0,c2:0,b1:0,b2:0};o.n++;if(x.p15>0){o.c1++;o.b1+=x.p15}if(x.p68>0){o.c2++;o.b2+=x.p68}}}catch(e){}
  try{for(const x of (await env.DB.prepare("SELECT udise,items FROM pm_rcpt WHERE date LIKE ?").bind(mon+'-%').all()).results){if(!ok.has(x.udise))continue;let it=[];try{it=JSON.parse(x.items)}catch(e){}for(const i of it){if(String(i.name||'').trim()!=='तांदूळ')continue;const o=A[x.udise]=A[x.udise]||{n:0,c1:0,c2:0,b1:0,b2:0};o.rn=1;if(i.q15==null){o.ru=(o.ru||0)+(Number(i.qty)||0)}else{o.r1=(o.r1||0)+(Number(i.q15)||0);o.r2=(o.r2||0)+(Number(i.q68)||0)}}}}catch(e){}
  return A}
async function lvEns(env){await env.DB.batch([env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_lv(id INTEGER PRIMARY KEY AUTOINCREMENT, udise TEXT, shalarth TEXT, tname TEXT, typ TEXT, fd TEXT, td TEXT, days INTEGER, rm TEXT, img TEXT, upd TEXT)"),env.DB.prepare("CREATE TABLE IF NOT EXISTS kp_diary(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, dt TEXT, kind TEXT, place TEXT, udise TEXT, pn TEXT, rm TEXT, img TEXT, upd TEXT)")])}
let VSOK=false;
async function vsEns(env){if(VSOK)return;await env.DB.prepare("CREATE TABLE IF NOT EXISTS kp_visit(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, udise TEXT, dt TEXT, tin TEXT, tout TEXT, vt TEXT, data TEXT, img TEXT, score INTEGER, grade TEXT, st TEXT, upd TEXT)").run();VSOK=true}
let GEOK=false;
async function geoEns(env){if(GEOK)return;await env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_geo(udise TEXT PRIMARY KEY, lat REAL, lng REAL, acc INTEGER, by TEXT, upd TEXT)").run();GEOK=true}
function geoClean(o){if(!o||typeof o!=='object')return null;const la=Number(o.lat),ln=Number(o.lng);if(!isFinite(la)||!isFinite(ln)||la<6||la>38||ln<68||ln>98)return null;const ac=Math.max(0,Math.min(99999,Math.round(Number(o.acc))||0));return{lat:Math.round(la*1e6)/1e6,lng:Math.round(ln*1e6)/1e6,acc:ac}}
function geoDist(a,b){const R=6371000,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lng-a.lng)*r,x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return Math.round(2*R*Math.asin(Math.sqrt(x)))}
async function geoPut(env,u,g,by){await geoEns(env);await env.DB.prepare('INSERT INTO sch_geo(udise,lat,lng,acc,by,upd) VALUES(?,?,?,?,?,?) ON CONFLICT(udise) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,acc=excluded.acc,by=excluded.by,upd=excluded.upd').bind(u,g.lat,g.lng,g.acc,by,new Date().toISOString()).run()}
async function phPut(env,imgs,pre,old){const a=(Array.isArray(imgs)?imgs:[]).slice(0,3);if(!a.length)return{keys:old};if(!env.BOOKS)return{e:'noimg'};const bin=[];
  for(const d of a){const m=/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(d||''));if(!m||m[1].length>1000000)return{e:'img'};const raw=atob(m[1]),u8=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u8[i]=raw.charCodeAt(i);bin.push(u8)}
  const nk=[];for(const u8 of bin){const k=pre+crypto.randomUUID().replace(/-/g,'').slice(0,16)+'.jpg';await env.BOOKS.put(k,u8,{httpMetadata:{contentType:'image/jpeg'}});nk.push(k)}
  for(const k of old){try{await env.BOOKS.delete(k)}catch(e){}}return{keys:nk}}
async function phGet(env,json,pre,n){let ks=[];try{ks=JSON.parse(json||'[]')}catch(e){}const k=ks[Math.max(0,parseInt(n)||0)];if(!k||!k.startsWith(pre)||!env.BOOKS)return J({e:'nf'},404);const o=await env.BOOKS.get(k);if(!o)return J({e:'nf'},404);return new Response(o.body,{headers:{'content-type':'image/jpeg','cache-control':'private, max-age=300'}})}
async function phDel(env,json,pre){try{for(const k of JSON.parse(json||'[]'))if(k.startsWith(pre))await env.BOOKS.delete(k)}catch(e){}}
const phN=j=>{try{return JSON.parse(j||'[]').length}catch(e){return 0}};
async function offAuth(env,b){const u=cl(b.u,12).toUpperCase(),t=cl(b.token,64);if(!u||t.length<20)return null;const x=await env.DB.prepare('SELECT * FROM off_login WHERE uname=? AND token=?').bind(u,t).first();return x&&x.tt&&Date.now()-x.tt<OTTL?x:null}
const OTTL=30*864e5,OFAIL=8,OLOCK=15*6e4,OAEO=['AEO1','AEO2','AEO3'],isOff=u=>u==='BEO'||OAEO.includes(u);
async function offApi(p,r,env){
  if(!p.startsWith('/api/o/'))return null;
  await slEnsure(env);const b=await body(r);
  if(p==='/api/o/login'){
    let u=cl(b.u,14).toUpperCase().replace(/\s/g,''),pw=cl(b.pw,40);if(/^\d{7}$/.test(u))u='CLU'+u;
    if(!isOff(u)&&!CEN[u])return J({e:'bad'},401);
    let x=await env.DB.prepare('SELECT * FROM off_login WHERE uname=?').bind(u).first();
    if(!x){const salt=rnd(8);await env.DB.prepare('INSERT OR IGNORE INTO off_login(uname,salt,pw,changed,fails) VALUES(?,?,?,0,0)').bind(u,salt,await hashPin('123456',salt)).run();x=await env.DB.prepare('SELECT * FROM off_login WHERE uname=?').bind(u).first()}
    const now=Date.now();
    if(x.fails>=OFAIL&&(x.lk||0)>now)return J({e:'locked',m:Math.ceil((x.lk-now)/6e4)},429);
    if(x.fails>=OFAIL){await env.DB.prepare('UPDATE off_login SET fails=0,lk=0 WHERE uname=?').bind(u).run();x.fails=0}
    if((await hashPin(pw,x.salt))!==x.pw){const f=x.fails+1;await env.DB.prepare('UPDATE off_login SET fails=?,lk=? WHERE uname=?').bind(f,f>=OFAIL?now+OLOCK:0,u).run();return f>=OFAIL?J({e:'locked',m:OLOCK/6e4},429):J({e:'bad',left:OFAIL-f},401)}
    // reuse a still-valid token so logging in on a second device does not log out the first
    const keep=x.token&&x.tt&&now-x.tt<OTTL,tok=keep?x.token:rnd(24);await env.DB.prepare('UPDATE off_login SET fails=0,lk=0,token=?,tt=? WHERE uname=?').bind(tok,keep?x.tt:now,u).run();
    return J({ok:1,token:tok,u,role:isOff(u)?'BEO':'KP',label:u==='BEO'?'गटशिक्षणाधिकारी (BEO) – जत':isOff(u)?u+' – जत':'केंद्र: '+CEN[u],changed:x.changed?1:0});
  }
  const t=await offAuth(env,b);if(!t)return J({e:'auth'},401);
  if(!t.changed&&p!=='/api/o/chpw')return J({e:'pwchg'},403); // सुरुवातीचा पासवर्ड (123456) बदलेपर्यंत दुसरे काही चालत नाही
  const kp=!isOff(t.uname);
  if(p==='/api/o/pay'){
    if(!kp&&!OAEO.includes(t.uname))return J({e:'kp'},403);await pdEns(env);
    const bk='kpp:'+t.uname,pan=cl(b.pan,10).toUpperCase();let bound=(await env.DB.prepare('SELECT v FROM cfg WHERE k=?').bind(bk).first())||null;bound=bound?bound.v:'';
    if(pan&&kp){if(!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))return J({ok:1,none:1,need:1,msg:'PAN चुकीचा आहे.'});const hp=await pdHid(env,'P'+pan);if(!(await pdMons(env,hp)).length)return J({ok:1,none:1,need:1,msg:'या PAN साठी वेतन माहिती सापडली नाही.'});bound=hp;await env.DB.prepare('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)').bind(bk,hp).run()}
    const hid=[await pdHid(env,'K'+t.uname),bound],dm=await pdMons(env,hid),m=cl(b.month,12).replace(/[^A-Za-z0-9_]/g,'');
    if(!dm.length)return kp?J({ok:1,none:1,need:1,msg:'पावती दिसण्यासाठी तुमचा PAN क्रमांक एकदा टाका.'}):J({ok:1,none:1,need:0,msg:'तुमची वेतन पावती अजून उपलब्ध नाही. पगार फाईल आयात झाल्यावर येथे दिसेल.'});
    const mon=dm.some(x=>x.mon===m)?m:dm[0].mon,s2=await pdSlip(env,hid,mon,'');
    return J({ok:1,months:dm.map(x=>x.mon),month:mon,p:s2?s2.p:null,nm:s2?s2.nm:'',ds:s2?s2.ds:(kp?'केंद्रप्रमुख':'शि.वि.अ.'),nw:s2?s2.nw:0,lb:s2?s2.lb||null:null,sc:kp?'केंद्र: '+(CEN[t.uname]||''):'पंचायत समिती जत',sh:'',pn:'',bound:bound?1:0,nopan:kp?0:1});
  }
  if(p==='/api/o/chpw'){
    const old=cl(b.old,40),nw=cl(b.nw,40);
    if(nw.length<6||nw==='123456')return J({e:'weak'},400);
    if((await hashPin(old,t.salt))!==t.pw)return J({e:'bad'},401);
    const salt=rnd(8),tok=rnd(24);await env.DB.prepare('UPDATE off_login SET salt=?,pw=?,changed=1,token=?,tt=? WHERE uname=?').bind(salt,await hashPin(nw,salt),tok,Date.now(),t.uname).run();
    return J({ok:1,token:tok});
  }
  const ss=(kp?await env.DB.prepare('SELECT c.udise,c.code,s.name FROM sch_center c LEFT JOIN schools s ON s.udise=c.udise WHERE c.code=? ORDER BY c.udise').bind(t.uname).all():await env.DB.prepare('SELECT c.udise,c.code,s.name FROM sch_center c LEFT JOIN schools s ON s.udise=c.udise ORDER BY c.code,c.udise').all()).results;
  const ok=new Set(ss.map(x=>x.udise));
  if(p==='/api/o/mdm'||p==='/api/o/mdmsave'){
    await mdmEns(env);
    const mon=cl(b.mon,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mon))return J({e:'mon'},400);
    if(p==='/api/o/mdmsave'){
      if(!kp)return J({e:'kp'},403);const st=[],now=new Date().toISOString();
      for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,80)){const u=cl(x&&x.u,11);if(!ok.has(u)||!Array.isArray(x.d))continue;st.push(mdmUp(env,mon,u,x.d,now))}
      if(st.length)await env.DB.batch(st);
      return J({ok:1,n:st.length});
    }
    const rw=(await env.DB.prepare('SELECT udise,d,up FROM mdm WHERE mon=?').bind(mon).all()).results,rows={},up={};
    rw.forEach(x=>{if(!ok.has(x.udise))return;try{rows[x.udise]=JSON.parse(x.d);up[x.udise]=x.up}catch(e){}});
    const o={ok:1,mon,sch:ss.map(x=>({u:x.udise,nm:x.name||'',c:x.code})),rows,up};
    if(kp){o.prev=await mdmPrev(env,mon,ok);o.auto=await mdmAuto(env,mon,ok)}
    return J(o);
  }
  if(p==='/api/o/lv'||p==='/api/o/lvimg'){
    await lvEns(env);
    if(p==='/api/o/lvimg'){const x=await env.DB.prepare('SELECT udise,img FROM sch_lv WHERE id=?').bind(parseInt(b.id)||0).first();if(!x||!ok.has(x.udise))return J({e:'nf'},404);return phGet(env,x.img,'lv/'+x.udise+'/',b.n)}
    const mon=/^\d{4}-(0[1-9]|1[0-2])$/.test(cl(b.mon,7))?cl(b.mon,7):'';
    const rs=(await env.DB.prepare('SELECT l.id,l.udise,l.shalarth sh,l.tname tn,l.typ,l.fd,l.td,l.days,l.rm,l.img,l.upd,s.name sc FROM sch_lv l LEFT JOIN schools s ON s.udise=l.udise'+(mon?' WHERE l.fd<=? AND l.td>=?':'')+' ORDER BY l.fd DESC,l.id DESC LIMIT 3000').bind(...(mon?[mon+'-31',mon+'-01']:[])).all()).results;
    const cm={};ss.forEach(x=>cm[x.udise]=x.code);
    return J({ok:1,rows:rs.filter(x=>ok.has(x.udise)).map(x=>({id:x.id,u:x.udise,sc:x.sc||'',c:cm[x.udise],sh:x.sh,tn:x.tn,typ:x.typ,fd:x.fd,td:x.td,days:x.days,rm:x.rm,n:phN(x.img),upd:x.upd}))});
  }
  if(p==='/api/o/vpget'||p==='/api/o/vpsave'){
    // भेट नियोजन: KP आपल्या केंद्राचे गट (k='cfg') व महिन्याचे नियोजन (k='m:YYYY-MM') साठवतो
    if(!kp)return J({e:'kp'},403);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS kp_vplan(code TEXT, k TEXT, data TEXT, upd TEXT, PRIMARY KEY(code,k))").run();
    const k=cl(b.k,12);if(!/^(cfg|m:\d{4}-(0[1-9]|1[0-2]))$/.test(k))return J({e:'arg'},400);
    if(p==='/api/o/vpget'){const x=await env.DB.prepare('SELECT data FROM kp_vplan WHERE code=? AND k=?').bind(t.uname,k).first();return J({ok:1,data:x?x.data:null})}
    const d=typeof b.data==='string'?b.data:'';if(!d||d.length>60000)return J({e:'arg'},400);
    try{JSON.parse(d)}catch(e){return J({e:'arg'},400)}
    await env.DB.prepare('INSERT INTO kp_vplan(code,k,data,upd) VALUES(?,?,?,?) ON CONFLICT(code,k) DO UPDATE SET data=excluded.data,upd=excluded.upd').bind(t.uname,k,d,new Date().toISOString()).run();
    return J({ok:1});
  }
  if(p==='/api/o/dy'||p==='/api/o/dysave'||p==='/api/o/dydel'||p==='/api/o/dyimg'){
    await lvEns(env);const codes=new Set(ss.map(x=>x.code));
    const own=async id=>{const x=await env.DB.prepare('SELECT * FROM kp_diary WHERE id=?').bind(parseInt(id)||0).first();return x&&(kp?x.code===t.uname:codes.has(x.code))?x:null};
    if(p==='/api/o/dyimg'){const x=await own(b.id);return x?phGet(env,x.img,'dy/'+x.code+'/',b.n):J({e:'nf'},404)}
    if(p==='/api/o/dydel'){if(!kp)return J({e:'kp'},403);const x=await own(b.id);if(x){await phDel(env,x.img,'dy/'+x.code+'/');await env.DB.prepare('DELETE FROM kp_diary WHERE id=?').bind(x.id).run()}return J({ok:1})}
    if(p==='/api/o/dysave'){
      if(!kp)return J({e:'kp'},403);const dt=cl(b.dt,10),kind=cl(b.kind,40),place=cl(b.place,40),rm=cl(b.rm,1500);let pn=cl(b.pn,100),ud=cl(b.udise,11).replace(/\D/g,'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(dt)||!kind||!place||rm.length<2)return J({e:'arg'},400);
      if(ud){if(!ok.has(ud))return J({e:'na'},403);const sc=ss.find(x=>x.udise===ud);pn=(sc&&sc.name)||pn}
      let id=parseInt(b.id)||0,old=[];if(id){const x=await own(id);if(!x)return J({e:'nf'},404);try{old=JSON.parse(x.img||'[]')}catch(e){}}
      else if((await env.DB.prepare('SELECT COUNT(*) c FROM kp_diary WHERE code=?').bind(t.uname).first()).c>=3000)return J({e:'max'},400);
      const ph=await phPut(env,b.imgs,'dy/'+t.uname+'/'+Date.now().toString(36)+'-',old);if(ph.e)return J({e:ph.e},400);const now=new Date().toISOString();
      if(id)await env.DB.prepare('UPDATE kp_diary SET dt=?,kind=?,place=?,udise=?,pn=?,rm=?,img=?,upd=? WHERE id=? AND code=?').bind(dt,kind,place,ud,pn,rm,JSON.stringify(ph.keys),now,id,t.uname).run();
      else await env.DB.prepare('INSERT INTO kp_diary(code,dt,kind,place,udise,pn,rm,img,upd) VALUES(?,?,?,?,?,?,?,?,?)').bind(t.uname,dt,kind,place,ud,pn,rm,JSON.stringify(ph.keys),now).run();
      return J({ok:1});
    }
    const mon=/^\d{4}-(0[1-9]|1[0-2])$/.test(cl(b.mon,7))?cl(b.mon,7):'',cf=cl(b.c,20);
    let q='SELECT id,code,dt,kind,place,udise,pn,rm,img,upd FROM kp_diary WHERE 1=1',pr=[];
    if(kp){q+=' AND code=?';pr.push(t.uname)}else if(cf&&codes.has(cf)){q+=' AND code=?';pr.push(cf)}
    if(mon){q+=' AND dt>=? AND dt<=?';pr.push(mon+'-01',mon+'-31')}
    q+=' ORDER BY dt DESC,id DESC LIMIT 1500';
    const rs=(await env.DB.prepare(q).bind(...pr).all()).results;
    return J({ok:1,rows:rs.filter(x=>codes.has(x.code)).map(x=>({id:x.id,c:x.code,dt:x.dt,kind:x.kind,place:x.place,u:x.udise,pn:x.pn,rm:x.rm,n:phN(x.img),upd:x.upd}))});
  }
  if(p==='/api/o/geo'||p==='/api/o/geoset'){
    // शाळांचे स्थान (GPS): KP आपल्या केंद्रातील शाळांचे, BEO/AEO सर्वांचे. नोंद KP, BEO किंवा शाळा (मुख्याध्यापक) करू शकतात; नवी नोंद जुनीची जागा घेते.
    await geoEns(env);await vsEns(env);
    if(p==='/api/o/geoset'){const u=cl(b.udise,11).replace(/\D/g,''),g=geoClean(b);if(!ok.has(u)||!g)return J({e:'arg'},400);await geoPut(env,u,g,kp?'KP':'BEO');return J({ok:1})}
    const gs=(await env.DB.prepare('SELECT udise,lat,lng,acc,by,upd FROM sch_geo').all()).results||[],G={};gs.forEach(x=>G[x.udise]=x);
    const n=new Date(Date.now()+19800000),y=n.getUTCMonth()>=5?n.getUTCFullYear():n.getUTCFullYear()-1,mo=n.toISOString().slice(0,7);
    const vr=(await env.DB.prepare("SELECT udise,dt FROM kp_visit WHERE st='Final' AND dt>=?").bind(y+'-06-01').all()).results||[],V={};
    vr.forEach(x=>{const o=V[x.udise]=V[x.udise]||{l:'',y:0,m:0};if(x.dt>o.l)o.l=x.dt;o.y++;if(x.dt.slice(0,7)===mo)o.m++});
    return J({ok:1,mo,rows:ss.map(x=>{const g=G[x.udise],v=V[x.udise]||{l:'',y:0,m:0};return{u:x.udise,n:x.name||x.udise,c:x.code,lat:g?g.lat:null,lng:g?g.lng:null,acc:g?g.acc:null,by:g?g.by:'',up:g?g.upd:'',lv:v.l,vy:v.y,vm:v.m}})});
  }
  if(p==='/api/o/vs'||p==='/api/o/vsget'||p==='/api/o/vsctx'||p==='/api/o/vssave'||p==='/api/o/vsdel'||p==='/api/o/vsimg'){
    // शाळा भेट फॉर्म: KP आपल्या केंद्रातील शाळा, BEO सर्व शाळा. नोंद फक्त भरणारा बदलू/काढू शकतो; अंतिम (Final) नोंदी KP/BEO दोघे पाहतात, मसुदा फक्त भरणारा.
    await vsEns(env);const SC={};ss.forEach(x=>SC[x.udise]=x);
    const own=x=>!!x&&x.code===t.uname,vis=x=>!!x&&ok.has(x.udise)&&(x.st==='Final'||own(x)),byId=id=>env.DB.prepare('SELECT * FROM kp_visit WHERE id=?').bind(parseInt(id)||0).first();
    if(p==='/api/o/vsimg'){const x=await byId(b.id);return vis(x)?phGet(env,x.img,'vs/'+x.code+'/',b.n):J({e:'nf'},404)}
    if(p==='/api/o/vsdel'){const x=await byId(b.id);if(own(x)){await phDel(env,x.img,'vs/'+x.code+'/');await env.DB.prepare('DELETE FROM kp_visit WHERE id=?').bind(x.id).run()}return J({ok:1})}
    if(p==='/api/o/vsget'){const x=await byId(b.id);if(!vis(x))return J({e:'nf'},404);let d={};try{d=JSON.parse(x.data||'{}')}catch(e){}
      return J({ok:1,v:{id:x.id,c:x.code,u:x.udise,sc:(SC[x.udise]||{}).name||'',k:(SC[x.udise]||{}).code||'',dt:x.dt,tin:x.tin,tout:x.tout,vt:x.vt,st:x.st,score:x.score,g:x.grade,n:phN(x.img),mine:own(x)?1:0,d}})}
    if(p==='/api/o/vsctx'){
      const u=cl(b.udise,11).replace(/\D/g,'');if(!ok.has(u))return J({e:'na'},403);
      const dt=/^\d{4}-\d{2}-\d{2}$/.test(cl(b.dt,10))?cl(b.dt,10):istDay();await lvEns(env);await pmEnsure(env);
      const [tc,ro,lv,pm,pv,tl]=await Promise.all([
        env.DB.prepare("SELECT shalarth sh,name n FROM teachers WHERE udise=? AND status='ok' ORDER BY name").bind(u).all(),
        env.DB.prepare('SELECT pen p,cls c,div v,name n,med FROM roster WHERE udise=? ORDER BY cls,div,name').bind(u).all(),
        env.DB.prepare('SELECT shalarth sh,tname n,typ,fd,td FROM sch_lv WHERE udise=? AND fd<=? AND td>=?').bind(u,dt,dt).all().catch(()=>({results:[]})),
        env.DB.prepare('SELECT menu,p15,p68,cooked FROM pm_daily WHERE udise=? AND date=?').bind(u,dt).first().catch(()=>null),
        env.DB.prepare("SELECT dt,data FROM kp_visit WHERE udise=? AND dt<? AND st='Final' AND COALESCE(json_extract(data,'$.fu'),'')<>'' ORDER BY dt DESC,id DESC LIMIT 1").bind(u,dt).first(),
        env.DB.prepare('SELECT t.shalarth sh,c.cls c,c.div v FROM tclasses c JOIN teachers t ON t.id=c.tid WHERE c.udise=?').bind(u).all().catch(()=>({results:[]}))]);
      let prev=null;if(pv){try{const d=JSON.parse(pv.data||'{}');prev={dt:pv.dt,fu:cl(d.fu,600),fd:cl(d.fd,10)}}catch(e){}}
      const tcl={};(tl.results||[]).forEach(x=>{(tcl[x.sh]=tcl[x.sh]||[]).push(x.c+'|'+(x.v||''))});
      return J({ok:1,dt,tc:tc.results||[],ro:ro.results||[],lv:lv.results||[],pm:pm||null,prev,tcl});
    }
    if(p==='/api/o/vssave'){
      const u=cl(b.udise,11).replace(/\D/g,''),dt=cl(b.dt,10),tin=cl(b.tin,5),tout=cl(b.tout,5),vt=cl(b.vt,30);
      if(!ok.has(u)||!/^\d{4}-\d{2}-\d{2}$/.test(dt)||dt>istDay())return J({e:'arg'},400);
      const dd=b.d&&typeof b.d==='object'&&!Array.isArray(b.d)?b.d:{};await geoEns(env);if(Array.isArray(dd.tc))dd.tc.forEach(t=>{if(t&&t.sig&&!(typeof t.sig==='string'&&t.sig.length<=60000&&/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(t.sig)))delete t.sig});{const g=geoClean(dd.geo);if(g){const sg=await env.DB.prepare('SELECT lat,lng FROM sch_geo WHERE udise=?').bind(u).first();dd.geo={lat:g.lat,lng:g.lng,acc:g.acc,ts:cl(dd.geo.ts,30)};if(sg)dd.gd=geoDist(sg,g);else delete dd.gd}else{delete dd.geo;delete dd.gd}}const dj=JSON.stringify(dd);if(dj.length>200000)return J({e:'big'},400);
      let id=parseInt(b.id)||0,old=[];
      if(id){const x=await byId(id);if(!own(x))return J({e:'nf'},404);try{old=JSON.parse(x.img||'[]')}catch(e){}}
      else if((await env.DB.prepare('SELECT COUNT(*) c FROM kp_visit WHERE code=?').bind(t.uname).first()).c>=3000)return J({e:'max'},400);
      const ph=await phPut(env,b.imgs,'vs/'+t.uname+'/'+Date.now().toString(36)+'-',old);if(ph.e)return J({e:ph.e},400);
      const sc=Math.max(0,Math.min(100,Math.round(Number(b.score))||0)),g=['A','B','C','D'].includes(b.g)?b.g:'',st=b.final?'Final':'Draft',now=new Date().toISOString();
      if(id)await env.DB.prepare('UPDATE kp_visit SET udise=?,dt=?,tin=?,tout=?,vt=?,data=?,img=?,score=?,grade=?,st=?,upd=? WHERE id=? AND code=?').bind(u,dt,tin,tout,vt,dj,JSON.stringify(ph.keys),sc,g,st,now,id,t.uname).run();
      else{const r=await env.DB.prepare('INSERT INTO kp_visit(code,udise,dt,tin,tout,vt,data,img,score,grade,st,upd) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(t.uname,u,dt,tin,tout,vt,dj,JSON.stringify(ph.keys),sc,g,st,now).run();id=r.meta.last_row_id}
      return J({ok:1,id});
    }
    const mo=cl(b.mon,7),cf=cl(b.c,20),uf=cl(b.udise,11).replace(/\D/g,'');
    let q="SELECT id,code,udise,dt,tin,tout,vt,score,grade,st,img FROM kp_visit WHERE (st='Final' OR code=?)",pr=[t.uname];
    if(mo==='Y'){const n=new Date(Date.now()+19800000),y=n.getUTCMonth()>=5?n.getUTCFullYear():n.getUTCFullYear()-1;q+=' AND dt>=?';pr.push(y+'-06-01')}
    else if(/^\d{4}-(0[1-9]|1[0-2])$/.test(mo)){q+=' AND dt>=? AND dt<=?';pr.push(mo+'-01',mo+'-31')}
    if(uf){q+=' AND udise=?';pr.push(uf)}
    q+=' ORDER BY dt DESC,id DESC LIMIT 3000';
    const rs=(await env.DB.prepare(q).bind(...pr).all()).results.filter(x=>ok.has(x.udise)&&(!cf||(SC[x.udise]||{}).code===cf));
    return J({ok:1,rows:rs.map(x=>({id:x.id,c:x.code,u:x.udise,sc:(SC[x.udise]||{}).name||'',k:(SC[x.udise]||{}).code||'',dt:x.dt,tin:x.tin,tout:x.tout,vt:x.vt,score:x.score,g:x.grade,st:x.st,n:phN(x.img),mine:own(x)?1:0}))});
  }
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
      const q=(await env.DB.prepare('SELECT r.pen,r.name,r.cls,r.div,r.med,i.gender,i.dob,i.roll FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen WHERE r.udise=? ORDER BY r.cls,r.div,r.name').bind(u).all()).results;
      return J({ok:1,rows:q});}
    const q=(await env.DB.prepare('SELECT r.udise u,r.cls,COALESCE(r.med,\'\') med,COUNT(*) n,SUM(i.gender=\'M\') m,SUM(i.gender=\'F\') f FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen GROUP BY r.udise,r.cls,COALESCE(r.med,\'\')').all()).results;
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
    if(b.act==='ret'){const rm=cl(b.remark,300);if(rm.length<3)return J({e:'remark'},400);await env.DB.batch([env.DB.prepare("UPDATE tch_edit SET status='Returned',remark=?,upd=? WHERE shalarth=?").bind(rm,istDay(),sh),env.DB.prepare("UPDATE tch_rec SET status='Returned' WHERE shalarth=? AND status='Forwarded'").bind(sh)]);
      let mail=0;try{let em='';try{em=(JSON.parse(e.data||'{}')['ई-मेल आयडी']||'').trim()}catch(x){}
        if(!em){const q=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(sh).first();try{em=(JSON.parse(q&&q.data||'{}')['ई-मेल आयडी']||'').trim()}catch(x){}}
        const tn=await env.DB.prepare('SELECT name FROM teachers WHERE shalarth=?').bind(sh).first();
        if(em)mail=await mailSend(env,em,'आपली माहिती परत पाठवली आहे – अभ्यास मंच','<div style="font-family:sans-serif;font-size:16px;line-height:1.6"><p>नमस्कार '+esc(tn&&tn.name)+',</p><p>आपण पाठवलेली <b>"माझी माहिती"</b> केंद्रप्रमुख / गटशिक्षणाधिकारी कार्यालयाने <b>परत पाठवली</b> आहे.</p><p><b>कारण / शेरा:</b><br>'+esc(rm)+'</p><p>कृपया अभ्यास मंच (<a href="https://abhyasmanch.in">abhyasmanch.in</a>) → शिक्षक लॉगिन → माझी माहिती मध्ये जाऊन दुरुस्ती करा व पुन्हा पाठवा.</p><p>— अभ्यास मंच</p></div>')}catch(x){}
      return J({ok:1,status:'Returned',mail});}
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
  if(!t.changed&&p!=='/api/s/chpw')return J({e:'pwchg'},403); // सुरुवातीचा पासवर्ड बदलेपर्यंत दुसरे काही चालत नाही
  if(p==='/api/s/chpw'){
    const old=cl(b.old,40),nw=cl(b.nw,40);
    if(nw.length<6||nw==='123456')return J({e:'weak'},400);
    if((await hashPin(old,t.salt))!==t.pw)return J({e:'bad'},401);
    const salt=rnd(8);await env.DB.prepare('UPDATE school_login SET salt=?,pw=?,changed=1 WHERE udise=?').bind(salt,await hashPin(nw,salt),t.udise).run();
    return J({ok:1});
  }
  if(p==='/api/s/geo'||p==='/api/s/geoset'){
    await geoEns(env);
    if(p==='/api/s/geoset'){const g=geoClean(b);if(!g)return J({e:'arg'},400);await geoPut(env,t.udise,g,'S');}
    const x=await env.DB.prepare('SELECT lat,lng,acc,by,upd FROM sch_geo WHERE udise=?').bind(t.udise).first();
    return J({ok:1,g:x?{lat:x.lat,lng:x.lng,acc:x.acc,by:x.by,up:x.upd}:null});
  }
  if(p==='/api/s/mdm'||p==='/api/s/mdmsave'){
    await mdmEns(env);const mon=cl(b.mon,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mon))return J({e:'mon'},400);
    if(p==='/api/s/mdmsave'){if(!Array.isArray(b.d))return J({e:'bad'},400);const now=new Date().toISOString();await mdmUp(env,mon,t.udise,b.d,now).run();return J({ok:1,up:now})}
    const x=await env.DB.prepare('SELECT d,up FROM mdm WHERE mon=? AND udise=?').bind(mon,t.udise).first();let d=null;try{d=x?JSON.parse(x.d):null}catch(e){}
    return J({ok:1,mon,d,up:x?x.up:'',prev:(await mdmPrev(env,mon,new Set([t.udise])))[t.udise]||null,auto:(await mdmAuto(env,mon,new Set([t.udise])))[t.udise]||null});
  }
  if(p==='/api/s/lv'||p==='/api/s/lvsave'||p==='/api/s/lvdel'||p==='/api/s/lvimg'){
    await lvEns(env);const pre='lv/'+t.udise+'/';
    if(p==='/api/s/lvimg'){const x=await env.DB.prepare('SELECT img FROM sch_lv WHERE id=? AND udise=?').bind(parseInt(b.id)||0,t.udise).first();return phGet(env,x&&x.img,pre,b.n)}
    if(p==='/api/s/lvdel'){const id=parseInt(b.id)||0,x=await env.DB.prepare('SELECT img FROM sch_lv WHERE id=? AND udise=?').bind(id,t.udise).first();if(x){await phDel(env,x.img,pre);await env.DB.prepare('DELETE FROM sch_lv WHERE id=? AND udise=?').bind(id,t.udise).run()}return J({ok:1})}
    if(p==='/api/s/lvsave'){
      const dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(cl(v,10))?cl(v,10):'',fd=dt(b.fd),td=dt(b.td),typ=cl(b.typ,40),rm=cl(b.rm,300),sh=cl(b.sh,20).toUpperCase().replace(/\s/g,'');
      if(!fd||!td||td<fd||!typ)return J({e:'arg'},400);const tc=await env.DB.prepare('SELECT name FROM teachers WHERE shalarth=? AND udise=?').bind(sh,t.udise).first();if(!tc)return J({e:'teacher'},400);
      const days=Math.min(400,Math.round((Date.parse(td)-Date.parse(fd))/864e5)+1);let id=parseInt(b.id)||0,old=[];
      if(id){const x=await env.DB.prepare('SELECT img FROM sch_lv WHERE id=? AND udise=?').bind(id,t.udise).first();if(!x)return J({e:'nf'},404);try{old=JSON.parse(x.img||'[]')}catch(e){}}
      else if((await env.DB.prepare('SELECT COUNT(*) c FROM sch_lv WHERE udise=?').bind(t.udise).first()).c>=1500)return J({e:'max'},400);
      const ph=await phPut(env,b.imgs,pre+Date.now().toString(36)+'-',old);if(ph.e)return J({e:ph.e},400);const now=new Date().toISOString();
      if(id)await env.DB.prepare('UPDATE sch_lv SET shalarth=?,tname=?,typ=?,fd=?,td=?,days=?,rm=?,img=?,upd=? WHERE id=? AND udise=?').bind(sh,tc.name,typ,fd,td,days,rm,JSON.stringify(ph.keys),now,id,t.udise).run();
      else await env.DB.prepare('INSERT INTO sch_lv(udise,shalarth,tname,typ,fd,td,days,rm,img,upd) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(t.udise,sh,tc.name,typ,fd,td,days,rm,JSON.stringify(ph.keys),now).run();
      return J({ok:1});
    }
    const tl=(await env.DB.prepare('SELECT shalarth sh,name n FROM teachers WHERE udise=? ORDER BY name').bind(t.udise).all()).results,rs=(await env.DB.prepare('SELECT id,shalarth sh,tname tn,typ,fd,td,days,rm,img,upd FROM sch_lv WHERE udise=? ORDER BY fd DESC,id DESC LIMIT 400').bind(t.udise).all()).results;
    return J({ok:1,teachers:tl,rows:rs.map(x=>({id:x.id,sh:x.sh,tn:x.tn,typ:x.typ,fd:x.fd,td:x.td,days:x.days,rm:x.rm,n:phN(x.img),upd:x.upd}))});
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
  if(p==='/api/s/me'){await schCols(env);const sc=await env.DB.prepare('SELECT name,med,cmin,cmax FROM schools WHERE udise=?').bind(t.udise).first();return J({ok:1,udise:t.udise,school:sc?sc.name:'',med:sc&&sc.med||'',cmin:sc&&sc.cmin||0,cmax:sc&&sc.cmax||0,changed:t.changed?1:0})}
  return J({e:'nf'},404);
}
let TCK=false;
async function tcEns(env){if(TCK)return;try{await env.DB.prepare('ALTER TABLE tclasses ADD COLUMN ct INTEGER DEFAULT 0').run()}catch(e){}try{await env.DB.prepare('ALTER TABLE tclasses ADD COLUMN subs TEXT').run()}catch(e){}TCK=true}
async function ctBlock(env,tid,ud,cls,dv){await tcEns(env);const o=await env.DB.prepare('SELECT c.tid,t.name FROM tclasses c JOIN teachers t ON t.id=c.tid WHERE c.udise=? AND c.cls=? AND c.div=? AND c.ct=1 LIMIT 1').bind(ud,cls,dv).first();return o&&o.tid!==tid?o.name:''}
const okDob=s=>/^(19|20)\d\d-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s))?s:'';
async function imp(env,rw,tid){
    const rows=(Array.isArray(rw)?rw:[]).slice(0,150);let n=0;const st=[],okp=new Set();
    for(const x of rows){
      if(tid&&!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(tid,cl(x.udise,11),parseInt(x.cls)||0,(cl(x.div,2).toUpperCase())||'A').first())continue;
      if(tid&&await ctBlock(env,tid,cl(x.udise,11),parseInt(x.cls)||0,(cl(x.div,2).toUpperCase())||'A'))continue;
      const pen=cl(x.pen,11).replace(/\D/g,''),ud=cl(x.udise,11).replace(/\D/g,''),cls=parseInt(x.cls)||0,by=cl(x.by,4).replace(/\D/g,''),name=cl(x.name,60);
      if(pen.length!==11||ud.length!==11||cls<1||cls>8||by.length!==4||name.length<2)continue;
      if(tid){const o=await env.DB.prepare('SELECT udise FROM roster WHERE pen=?').bind(pen).first();if(o&&o.udise!==ud)continue}
      okp.add(pen);
      const salt=rnd(6),h=await sha(salt+by),med=x.med==='kn'?'kn':'mr',dv=(cl(x.div,2).toUpperCase())||'A';
      st.push(env.DB.prepare("INSERT INTO roster(pen,udise,cls,div,name,med,salt,pw,pw0,salt0) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET udise=excluded.udise,cls=excluded.cls,div=excluded.div,name=excluded.name,med=excluded.med").bind(pen,ud,cls,dv,name,med,salt,h,h,salt));n++;
    }
    const dq=[],CT=['GEN','SC','ST','VJA','NTB','NTC','NTD','OBC','SBC'];
    for(const x of rows){const pn=cl(x.pen,11).replace(/\D/g,'');if(pn.length!==11||!okp.has(pn))continue;const dd=okDob(cl(x.dob,10)),g=['M','F','O'].includes(x.gender)?x.gender:'',ct=CT.includes(x.cat)?x.cat:'',gr=cl(x.gr,15),ro=cl(x.roll,6);if(dd||g||ct||gr||ro)dq.push([pn,dd,g,ct,gr,ro])}
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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_bmir(udise TEXT, pen TEXT, rd TEXT, h REAL, w REAL, upd TEXT, PRIMARY KEY(udise,pen,rd))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_rcpt(udise TEXT, id TEXT, date TEXT, supplier TEXT, challan TEXT, items TEXT, remark TEXT, by TEXT, upd TEXT, PRIMARY KEY(udise,id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS hol(id TEXT PRIMARY KEY, d1 TEXT, d2 TEXT, name TEXT, type TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_rate(d TEXT PRIMARY KEY, r15 REAL, r68 REAL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_cook(udise TEXT, id TEXT, name TEXT, role TEXT, gender TEXT, bank TEXT, ifsc TEXT, acct TEXT, aadhaar TEXT, addr TEXT, pin TEXT, upd TEXT, sname TEXT, PRIMARY KEY(udise,id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pm_cfg(udise TEXT PRIMARY KEY, grp TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS school_bank(udise TEXT PRIMARY KEY, tan TEXT, acct TEXT)")]);
  try{await env.DB.prepare('ALTER TABLE pm_cook ADD COLUMN sname TEXT').run()}catch(e){}
  try{await env.DB.prepare('ALTER TABLE pm_rcpt ADD COLUMN img TEXT').run()}catch(e){}
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS pm_scan(udise TEXT, day TEXT, n INTEGER, PRIMARY KEY(udise,day))').run();
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
  if(!t.changed)return J({e:'pwchg'},403);
  await pmEnsure(env);
  const u=t.udise,by=cl(b.by,40)||'शाळा';
  const bmiRd=s=>/^\d{4}-(03|09|12)$/.test(String(s||''))?String(s):'';
  if(p==='/api/pm/students'){
    // BMI तपासणी फेरी: सप्टेंबर, डिसेंबर, मार्च (rd = 'YYYY-09' / 'YYYY-12' / 'YYYY-03'). ph/pw = मागील फेरीची (किंवा जुनी फेरी-नसलेली) नोंद.
    const rd=bmiRd(b.rd);
    const rows=(await env.DB.prepare("SELECT r.pen,r.cls,r.div,r.name,m.h h,m.w w,(SELECT q.h FROM pm_bmir q WHERE q.udise=r.udise AND q.pen=r.pen AND q.rd<? ORDER BY q.rd DESC LIMIT 1) ph,(SELECT q.w FROM pm_bmir q WHERE q.udise=r.udise AND q.pen=r.pen AND q.rd<? ORDER BY q.rd DESC LIMIT 1) pw,l.h lh,l.w lw FROM roster r LEFT JOIN pm_bmir m ON m.pen=r.pen AND m.udise=r.udise AND m.rd=? LEFT JOIN pm_bmi l ON l.pen=r.pen AND l.udise=r.udise WHERE r.udise=? ORDER BY r.cls,r.div,r.name LIMIT 800").bind(rd||'0',rd||'0',rd||'0',u).all()).results.map(x=>({pen:x.pen,cls:x.cls,div:x.div,name:x.name,h:x.h,w:x.w,ph:x.ph!=null?x.ph:x.lh,pw:x.pw!=null?x.pw:x.lw}));
    return J({ok:1,rows,rd});
  }
  if(p==='/api/pm/bmisave'){
    const rd=bmiRd(b.rd);if(!rd)return J({e:'rd'},400);
    const rs=[],now=istDay();
    for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,120)){
      const pen=cl(x.pen,11).replace(/\D/g,''),h=parseFloat(x.h),wt=parseFloat(x.w);
      if(pen.length!==11)continue;
      if(!(h>50&&h<220&&wt>5&&wt<150)){rs.push(env.DB.prepare('DELETE FROM pm_bmir WHERE udise=? AND pen=? AND rd=?').bind(u,pen,rd));continue}
      rs.push(env.DB.prepare('INSERT INTO pm_bmir(udise,pen,rd,h,w,upd) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM roster WHERE pen=? AND udise=?) ON CONFLICT(udise,pen,rd) DO UPDATE SET h=excluded.h,w=excluded.w,upd=excluded.upd').bind(u,pen,rd,h,wt,now,pen,u));
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
    const rc=(await env.DB.prepare('SELECT id,date,supplier,challan,items,remark,img FROM pm_rcpt WHERE udise=? AND date>=? AND date<=? ORDER BY date').bind(u,fy+'-04-01',(fy+1)+'-03-31').all()).results;
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(u).first();
    const hol=(await env.DB.prepare('SELECT id,d1,d2,name,type FROM hol ORDER BY d1').all()).results;
    const kc=await env.DB.prepare('SELECT code FROM sch_center WHERE udise=?').bind(u).first().catch(()=>null);
    const pd=(await env.DB.prepare("SELECT date,p15,p68,pulse15,pulse68,cooked FROM pm_daily WHERE udise=? AND date<? AND date>='2020-04-01' ORDER BY date").bind(u,fy+'-04-01').all()).results;
    const ps=(await env.DB.prepare("SELECT month,grp,data FROM pm_stock WHERE udise=? AND month<? AND month>='2020-04'").bind(u,fy+'-04').all()).results;
    return J({ok:1,fy,udise:u,school:sc?sc.name:'',kendra:kc&&CEN[kc.code]?CEN[kc.code]:'',prev:{daily:pd,stock:ps},teacher:by,daily:d,stock:st,rcpt:rc,hol,rate:(await env.DB.prepare('SELECT d,r15,r68 FROM pm_rate ORDER BY d').all()).results,sg:await pmSg(env,u),bmi:await (async()=>{const d=istDay(),mo=d.slice(5,7);if(!['03','09','12'].includes(mo))return null;const rd=d.slice(0,7),n=(await env.DB.prepare('SELECT COUNT(*) c FROM pm_bmir WHERE udise=? AND rd=? AND h>0 AND w>0').bind(u,rd).first()).c||0,t=(await env.DB.prepare('SELECT COUNT(*) c FROM roster WHERE udise=?').bind(u).first()).c||0;return{rd,n,t}})(),cookn:((await env.DB.prepare('SELECT COUNT(*) c FROM pm_cook WHERE udise=?').bind(u).first())||{}).c||0});
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
    let id=cl(b.id,40),keys=[];
    if(id){const ex=await env.DB.prepare('SELECT img FROM pm_rcpt WHERE udise=? AND id=?').bind(u,id).first();if(!ex)return J({e:'nf'},404);try{keys=JSON.parse(ex.img||'[]')}catch(e){keys=[]}}
    else id='R'+Date.now().toString(36).toUpperCase();
    const imgs=Array.isArray(b.imgs)?b.imgs.slice(0,2):[];
    if(imgs.length){
      if(!env.BOOKS)return J({e:'noimg'},400);
      const bin=[];for(const d of imgs){const m=/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(d||''));if(!m||m[1].length>1000000)return J({e:'img'},400);const raw=atob(m[1]),u8=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u8[i]=raw.charCodeAt(i);bin.push(u8)}
      const nk=[];for(const u8 of bin){const k='pm-rcpt/'+u+'/'+id+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,16)+'.jpg';await env.BOOKS.put(k,u8,{httpMetadata:{contentType:'image/jpeg'}});nk.push(k)}
      for(const k of keys){try{await env.BOOKS.delete(k)}catch(e){}}
      keys=nk;
    }
    await env.DB.prepare('INSERT INTO pm_rcpt(udise,id,date,supplier,challan,items,remark,by,upd,img) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(udise,id) DO UPDATE SET date=excluded.date,supplier=excluded.supplier,challan=excluded.challan,items=excluded.items,remark=excluded.remark,by=excluded.by,upd=excluded.upd,img=excluded.img').bind(u,id,date,sup,cl(b.challan,60),JSON.stringify(items),cl(b.remark,200),by,new Date().toISOString(),JSON.stringify(keys)).run();
    return J({ok:1,id,img:keys.length});
  }
  if(p==='/api/pm/rdel'){
    const rid=cl(b.id,40),ex=await env.DB.prepare('SELECT img FROM pm_rcpt WHERE udise=? AND id=?').bind(u,rid).first();
    if(ex&&ex.img&&env.BOOKS){try{for(const k of JSON.parse(ex.img))if(k.startsWith('pm-rcpt/'+u+'/'))await env.BOOKS.delete(k)}catch(e){}}
    await env.DB.prepare('DELETE FROM pm_rcpt WHERE udise=? AND id=?').bind(u,rid).run();return J({ok:1});
  }
  if(p==='/api/pm/rimg'){
    const ex=await env.DB.prepare('SELECT img FROM pm_rcpt WHERE udise=? AND id=?').bind(u,cl(b.id,40)).first();let ks=[];try{ks=JSON.parse((ex&&ex.img)||'[]')}catch(e){}
    const k=ks[Math.max(0,parseInt(b.n)||0)];if(!k||!k.startsWith('pm-rcpt/'+u+'/')||!env.BOOKS)return J({e:'nf'},404);
    const o=await env.BOOKS.get(k);if(!o)return J({e:'nf'},404);
    return new Response(o.body,{headers:{'content-type':'image/jpeg','cache-control':'private, max-age=300'}});
  }
  if(p==='/api/pm/rscan'){
    const imgs=(Array.isArray(b.imgs)?b.imgs:[]).slice(0,2).map(d=>/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(d||''))).filter(Boolean);
    if(!imgs.length||imgs.some(m=>m[1].length>1000000))return J({e:'img'},400);
    const day=istDay(),q=await env.DB.prepare('SELECT n FROM pm_scan WHERE udise=? AND day=?').bind(u,day).first();
    if(q&&q.n>=30)return J({e:'limit'},429);
    await env.DB.prepare('INSERT INTO pm_scan(udise,day,n) VALUES(?,?,1) ON CONFLICT(udise,day) DO UPDATE SET n=n+1').bind(u,day).run();
    const si='तू शालेय पोषण आहार योजनेतील धान्यादी माल पावतीचे (चलन / delivery challan / bill) वाचन करणारा सहाय्यक आहेस. दिलेल्या १-२ फोटोंतील पावती(त्या) वाचून फक्त JSON दे. कल्पनेने काहीही भरू नकोस; न दिसणारे / न वाचता येणारे रिकामे ठेव. मराठी अंक (०-९) असल्यास इंग्रजी अंकात बदल.';
    const names=PM_ITEMS.join(', ');
    const tx='JSON रचना: {"date":"YYYY-MM-DD किंवा रिकामे","supplier":"पुरवठादाराचे नाव","challan":"पावती/चलन क्रमांक","items":[{"name":"खालील यादीतील नेमके नाव","qty":संख्या}],"other":["यादीत न बसणारे जिन्नस नावासह"]}\nजिन्नस यादी (name यापैकीच हवे): '+names+'.\nqty किलो (किग्रॅ) किंवा तेलासाठी लिटरमध्ये हवे: क्विंटल ×100, ग्रॅम ÷1000, मिली ÷1000. एकाच जिन्नसाच्या अनेक ओळी असतील तर बेरीज कर. दोन फोटो असतील तर दोन्ही मिळून एकच यादी दे. तूर/तुरीची डाळ = तूरडाळ, मसूर = मसूरडाळ, मुग = मूग (साबुत), मुगाची डाळ = मुगडाळ, वाटाणा = हिरवा वाटाणा, हरभरा/चणे = हरभरा, मीठ = मीठ, खाद्यतेल = तेल.';
    const g=await gemAsk(env,si,[{role:'user',parts:[...imgs.map(m=>({inlineData:{mimeType:'image/jpeg',data:m[1]}})),{text:tx}]}],{temperature:0,responseMimeType:'application/json'});
    if(!g.t)return J({e:g.e==='nokey'?'nokey':'fail'},502);
    let j={};try{j=JSON.parse(g.t.replace(/^```json|```$/g,''))}catch(e){return J({e:'parse'},502)}
    const r4=v=>Math.round((Number(v)||0)*1e4)/1e4,agg={};
    for(const x of (Array.isArray(j.items)?j.items:[])){const nm=String(x&&x.name||'').trim(),q=r4(x&&x.qty);if(PM_ITEMS.includes(nm)&&q>0&&q<100000)agg[nm]=r4((agg[nm]||0)+q)}
    const dt=/^\d{4}-\d{2}-\d{2}$/.test(String(j.date||''))&&dOk(j.date)&&j.date<=istDay()?j.date:'';
    return J({ok:1,date:dt,supplier:cl(j.supplier,120),challan:cl(j.challan,60),items:Object.keys(agg).map(k=>({name:k,qty:agg[k]})),other:(Array.isArray(j.other)?j.other:[]).map(x=>cl(x,40)).filter(Boolean).slice(0,10)});
  }
  return J({e:'nf'},404);
}
let STLF=false;async function stLf(env){if(STLF)return;try{await env.DB.prepare('ALTER TABLE students ADD COLUMN lf INTEGER DEFAULT 0').run()}catch(e){}STLF=true}
async function stuCall(p,r){
  if(p==='/api/s/result')return true;
  if(p!=='/api/s/login'&&p!=='/api/s/chpw')return false;
  let b={};try{b=await r.clone().json()||{}}catch(e){}
  if(p==='/api/s/login')return !!b.pen&&!b.udise;
  return /^Bearer \S+/.test(r.headers.get('authorization')||'')&&!b.token;
}
async function ext(p,r,env){
  // /api/s/login, /api/s/chpw and /api/s/result are shared by the school portal and PEN students:
  // student calls (PEN in body / Bearer token) must skip schoolApi, which would reject them.
  if(!(await stuCall(p,r))){const sr=await schoolApi(p,r,env);if(sr)return sr}
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
    await env.DB.prepare('INSERT INTO ai_score(sid,ts,sub,les,ty,lv,score,total,kind) VALUES(?,?,?,?,?,?,?,?,?)').bind(s.id,istDay(),cl(b.sub,60),cl(b.les,120),cl(b.type,10),cl(b.level,6),sc,tt,b.kind==='daily'?'daily':b.kind==='sch'?'sch':'quiz').run();
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
    const b=await body(r),s=await me(env,r),pw=cl(b.pw,40),old=cl(b.old,40);
    if(!s||!/^P\d{11}$/.test(s.mobile))return J({e:'auth'},401);
    if(pw.length<4)return J({e:'short'},400);
    const x=await env.DB.prepare('SELECT salt,pw,salt0,pw0 FROM roster WHERE pen=?').bind(s.mobile.slice(1)).first();if(!x)return J({e:'auth'},401);
    if(!old||!(await pwOk(old,x.salt,x.pw)))return J({e:'bad'},401);
    if(pw===old||(x.pw0&&await pwOk(pw,x.salt0,x.pw0)))return J({e:'same'},400);
    const salt=rnd(8);
    await env.DB.prepare('UPDATE roster SET salt=?,pw=?,changed=1 WHERE pen=?').bind(salt,'p:'+await hashPin(pw,salt),s.mobile.slice(1)).run();
    return J({ok:1});
  }
  if(p==='/api/sreg'){
    const b=await body(r),u=cl(b.udise,11).replace(/\D/g,''),rn=cl(b.name,60),po=cl(b.post,30),mo=cl(b.mobile,10),pw=cl(b.pw,40),sn=cl(b.sname,120)||('UDISE '+u);
    if(!/^27\d{9}$/.test(u))return J({e:'udise'},400);
    if(rn.length<2)return J({e:'name'},400);
    if(!po)return J({e:'post'},400);
    if(!okMob(mo))return J({e:'mobile'},400);
    if(pw.length<6)return J({e:'pw'},400);
    if(!b.consent)return J({e:'consent'},400);
    const med=cl(b.med,12),c1=parseInt(b.cmin),c2=parseInt(b.cmax);
    if(!['मराठी','कन्नड','उर्दू','इंग्रजी','हिंदी','इतर'].includes(med))return J({e:'med'},400);
    if(!(c1>=1&&c2<=12&&c1<=c2))return J({e:'cls'},400);
    await slEnsure(env);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_reg(udise TEXT PRIMARY KEY, sname TEXT, rname TEXT, post TEXT, mobile TEXT, salt TEXT, pw TEXT, status TEXT, ts TEXT, med TEXT, cmin INTEGER, cmax INTEGER)").run();await srCols(env);
    if(await env.DB.prepare('SELECT 1 x FROM schools WHERE udise=?').bind(u).first()||await env.DB.prepare('SELECT 1 x FROM school_bank WHERE udise=?').bind(u).first().catch(()=>null)||await env.DB.prepare('SELECT 1 x FROM school_login WHERE udise=?').bind(u).first())return J({e:'exists'},409);
    if(await env.DB.prepare("SELECT 1 x FROM sch_reg WHERE udise=? AND status='pending'").bind(u).first())return J({e:'pending'},409);
    const salt=rnd(8);
    await env.DB.prepare("INSERT INTO sch_reg(udise,sname,rname,post,mobile,salt,pw,status,ts,med,cmin,cmax) VALUES(?,?,?,?,?,?,?,'pending',?,?,?,?) ON CONFLICT(udise) DO UPDATE SET sname=excluded.sname,rname=excluded.rname,post=excluded.post,mobile=excluded.mobile,salt=excluded.salt,pw=excluded.pw,status='pending',ts=excluded.ts,med=excluded.med,cmin=excluded.cmin,cmax=excluded.cmax").bind(u,sn,rn,po,mo,salt,await hashPin(pw,salt),istDay(),med,c1,c2).run();
    try{const g=geoIn(b);await env.DB.prepare('UPDATE sch_reg SET district=?,taluka=?,kendra=?,kcode=? WHERE udise=?').bind(g.d,g.t,g.k,g.kc,u).run()}catch(e){}
    return J({ok:1});
  }
  if(p==='/api/admin/sreglist'||p==='/api/admin/sregset'){
    const b=await body(r),bad=await adminKey(env,b);if(bad)return bad;
    await slEnsure(env);await env.DB.prepare("CREATE TABLE IF NOT EXISTS sch_reg(udise TEXT PRIMARY KEY, sname TEXT, rname TEXT, post TEXT, mobile TEXT, salt TEXT, pw TEXT, status TEXT, ts TEXT, med TEXT, cmin INTEGER, cmax INTEGER)").run();await srCols(env);
    if(p==='/api/admin/sreglist')return J({ok:1,rows:(await env.DB.prepare('SELECT udise,sname,rname,post,mobile,status,ts,med,cmin,cmax,district,taluka,kendra,kcode FROM sch_reg ORDER BY status,ts DESC LIMIT 300').all()).results});
    const u=cl(b.udise,11).replace(/\D/g,''),x=await env.DB.prepare('SELECT * FROM sch_reg WHERE udise=?').bind(u).first();if(!x)return J({e:'nf'},404);
    if(b.act==='ok'){await schCols(env);await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO schools(udise,name) VALUES(?,?)').bind(u,x.sname),env.DB.prepare('UPDATE schools SET med=?,cmin=?,cmax=? WHERE udise=?').bind(x.med||'',x.cmin||null,x.cmax||null,u),env.DB.prepare('INSERT OR REPLACE INTO school_login(udise,salt,pw,changed,fails) VALUES(?,?,?,1,0)').bind(u,x.salt,x.pw),env.DB.prepare("UPDATE sch_reg SET status='ok' WHERE udise=?").bind(u)]);return J({ok:1})}
    await env.DB.prepare('DELETE FROM sch_reg WHERE udise=?').bind(u).run();return J({ok:1});
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
    // auto-approve only a brand-new school AND a shalarth the admin has no data for (else someone could claim a real teacher's ID)
    await slEnsure(env);
    const known=await env.DB.prepare('SELECT 1 x FROM schools WHERE udise=?').bind(udise).first()||await env.DB.prepare('SELECT 1 x FROM roster WHERE udise=? LIMIT 1').bind(udise).first()||await env.DB.prepare('SELECT 1 x FROM tch_info WHERE shalarth=?').bind(sh).first();
    const ins=known?await env.DB.prepare('INSERT INTO teachers(shalarth,name,mobile,udise,salt,pw) VALUES(?,?,?,?,?,?)').bind(sh,name,mob,udise,salt,h).run():await env.DB.prepare("INSERT INTO teachers(shalarth,name,mobile,udise,salt,pw,status) VALUES(?,?,?,?,?,?,'ok')").bind(sh,name,mob,udise,salt,h).run();
    const id=ins.meta.last_row_id;
    try{await tCols(env);const g=geoIn(b);await env.DB.prepare('UPDATE teachers SET district=?,taluka=?,kendra=?,kcode=? WHERE id=?').bind(g.d,g.t,g.k,g.kc,id).run()}catch(e){}
    await env.DB.batch(cs.map(c=>env.DB.prepare('INSERT OR IGNORE INTO tclasses(tid,udise,cls,div) VALUES(?,?,?,?)').bind(id,udise,c.cls,c.div)));
    return J({ok:1});
  }
  if(p==='/api/t/login'){
    const b=await body(r),sh=cl(b.shalarth,20).toUpperCase(),pw=cl(b.pw,40);
    const x=await env.DB.prepare('SELECT * FROM teachers WHERE shalarth=?').bind(sh).first();
    if(!x)return J({e:'bad'},401);
    await tCols(env);const now=Date.now();
    if(x.fails>=8&&now-(x.lf||0)<900000)return J({e:'locked'},429);
    if((await hashPin(pw,x.salt))!==x.pw){await env.DB.prepare('UPDATE teachers SET fails=CASE WHEN fails>=8 AND ?-lf>=900000 THEN 1 ELSE fails+1 END,lf=? WHERE id=?').bind(now,now,x.id).run();return J({e:'bad'},401);}
    // reuse a still-valid token so a second device does not log out the first
    const keep=x.token&&x.tt&&now-x.tt<TTTL,tok=keep?x.token:rnd(24);await env.DB.prepare('UPDATE teachers SET fails=0,token=?,tt=? WHERE id=?').bind(tok,keep?x.tt:now,x.id).run();
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
    const mv=u!==t.udise;
    const ops=[mv?env.DB.prepare("UPDATE teachers SET udise=?,conf=1,status='pending' WHERE id=?").bind(u,t.id):env.DB.prepare('UPDATE teachers SET udise=?,conf=1 WHERE id=?').bind(u,t.id)];
    if(mv)ops.push(env.DB.prepare('DELETE FROM tclasses WHERE tid=? AND udise<>?').bind(t.id,u));
    await env.DB.batch(ops);
    return J({ok:1,pending:mv?1:0});
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
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);await pdEns(env);
    const cf={};for(const x of (await env.DB.prepare("SELECT k,v FROM cfg WHERE k IN('pay_url','pay_key')").all()).results)cf[x.k]=x.v;
    const hasG=!!(cf.pay_url&&cf.pay_key);
    const ti=await env.DB.prepare('SELECT data FROM tch_info WHERE shalarth=?').bind(t.shalarth).first();let pan='';try{pan=String(JSON.parse(ti&&ti.data||'{}')['PAN क्रमांक']||'').trim().toUpperCase()}catch(e){}
    if(!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))pan='';
    const m=cl(b.month,12).replace(/[^A-Za-z0-9_]/g,'');
    const hid=[await pdHid(env,'S'+String(t.shalarth||'').trim().toUpperCase()),...(pan?[await pdHid(env,'P'+pan)]:[])],dm=await pdMons(env,hid);
    const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(t.udise).first();
    if(!hasG&&!dm.length)return J({ok:1,none:1,msg:pan?'वेतन पावती उपलब्ध नाही. (वेतन माहिती अजून भरलेली नाही.)':'वेतन पावतीसाठी तुमची माहितीत "PAN क्रमांक" भरा.'});
    const dHas=m&&dm.some(x=>x.mon===m);let gj=null;
    if(hasG&&!dHas){try{const rs=await fetch(cf.pay_url+'?key='+encodeURIComponent(cf.pay_key)+'&sh='+encodeURIComponent(t.shalarth)+'&pan='+pan+(m?'&month='+m:''),{redirect:'follow'});gj=await rs.json()}catch(e){gj=null}if(gj&&!gj.ok)gj=null}
    const gm=gj&&gj.months||[],all=[...new Set([...dm.map(x=>x.mon),...gm])].sort((x,y)=>monOrd(y)-monOrd(x));
    if(!all.length)return J({ok:1,none:1,msg:(gj===null&&hasG&&!dm.length)?'वेतन माहिती सध्या मिळाली नाही. नंतर प्रयत्न करा.':'या PAN साठी वेतन पावती उपलब्ध नाही.'});
    let mon=m||(gj&&gj.month)||'';if(!m&&dm.length&&monOrd(dm[0].mon)>=monOrd(mon))mon=dm[0].mon;if(!m&&dm.length>1){const cn={};for(const x of (await env.DB.prepare('SELECT mon,COUNT(DISTINCT hid) n FROM payd GROUP BY mon').all()).results)cn[x.mon]=x.n;let bs=null;for(const x of dm)if(!bs||(cn[x.mon]||0)>(cn[bs]||0)||((cn[x.mon]||0)===(cn[bs]||0)&&monOrd(x.mon)>monOrd(bs)))bs=x.mon;if(bs)mon=bs}if(!mon)mon=all[0];
    if(dm.some(x=>x.mon===mon)){const s2=await pdSlip(env,hid,mon,t.name);if(s2)return J({ok:1,months:all,month:mon,p:s2.p,nm:t.name,ds:s2.ds,nw:s2.nw,sc:sc?sc.name:'',sh:t.shalarth,pn:pan});return J({ok:1,months:all,month:mon,p:null,nm:t.name,ds:'',nw:0,sc:sc?sc.name:'',sh:t.shalarth,pn:pan})}
    if(gj&&mon===(gj.month||''))return J({ok:1,months:all,month:mon,p:gj.p||null,nm:gj.nm||t.name,ds:gj.ds||'',nw:gj.nw?1:0,sc:sc?sc.name:'',sh:t.shalarth,pn:pan});
    return J({ok:1,months:all,month:mon,p:null,nm:t.name,ds:'',nw:0,sc:sc?sc.name:'',sh:t.shalarth,pn:pan});
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
    const x=(await env.DB.prepare('SELECT points,exp,assess,material,locode,lodesc,activity,notes FROM tach WHERE medium=? AND cls=? AND subject=? AND lesson=? LIMIT 1').bind(med,cls,sub,les).first())||{};
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
    const x=(await env.DB.prepare('SELECT points,exp,assess,material,locode,lodesc,activity,notes FROM tach WHERE medium=? AND cls=? AND subject=? AND lesson=? LIMIT 1').bind(med,cls,sub,les).first())||{};
    const lang=cl(b.lang,30)||'मराठी',n=Math.max(3,Math.min(20,parseInt(b.n)||10)),mk=Math.max(1,Math.min(10,parseInt(b.marks)||1)),qt=cl(b.qtype,40)||'मिश्र प्रश्न',df=cl(b.diff,20)||'मध्यम',tot=n*mk;
    const ctx=['माध्यम: '+med,'इयत्ता: '+cls,'विषय: '+sub,'पाठ: '+les,'अध्ययन निष्पत्ती: '+(x.locode||'')+' '+(x.lodesc||''),'मुख्य मुद्दे: '+(x.points||''),'स्पष्टीकरण: '+(x.exp||''),'उपक्रम: '+(x.activity||''),'मूल्यमापन: '+(x.assess||'')].join('\n');
    const si='तू महाराष्ट्रातील प्राथमिक शाळेच्या शिक्षकांसाठी प्रश्नपत्रिका बनवणारा सहाय्यक आहेस. फक्त जोडलेल्या पाठ्यपुस्तकाच्या PDF मधील याच पाठाच्या आशयावर आधारित प्रश्न तयार कर. संपूर्ण प्रश्नपत्रिका फक्त '+lang+' भाषेत दे. नेमके '+n+' प्रश्न दे. प्रत्येक प्रश्नाला '+mk+' गुण (एकूण '+tot+'). प्रश्नप्रकार: '+qt+'. अवघडपणा: '+df+'. बहुपर्यायी प्रश्नाला नेमके 4 पर्याय दे, इतर प्रश्नांना options रिकामे ठेव. इयत्तेला साजेशी साधी भाषा वापर. उत्तर फक्त STRICT JSON मध्ये दे, कोणतेही अतिरिक्त शब्द किंवा ``` नको: {"questions":[{"question":"...","options":[],"answer":"...","explanation":""}]}';
    const g=await gemAsk(env,si,[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:pdf}},{text:ctx}]}]);
    if(!g.t)return J({e:g.e||'fail'},g.e==='nokey'?503:502);
    let q=null;try{const s=g.t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(),i=s.indexOf('{'),k=s.lastIndexOf('}');q=JSON.parse(s.slice(i,k+1)).questions}catch(e){}
    if(!Array.isArray(q)||!q.length)return J({e:'parse'},502);
    return J({ok:1,sc:await scn(env,t),title:les,total:tot,marks:mk,q:q.slice(0,n).map(z=>({q:cl(z.question,600),o:(Array.isArray(z.options)?z.options:[]).slice(0,4).map(o=>cl(o,200)),a:cl(z.answer,400),e:cl(z.explanation,500)}))});
  }
  if(p==='/api/t/lpmed'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const mm=await tMed(env,t);return J({ok:1,d:mm.d,m:mm.m});
  }
  if(p==='/api/t/lptype'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await slEnsure(env);
    const cls=cl(b.cls,4),sub=cl(b.subject,80),ty=cl(b.type,20),tmm=await tMed(env,t),mc=(tmm.m[cls]||tmm.d)==='kn'?'kn':'mr',med=mc==='kn'?'कन्नड':'मराठी';
    if(!cls||!sub||!/^(संकलित|आकारिक) [12]$/.test(ty))return J({e:'bad'},400);
    const nz=s=>String(s||'').replace(/[\s\-–.()]/g,'').toLowerCase();
    const pr=((await env.DB.prepare('SELECT DISTINCT subject s,topic t,tname n FROM syl WHERE medium=? AND cls=? AND (sank=? OR akar=?)').bind(med,cls,ty,ty).all()).results||[]);
    if(!pr.length)return J({e:'noplan'},404);
    let bj={};try{const br=await env.ASSETS.fetch(new Request(new URL('/content/'+cls+'-'+mc+'/books.json',r.url)));if(br.ok)bj=await br.json()}catch(e){}
    const bs=(bj.s||[]).find(s=>s.n===sub);if(!bs||!Array.isArray(bs.l))return J({e:'nosub'},404);
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
    const lang=mc==='kn'?'Kannada (ಕನ್ನಡ)':'मराठी',total=Math.max(10,Math.min(100,parseInt(b.total)||(ty[0]==='स'?40:20))),oral=Math.max(0,Math.min(total-5,parseInt(b.oral)||0)),wr=total-oral,on=Math.max(2,Math.min(5,parseInt(b.on)||4));
    const ob=Math.round(wr*0.3),vs=Math.round(wr*0.2),sh=Math.round(wr*0.3),lg=wr-ob-vs-sh;
    const cn=parseInt(cls)||0,vis=cn<=2?'इयत्ता 1-2 असल्यामुळे आवश्यक तिथे साधे emoji वापरू शकतो.':'चित्र/emoji वापरू नकोस.';
    const si='तू महाराष्ट्रातील प्राथमिक शाळेच्या शिक्षकांसाठी प्रश्नपत्रिका बनवणारा सहाय्यक आहेस. एकाच '+ty+' चाचणीसाठी जोडलेल्या सर्व पाठांच्या PDF चा एकत्रित अभ्यास करून एकच संपूर्ण प्रश्नपत्रिका तयार कर.\nमाध्यम: '+med+', इयत्ता: '+cls+', विषय: '+sub+', चाचणी: '+ty+', भाषा: '+lang+'\nसमाविष्ट पाठ: '+names.join(', ')+'\n'+
    'एकूण गुण: '+total+' (लेखी '+wr+', तोंडी '+oral+').\nलेखी गुणांची विभागणी: वस्तुनिष्ठ '+ob+', अतिलघुत्तरी '+vs+', लघुत्तरी '+sh+', दीर्घोत्तरी/कृती '+lg+'.\n'+
    'सूचना: 1. सर्व पाठांच्या आशयाचा वापर कर, फक्त एका पाठावर आधारित प्रश्न नकोत. 2. PDF बाहेरील आशय वापरू नकोस. 3. प्रत्येक वर्गवारीच्या गुणांची बेरीज वरील आकड्याशी अचूक जुळली पाहिजे; लेखी गुणांची एकूण बेरीज '+wr+' असावी. 4. '+(oral>0?'तोंडी गुण '+oral+' आहेत. त्यांसाठी "oral" नावाच्या वेगळ्या यादीत नेमके '+on+' प्रश्न दे: फक्त प्रश्नाचा मजकूर, शिक्षकाने विद्यार्थ्यांना तोंडी विचारता येईल असा लहान प्रश्न (पर्याय, उत्तर, गुण नकोत). हे प्रश्न "questions" यादीत घालू नकोस आणि लेखी गुणांत मोजू नकोस.':'तोंडी प्रश्न देऊ नकोस; "oral" यादी रिकामी ठेव.')+' 5. बहुपर्यायी प्रश्नाला नेमके 4 पर्याय दे. 6. सर्व प्रश्नपत्रिका फक्त '+lang+' भाषेत. 7. '+vis+' 8. उत्तर फक्त STRICT JSON, ``` नको: {"questions":[{"category":"वस्तुनिष्ठ","question":"...","options":[],"answer":"...","marks":1,"explanation":""}],"oral":["..."]}';
    const g=await gemAsk(env,si,[{role:'user',parts:parts.concat([{text:'वरील पाठांवर आधारित '+ty+' प्रश्नपत्रिका तयार कर.'}])}]);
    if(!g.t)return J({e:g.e||'fail'},g.e==='nokey'?503:502);
    let q=null,oq=[];try{const s=g.t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(),i=s.indexOf('{'),k=s.lastIndexOf('}'),pj=JSON.parse(s.slice(i,k+1));q=pj.questions;oq=oral>0&&Array.isArray(pj.oral)?pj.oral.map(x=>cl(typeof x==='string'?x:(x&&x.question)||'',400)).filter(Boolean).slice(0,on):[]}catch(e){}
    if(!Array.isArray(q)||!q.length)return J({e:'parse'},502);
    return J({ok:1,sc:await scn(env,t),total,oral,written:wr,oq,names,miss,q:q.slice(0,60).map(z=>({c:cl(z.category,30),q:cl(z.question,700),o:(Array.isArray(z.options)?z.options:[]).slice(0,4).map(o=>cl(o,200)),a:cl(z.answer,500),m:Math.max(0,Math.min(20,Number(z.marks)||0)),e:cl(z.explanation,500)}))});
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
    await schCols(env);
    const sc=await env.DB.prepare('SELECT name,cmin,cmax FROM schools WHERE udise=?').bind(t.udise).first();
    const sd=(await env.DB.prepare("SELECT r.cls,COUNT(*) n,SUM(i.gender='M') m,SUM(i.gender='F') f FROM roster r LEFT JOIN sinfo i ON i.pen=r.pen WHERE r.udise=? GROUP BY r.cls ORDER BY r.cls").bind(t.udise).all()).results.map(x=>({cls:x.cls,n:x.n,m:x.m||0,f:x.f||0}));
    let cm={};try{await tcEns(env);const th=(await env.DB.prepare('SELECT c.cls,c.div,c.tid,c.ct,t.name nm FROM tclasses c JOIN teachers t ON t.id=c.tid WHERE c.udise=?').bind(t.udise).all()).results,rd=(await env.DB.prepare('SELECT cls,div FROM roster WHERE udise=? GROUP BY cls,div').bind(t.udise).all()).results;
      const dvs={};rd.forEach(x=>{(dvs[x.cls]=dvs[x.cls]||new Set()).add(x.div)});th.forEach(x=>{(dvs[x.cls]=dvs[x.cls]||new Set()).add(x.div)});
      for(const k in dvs){const dv=[...dvs[k]].sort()[0],hs=th.filter(x=>x.cls==k&&x.div===dv);cm[k]={div:dv,mine:hs.some(x=>x.tid===t.id)?1:0,ct:hs.some(x=>x.tid===t.id&&x.ct)?1:0,ctn:(hs.find(x=>x.ct)||{}).nm||'',oth:hs.filter(x=>x.tid!==t.id).map(x=>x.nm)}}}catch(e){}
    let hm='';try{const h=await env.DB.prepare('SELECT v FROM cfg WHERE k=?').bind('hm:'+t.udise).first();hm=h&&h.v||'';if(!hm){const h2=await env.DB.prepare('SELECT hm FROM school_sna WHERE udise=?').bind(t.udise).first();hm=h2&&h2.hm||''}}catch(e){}
    return J({ok:1,cm,hm,name:t.name,rows:rs,udise:t.udise,school:sc?sc.name:'',conf:t.conf?1:0,lim:sc?0:1,sd,cmin:(sc&&sc.cmin)||0,cmax:(sc&&sc.cmax)||0});
  }
  if(p==='/api/t/subset'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);await tcEns(env);
    const k=parseInt(b.cls)||0,dv=cl(b.div,2).toUpperCase(),ud=cl(b.udise,11);if(k<1||k>8)return J({e:'args'});
    const sb=(Array.isArray(b.subs)?b.subs:[]).map(x=>cl(x,16)).filter(x=>/^[A-Za-z0-9_]{1,16}$/.test(x)).slice(0,20);
    const r2=await env.DB.prepare('UPDATE tclasses SET subs=? WHERE tid=? AND udise=? AND cls=? AND div=?').bind(sb.join(','),t.id,ud,k,dv).run();
    return J({ok:1,subs:sb});
  }
  if(p==='/api/t/ctset'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);if(!t.conf)return J({e:'conf'},403);await tcEns(env);
    const k=parseInt(b.cls)||0,dv=cl(b.div,2).toUpperCase();if(k<1||k>8||!/^[A-Z]{1,2}$/.test(dv))return J({e:'args'});
    if(b.what==='mine'){
      if(b.on)await env.DB.prepare('INSERT OR IGNORE INTO tclasses(tid,udise,cls,div) VALUES(?,?,?,?)').bind(t.id,t.udise,k,dv).run();
      else await env.DB.prepare('DELETE FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,t.udise,k,dv).run();
      return J({ok:1});
    }
    if(!await env.DB.prepare('SELECT 1 x FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,t.udise,k,dv).first())return J({e:'auth'},403);
    if(b.on){const nm=await ctBlock(env,t.id,t.udise,k,dv);if(nm)return J({e:'ct',n:nm});await env.DB.prepare('UPDATE tclasses SET ct=1 WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,t.udise,k,dv).run()}
    else await env.DB.prepare('UPDATE tclasses SET ct=0 WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,t.udise,k,dv).run();
    return J({ok:1});
  }
  if(p==='/api/t/hmset'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);if(!t.conf)return J({e:'conf'},403);
    const nm=cl(b.hm,80).replace(/[<>]/g,'').trim();
    await env.DB.prepare("INSERT INTO cfg(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind('hm:'+t.udise,nm).run();
    return J({ok:1,hm:nm});
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
    if(b.udise&&cl(b.udise,11)!==t.udise)return J({e:'udise'},403);
    await ensS(env);
    const med=b.med==='kn'?'kn':'mr',CT=['GEN','SC','ST','VJA','NTB','NTC','NTD','OBC','SBC'];
    const nn=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9ऀ-ॿಀ-೿ ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
    const rs=[],si=[],pd=[],tc=new Set();let n=0,sk=0,pn=0;
    const FI=c=>c+"=CASE WHEN COALESCE(sinfo."+c+",'')='' THEN excluded."+c+" ELSE sinfo."+c+" END";
    const cache={};
    for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,120)){
      let pen=cl(x.pen,20).replace(/\D/g,''),cls=parseInt(x.cls)||0,dv=cl(x.div,2).toUpperCase()||'A',name=cl(x.name,60);
      if((pen&&pen.length!==11)||cls<1||cls>8||name.length<2||!/^[A-Z]{1,2}$/.test(dv)){sk++;continue}
      const g=['M','F','O'].includes(x.gender)?x.gender:'',ct=CT.includes(x.cat)?x.cat:'';
      let core={gender:g,cat:ct,father:cl(x.father,60),mother:cl(x.mother,60),addr:cl(x.addr,200),mobile:/^\d{10}$/.test(String(x.mobile||''))?x.mobile:'',dob:/^\d{4}-\d\d-\d\d$/.test(String(x.dob||''))?x.dob:'',gr:cl(x.gr,20),tongue:cl(x.tongue,40)};
      let ex={};if(x.x&&typeof x.x==='object')for(const k of XK){const v=cl(x.x[k],80);if(v)ex[k]=v}
      const key=nn(name);
      if(!pen){
        const ck=cls+'|'+dv;
        if(!cache[ck])cache[ck]=(await env.DB.prepare('SELECT pen,name FROM roster WHERE udise=? AND cls=? AND div=?').bind(t.udise,cls,dv).all()).results;
        const f=cache[ck].find(q=>nn(q.name)===key);
        if(f)pen=f.pen;
        else{
          const o=await env.DB.prepare('SELECT j FROM uimp_pend WHERE udise=? AND cls=? AND dv=? AND nn=?').bind(t.udise,cls,dv,key).first();
          if(o){try{const q=JSON.parse(o.j);for(const k in q.core)if(!core[k])core[k]=q.core[k];ex=Object.assign({},q.ex,ex)}catch(e){}}
          pd.push(env.DB.prepare('INSERT OR REPLACE INTO uimp_pend(udise,cls,dv,nn,name,j,upd) VALUES(?,?,?,?,?,?,?)').bind(t.udise,cls,dv,key,name,JSON.stringify({core,ex}),Date.now()));
          tc.add(cls+'|'+dv);pn++;continue}
      }
      const old=await env.DB.prepare('SELECT udise FROM roster WHERE pen=?').bind(pen).first();
      if(old&&old.udise!==t.udise){sk++;continue}
      const o=await env.DB.prepare('SELECT j FROM uimp_pend WHERE udise=? AND cls=? AND dv=? AND nn=?').bind(t.udise,cls,dv,key).first();
      if(o){try{const q=JSON.parse(o.j);for(const k in q.core)if(!core[k])core[k]=q.core[k];ex=Object.assign({},q.ex,ex)}catch(e){}
        pd.push(env.DB.prepare('DELETE FROM uimp_pend WHERE udise=? AND cls=? AND dv=? AND nn=?').bind(t.udise,cls,dv,key))}
      const salt=rnd(6),h=await sha(salt+'123456');
      rs.push(env.DB.prepare("INSERT INTO roster(pen,udise,cls,div,name,med,salt,pw,pw0,salt0) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET cls=excluded.cls,div=excluded.div").bind(pen,t.udise,cls,dv,name,med,salt,h,h,salt));
      si.push(env.DB.prepare("INSERT INTO sinfo(pen,gender,cat,father,mother,addr,mobile,dob,gr,tongue,extra) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pen) DO UPDATE SET "+['gender','cat','father','mother','addr','mobile','dob','gr','tongue'].map(FI).join(',')+",extra=json_patch(COALESCE(sinfo.extra,'{}'),excluded.extra)").bind(pen,core.gender,core.cat,core.father,core.mother,core.addr,core.mobile,core.dob,core.gr,core.tongue,JSON.stringify(ex)));
      tc.add(cls+'|'+dv);n++;
    }
    if(rs.length)await env.DB.batch(rs);
    if(si.length)await env.DB.batch(si);
    if(pd.length)await env.DB.batch(pd);
    if(tc.size===1)await env.DB.batch([...tc].map(k=>{const [c,d]=k.split('|');return env.DB.prepare('INSERT OR IGNORE INTO tclasses(tid,udise,cls,div) VALUES(?,?,?,?)').bind(t.id,t.udise,parseInt(c),d)}));
    return J({ok:1,n:n,pn:pn,sk:sk});
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
    let sm='';try{await schCols(env);const sc=await env.DB.prepare('SELECT med FROM schools WHERE udise=?').bind(ud).first();sm=sc&&sc.med||''}catch(e){}
    return J({ok:1,rows,sm});
  }
  if(p==='/api/t/sset'){
    const b=await body(r),t=await teacher(env,b,true);if(!t)return J({e:'auth'},401);
    const pen=cl(b.pen,11);
    if(!b.consent)return J({e:'consent'});
    const x=await env.DB.prepare('SELECT r.pen FROM roster r JOIN tclasses c ON c.udise=r.udise AND c.cls=r.cls AND c.div=r.div WHERE r.pen=? AND c.tid=?').bind(pen,t.id).first();
    if(!x)return J({e:'auth'},403);
    {const rr=await env.DB.prepare('SELECT udise,cls,div FROM roster WHERE pen=? LIMIT 1').bind(pen).first();if(rr){const nm=await ctBlock(env,t.id,rr.udise,rr.cls,rr.div);if(nm)return J({e:'ct',n:nm},403)}}
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
      let my={ct:0,subs:[]};if(cls){try{await tcEns(env);const m=await env.DB.prepare('SELECT ct,subs FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,ud,cls,dv).first();if(m)my={ct:m.ct?1:0,subs:String(m.subs||'').split(',').filter(Boolean)}}catch(e){}}
      let info={};if(cls){try{await schCols(env);const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(ud).first();info.school=sc&&sc.name||'';
        let hm='';const h=await env.DB.prepare('SELECT v FROM cfg WHERE k=?').bind('hm:'+ud).first();hm=h&&h.v||'';if(!hm){try{const h2=await env.DB.prepare('SELECT hm FROM school_sna WHERE udise=?').bind(ud).first();hm=h2&&h2.hm||''}catch(e){}}info.hm=hm;
        const ct=await env.DB.prepare('SELECT t.name FROM tclasses c JOIN teachers t ON t.id=c.tid WHERE c.udise=? AND c.cls=? AND c.div=? AND c.ct=1 LIMIT 1').bind(ud,cls,dv).first();info.ctn=ct&&ct.name||''}catch(e){}}
      return J({ok:1,rows,my,info});
    }
    const kind=cl(b.kind,10),k=cl(b.k,40),v=typeof b.v==='string'?b.v:JSON.stringify(b.v==null?null:b.v);
    if(!/^[a-z]+$/.test(kind)||v.length>600000)return J({e:'args'});
    if(cls&&kind==='marks'){try{await tcEns(env);const m=await env.DB.prepare('SELECT ct,subs FROM tclasses WHERE tid=? AND udise=? AND cls=? AND div=?').bind(t.id,ud,cls,dv).first(),sb=String(m&&m.subs||'').split(',').filter(Boolean),code=k.split('|')[1]||'';if(m&&!m.ct&&sb.length&&!sb.includes(code))return J({e:'subj'},403)}catch(e){}}
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
  if(p==='/api/admin/payimp'||p==='/api/admin/tfind'||p==='/api/admin/tmove'||p==='/api/admin/penchk'||p==='/api/admin/penreset'||p==='/api/admin/aeomap'||p==='/api/admin/schmed'||p==='/api/admin/schlist'||p==='/api/admin/parentreset'||p==='/api/admin/paypw'||p==='/api/admin/kpbind'||p==='/api/admin/paymons'||p==='/api/admin/paydel'||p==='/api/admin/reqsave'||p==='/api/admin/reqlist'||p==='/api/admin/reqresp'||p==='/api/admin/reqdel'||p==='/api/admin/reqtog'||p==='/api/admin/gkcfg'||p==='/api/admin/mailcfg'||p==='/api/admin/snaimp'||p==='/api/admin/wacfg'||p==='/api/admin/fblist'||p==='/api/admin/newscfg'||p==='/api/admin/newsget'||p==='/api/admin/panchimport'||p==='/api/admin/dirsave'||p==='/api/admin/dirlist'||p==='/api/admin/tlist'||p==='/api/admin/tset'||p==='/api/admin/import'||p==='/api/admin/timport'||p==='/api/admin/simport'||p==='/api/admin/hsave'||p==='/api/admin/hdel'||p==='/api/admin/ratesave'||p==='/api/admin/ratedel'||p==='/api/admin/cookimport'||p==='/api/admin/cookmap'||p==='/api/admin/cooknlist'||p==='/api/admin/spwreset'||p==='/api/admin/preqlist'||p==='/api/admin/formlist'||p==='/api/admin/formget'||p==='/api/admin/opwreset'||p==='/api/admin/cenlist'||p==='/api/admin/tinfoimport'||p==='/api/admin/recimport'||p==='/api/admin/sylimport'||p==='/api/admin/ttimport'||p==='/api/admin/tachimport'||p==='/api/admin/paycfg'){
    const b=await body(r);let bad;
    if(b.pk!==undefined&&!PAYP.has(p))return J({e:'bad'},403);
    if(b.pk!==undefined&&PAYP.has(p))bad=await payKey(env,b);else bad=await adminKey(env,b);
    if(bad)return bad;
    if(p==='/api/admin/kpbind'){if(b.pk!==undefined)return J({e:'bad'},403);await slEnsure(env);await pdEns(env);let n=0,m=0;const nf=[];
      for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const c=String(x.c||'').trim().toUpperCase(),sh=String(x.sh||'').trim().toUpperCase();if(!CEN[c]||!/^[A-Z0-9]{8,20}$/.test(sh))continue;const hid=await pdHid(env,'S'+sh);const q=await env.DB.prepare('SELECT 1 x FROM payd WHERE hid=? LIMIT 1').bind(hid).first();await env.DB.prepare('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)').bind('kpp:'+c,hid).run();n++;if(q)m++;else nf.push(CEN[c])}
      return J({ok:1,n,m,nf})}
    if(p==='/api/admin/parentreset'){if(b.pk!==undefined)return J({e:'bad'},403);const m=cl(b.mobile,10).replace(/\D/g,'');if(!/^[6-9]\d{9}$/.test(m))return J({e:'bad'},400);
      const rs=(await env.DB.prepare("SELECT id,name,cls FROM students WHERE mobile=? OR mobile LIKE ?").bind(m,m+'-%').all()).results||[];if(!rs.length)return J({e:'nf'},404);
      const pin=String(1000+Math.floor(Math.random()*9000)),salt=rnd(8),h=await hashPin(pin,salt);
      await env.DB.prepare("UPDATE students SET salt=?,pin_hash=?,fails=0,lf=0,token=NULL WHERE mobile=? OR mobile LIKE ?").bind(salt,h,m,m+'-%').run();
      return J({ok:1,pin,kids:rs.map(x=>x.name+' (इ.'+x.cls+')')})}
    if(p==='/api/admin/paypw'){if(b.pk!==undefined)return J({e:'bad'},403);const pw=cl(b.pw,60);if(pw.length<8)return J({e:'short'},400);const salt=rnd(8);await env.DB.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('payadm',?)").bind([salt,await hashPin(pw,salt),0,0].join('|')).run();return J({ok:1})}
    if(p==='/api/admin/penchk'||p==='/api/admin/penreset'){
      // विद्यार्थी लॉगिन तपासणी (PEN): नोंद आहे का, शाळा, पहिला पासवर्ड कोणत्या प्रकारचा, लॉक आहे का. पासवर्ड दाखवला जात नाही.
      const pen=cl(b.pen,20).replace(/\D/g,'');if(pen.length!==11)return J({e:'bad'},400);
      const x=await env.DB.prepare('SELECT r.*,s.name sn FROM roster r LEFT JOIN schools s ON s.udise=r.udise WHERE r.pen=?').bind(pen).first();
      if(!x)return J({ok:1,found:0});
      if(p==='/api/admin/penreset'){await env.DB.prepare('UPDATE roster SET pw=pw0,salt=salt0,fails=0,lf=0,changed=0 WHERE pen=?').bind(pen).run();return J({ok:1,reset:1})}
      const d123=(await sha(x.salt0+'123456'))===x.pw0,locked=x.fails>=8&&Date.now()-(x.lf||0)<900000;
      const inf=await env.DB.prepare('SELECT dob FROM sinfo WHERE pen=?').bind(pen).first().catch(()=>null),yr=inf&&/^\d{4}/.test(inf.dob||'')?inf.dob.slice(0,4):'';
      const dby=!d123&&yr?(await sha(x.salt0+yr))===x.pw0:false;
      return J({ok:1,found:1,name:x.name,cls:x.cls,div:x.div,udise:x.udise,school:x.sn||'',med:x.med||'',changed:x.changed?1:0,isDef:(x.pw===x.pw0&&x.salt===x.salt0)?1:0,def:d123?'123456':dby?'birthyear':'other',dobyr:yr?1:0,fails:x.fails||0,locked:locked?1:0,opened:x.sid?1:0});
    }
    if(p==='/api/admin/spwreset'){await slEnsure(env);const u=cl(b.udise,11).replace(/\D/g,'');if(u.length!==11)return J({e:'bad'},400);await env.DB.batch([env.DB.prepare('DELETE FROM school_login WHERE udise=?').bind(u),env.DB.prepare('DELETE FROM pw_req WHERE udise=?').bind(u)]);return J({ok:1})}
    if(p==='/api/admin/opwreset'){await slEnsure(env);let u=cl(b.u,12).toUpperCase().replace(/\s/g,'');if(/^\d{7}$/.test(u))u='CLU'+u;if(!isOff(u)&&!CEN[u])return J({e:'bad'},400);await env.DB.prepare('DELETE FROM off_login WHERE uname=?').bind(u).run();return J({ok:1})}
    if(p==='/api/admin/recimport'){await slEnsure(env);const st=[],dt=v=>/^\d{4}-\d{2}-\d{2}$/.test(cl(v,10))?cl(v,10):'';for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,40)){const sh=cl(x.sh,20).toUpperCase().replace(/\s/g,''),k=x.kind==='S'?'S':'L',fd=dt(x.fd),td=dt(x.td),ty=cl(x.typ,60);if(!/^[A-Z0-9]{6,20}$/.test(sh)||!fd||!td||!ty)continue;const ud=cl(x.udise,11).replace(/\D/g,''),rm=cl(x.rm,200);st.push(env.DB.prepare("INSERT INTO tch_rec(shalarth,kind,fd,td,udise,typ,rm,status,upd) SELECT ?,?,?,?,?,?,?,'Approved',? WHERE NOT EXISTS(SELECT 1 FROM tch_rec WHERE shalarth=? AND kind=? AND fd=? AND td=? AND typ=?)").bind(sh,k,fd,td,ud,ty,rm,istDay(),sh,k,fd,td,ty))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/sylimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM syl'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const m=cl(x.m,40),mo=cl(x.mo,20),cls=cl(x.c,6),sub=cl(x.s,120);if(!m||!mo||!cls||!sub)continue;st.push(env.DB.prepare('INSERT INTO syl(medium,month,week,cls,subject,topic,tname,sank,akar) VALUES(?,?,?,?,?,?,?,?,?)').bind(m,mo,Math.min(4,Math.max(1,parseInt(x.w)||1)),cls,sub,cl(x.t,20),cl(x.tn,200),cl(x.sa,40),cl(x.ak,40)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/ttimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM tt'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const c=cl(x.c,4),pe=cl(x.p,40);if(!c||!pe||!Array.isArray(x.d)||!Array.isArray(x.t))continue;const d=[0,1,2,3,4,5].map(i=>cl(x.d[i],120)),t=[0,1,2,3,4,5].map(i=>cl(x.t[i],30));st.push(env.DB.prepare('INSERT INTO tt(cls,period,d1,d2,d3,d4,d5,d6,t1,t2,t3,t4,t5,t6,rtype) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(c,pe,...d,...t,cl(x.r,20)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/panchimport'){await slEnsure(env);const st=[];if(b.reset)st.push(env.DB.prepare('DELETE FROM panch'));for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,100)){const d=cl(x.d,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;const o={};for(const k of ['वार','शक','संवत्सर','मास','पक्ष','तिथी','नक्षत्र','सूर्योदय','सूर्यास्त'])o[k]=cl(x[k],60);st.push(env.DB.prepare('INSERT OR REPLACE INTO panch(d,data) VALUES(?,?)').bind(d,JSON.stringify(o)))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/fblist'){await slEnsure(env);const q=await env.DB.prepare('SELECT name,school,rating,typ,msg,ts FROM fb ORDER BY id DESC LIMIT 100').all(),w=await env.DB.prepare("SELECT v FROM cfg WHERE k='wa_link'").first();return J({ok:1,rows:q.results||[],wa:w?w.v:''})}
    if(p==='/api/admin/snaimp'){await slEnsure(env);await env.DB.prepare("CREATE TABLE IF NOT EXISTS school_sna(udise TEXT PRIMARY KEY, mhsn TEXT, bank TEXT, acct TEXT, ifsc TEXT, branch TEXT, hm TEXT, hm_mob TEXT, upd TEXT)").run();const st=[];for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,60)){const u=cl(x.u,11),m=cl(x.m,20).toUpperCase(),ac=cl(x.acct,25),fs=cl(x.ifsc,15).toUpperCase();if(!/^\d{11}$/.test(u)||!/^MHSN\d{3,10}$/.test(m)||!/^\d{6,20}$/.test(ac)||!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(fs))continue;st.push(env.DB.prepare('INSERT OR REPLACE INTO school_sna(udise,mhsn,bank,acct,ifsc,branch,hm,hm_mob,upd) VALUES(?,?,?,?,?,?,?,?,?)').bind(u,m,cl(x.bank,60),ac,fs,cl(x.br,60),cl(x.hm,80),cl(x.mob,10),new Date().toISOString()))}if(st.length)await env.DB.batch(st);return J({ok:1,n:st.length})}
    if(p==='/api/admin/mailcfg'){await slEnsure(env);const k=cl(b.key,300).trim(),fr=cl(b.from,120).trim().toLowerCase(),nm=cl(b.name,60).trim(),up=async(a,v)=>env.DB.prepare("INSERT INTO cfg(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(a,v).run();
      if(k){if(!/^[\w.\-]{20,300}$/.test(k))return J({e:'key'},400);await up('brevo_key',k)}
      if(fr){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fr))return J({e:'from'},400);await up('mail_from',fr)}
      if(nm)await up('mail_name',nm);
      const cf=await env.DB.prepare("SELECT k FROM cfg WHERE k IN ('brevo_key','mail_from')").all();let sent=-1;
      if(b.test){sent=await mailSend(env,cl(b.test,120).trim(),'अभ्यास मंच – चाचणी ईमेल','<p>ही चाचणी ईमेल आहे. ईमेल सुविधा चालू आहे. ✔</p>')}
      return J({ok:1,set:cf.results.length,sent})}
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
    if(p==='/api/admin/payimp'){
      await slEnsure(env);await pdEns(env);const mon=cl(b.mon,12);if(!monOrd(mon))return J({e:'month'},400);
      const PR=/^[A-Z]{5}\d{4}[A-Z]$/,ord=monOrd(mon),st=[],seen=new Set(),dn=[],bind=[],kbn=[];let nt=0,nk=0,dup=0,rep=0,kb=0;
      const ex=new Set(((await env.DB.prepare('SELECT DISTINCT hid FROM payd WHERE mon=?').bind(mon).all()).results||[]).map(x=>x.hid));
      const num=y=>{const n=Number(y);return isFinite(n)?Math.round(n*100)/100:0};
      const vv=a=>Array.isArray(a)&&a.length===27?a.map(num):null;
      if(b.wipe&&b.pk===undefined)st.push(env.DB.prepare('DELETE FROM payd WHERE mon=?').bind(mon));
      const NOW=new Date(Date.now()+19800000).toISOString().slice(0,16).replace('T',' '),INS='INSERT OR REPLACE INTO payd(mon,ord,hid,ds,nm,v,up) VALUES(?,?,?,?,?,?,?)';
      // एका व्यक्तीच्या सर्व हॅशची जुनी नोंद काढून नवी टाकणे; दुबार असल्यास वगळून अलर्ट
      const put=async(hs,ds,nm,js,label)=>{if(hs.some(h=>seen.has(h))){dup++;if(dn.length<30)dn.push(label||nm);return false}hs.forEach(h=>seen.add(h));if(hs.some(h=>ex.has(h)))rep++;for(const h of hs)st.push(env.DB.prepare('DELETE FROM payd WHERE mon=? AND hid=?').bind(mon,h));for(const h of hs)st.push(env.DB.prepare(INS).bind(mon,ord,h,ds,nm,js,NOW));return true};
      for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,400)){const pan=String(x.p||'').trim().toUpperCase(),v=vv(x.v),nm=cl(x.nm,80);if(!PR.test(pan)||!v)continue;if(await put([await pdHid(env,'P'+pan)],cl(x.ds,40),nm,JSON.stringify(v),nm+' ('+pan.slice(-4)+')'))nt++}
      for(const x of (Array.isArray(b.rows2)?b.rows2:[]).slice(0,300)){const sh=String(x.sh||'').trim().toUpperCase(),nm=cl(x.nm,80),h=Array.isArray(x.h)?x.h.slice(0,80).map(y=>cl(y,60)):[],v=Array.isArray(x.v)?x.v.slice(0,80).map(num):[];if(!/^[A-Z0-9]{8,20}$/.test(sh)||!nm||h.length<10||h.length!==v.length)continue;const pn=String(x.pn||'').trim().toUpperCase(),hs=[await pdHid(env,'S'+sh)];if(PR.test(pn))hs.push(await pdHid(env,'P'+pn));if(await put(hs,cl(x.ds,40),nm,JSON.stringify({h,v}),nm+' ('+sh.slice(-4)+')')){nt++;if(/kendra|केंद्र/i.test(String(x.ds||''))&&hs.length>1){const u=String(x.u||'').replace(/\D/g,''),kc=u?await env.DB.prepare('SELECT code FROM sch_center WHERE udise=?').bind(u).first().catch(()=>null):null;if(kc&&CEN[kc.code]){bind.push(env.DB.prepare('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)').bind('kpp:'+kc.code,hs[1]));kb++}else if(kbn.length<30)kbn.push(nm)}}}
      for(const x of (Array.isArray(b.kp)?b.kp:[]).slice(0,60)){const c=String(x.c||'').toUpperCase(),v=vv(x.v);if(!CEN[c]||!v)continue;if(await put([await pdHid(env,'K'+c)],'केंद्रप्रमुख',cl(x.nm,80),JSON.stringify(v),cl(x.nm,80)))nk++}
      // शि.वि.अ. (AEO1-3): 'Office bill' मधील ओळी नावावरून AEO खात्याशी जोडतात. पहिल्यांदा क्रमाने (AEO1, AEO2, AEO3) जोडणी होते, नंतर नावावरून; जोडणी admin पानावर दिसते व काढता येते.
      const ak=[];let ax=0;
      if(Array.isArray(b.aeo)&&b.aeo.length){
        const am={};for(const a of OAEO){const q=await env.DB.prepare('SELECT v FROM cfg WHERE k=?').bind('aeonm:'+a).first();if(q)am[a]=q.v}
        const HON=['श्री','श्रीमती','सौ','श्रीम','कु'],tk=n=>nmTok(n).filter(x=>!HON.includes(x)),same=(x,y)=>{const a=tk(x),c=tk(y);if(!a.length||!c.length)return false;const cs=new Set(c);return a.filter(t=>cs.has(t)).length>=Math.min(2,a.length,c.length)};
        const lbs=o=>{if(!o||typeof o!=='object')return null;const r={};for(const k of Object.keys(o).slice(0,12)){if(/^I([0-9]|1[0-9]|2[0-6])$/.test(k)){const t=cl(o[k],60);if(t)r[k]=t}}return Object.keys(r).length?r:null};
        const ar=b.aeo.slice(0,6).map(x=>({nm:cl(x.nm,80),ds:cl(x.ds,40),v:vv(x.v),lb:lbs(x.lb)})).filter(x=>x.nm&&x.v),used=new Set(),pend=[];
        for(const x of ar){const a=OAEO.find(a=>!used.has(a)&&am[a]&&same(am[a],x.nm));if(a){used.add(a);x.a=a}else pend.push(x)}
        for(const x of pend){const a=OAEO.find(a=>!used.has(a)&&!am[a]);if(!a){ax++;continue}used.add(a);am[a]=nmTok(x.nm).join(' ');x.a=a;bind.push(env.DB.prepare('INSERT OR REPLACE INTO cfg(k,v) VALUES(?,?)').bind('aeonm:'+a,am[a]))}
        for(const x of ar){if(!x.a)continue;if(await put([await pdHid(env,'K'+x.a)],x.ds||'शि.वि.अ.',x.nm,JSON.stringify(x.lb?{v:x.v,lb:x.lb}:x.v),x.nm))ak.push({a:x.a,nm:x.nm})}
      }
      for(let i=0;i<st.length;i+=40)await env.DB.batch(st.slice(i,i+40));for(const q of bind)await q.run();
      return J({ok:1,t:nt,k:nk,dup,rep,dn,kb,kbn,ak,ax});
    }
    // शाळा + त्यांचे केंद्र (शाळा जोडा / केंद्र ठरवा या कार्डासाठी)
    if(p==='/api/admin/schlist'){if(b.pk!==undefined)return J({e:'bad'},403);await slEnsure(env);
      return J({ok:1,cen:CEN,rows:(await env.DB.prepare('SELECT s.udise u,s.name n,c.code c FROM schools s LEFT JOIN sch_center c ON c.udise=s.udise').all()).results||[]})}
    // एका शाळेच्या सर्व विद्यार्थ्यांचे माध्यम (kn / mr) एकदम बदलणे. act:'set' शिवाय फक्त सध्याची संख्या दाखवतो.
    if(p==='/api/admin/schmed'){if(b.pk!==undefined)return J({e:'bad'},403);await slEnsure(env);
      const u=cl(b.udise,11).replace(/\D/g,''),md=b.med==='kn'?'kn':b.med==='mr'?'mr':'';if(u.length!==11)return J({e:'bad'},400);
      const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(u).first();
      if(b.act==='set'){if(!md)return J({e:'med'},400);
        const r=await env.DB.prepare("UPDATE roster SET med=? WHERE udise=? AND COALESCE(med,'')<>?").bind(md,u,md).run();
        await env.DB.prepare('UPDATE students SET med=? WHERE id IN (SELECT sid FROM roster WHERE udise=? AND sid IS NOT NULL)').bind(md,u).run();
        return J({ok:1,name:sc?sc.name:'',changed:(r&&r.meta&&r.meta.changes)||0})}
      const rows=(await env.DB.prepare("SELECT COALESCE(med,'') m,COUNT(*) n FROM roster WHERE udise=? GROUP BY COALESCE(med,'')").bind(u).all()).results||[];
      return J({ok:1,name:sc?sc.name:'',rows})}
    if(p==='/api/admin/aeomap'){if(b.pk!==undefined)return J({e:'bad'},403);await slEnsure(env);await pdEns(env);
      if(b.clear){const a=String(b.clear).toUpperCase();if(!OAEO.includes(a))return J({e:'bad'},400);await env.DB.batch([env.DB.prepare('DELETE FROM cfg WHERE k=?').bind('aeonm:'+a),env.DB.prepare('DELETE FROM payd WHERE hid=?').bind(await pdHid(env,'K'+a))])}
      const rows=[];for(const a of OAEO){const q=await env.DB.prepare('SELECT v FROM cfg WHERE k=?').bind('aeonm:'+a).first();rows.push({a,nm:q?q.v:''})}return J({ok:1,rows})}
    if(p==='/api/admin/paymons'){await pdEns(env);const q=await env.DB.prepare("SELECT mon,ord,COUNT(DISTINCT nm) n,COUNT(DISTINCT CASE WHEN ds LIKE '%endra%' OR ds LIKE '%केंद्र%' OR ds LIKE '%के.प्र%' THEN nm END) kp,MAX(up) up FROM payd GROUP BY mon,ord ORDER BY ord DESC").all();return J({ok:1,rows:q.results||[]})}
    if(p==='/api/admin/paydel'){await pdEns(env);const mon=cl(b.mon,12);await env.DB.prepare('DELETE FROM payd WHERE mon=?').bind(mon).run();return J({ok:1})}
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
      await slEnsure(env);await tCols(env);const ts=(await env.DB.prepare("SELECT id,shalarth,name,mobile,udise,status,created,district,taluka,kendra,kcode FROM teachers WHERE status<>'ok' OR udise NOT IN (SELECT udise FROM schools) ORDER BY (status<>'ok') DESC,id DESC LIMIT 500").all()).results;
      const cs=(await env.DB.prepare('SELECT tid,cls,div FROM tclasses').all()).results;
      ts.forEach(x=>x.cl=cs.filter(c=>c.tid===x.id).map(c=>c.cls+c.div).join(', '));
      const n=await env.DB.prepare('SELECT COUNT(*) n FROM roster').first();
      return J({ok:1,rows:ts,roster:n.n});
    }
    if(p==='/api/admin/tfind'){
      // शिक्षक शोध (शालार्थ ID / नाव / मोबाईल) — शाळा बदलण्यासाठी
      const q=cl(b.q,60);if(q.length<3)return J({e:'short'},400);const lk='%'+q.replace(/[%_]/g,'')+'%';
      const ts=(await env.DB.prepare("SELECT t.id,t.shalarth,t.name,t.mobile,t.udise,t.status,s.name school FROM teachers t LEFT JOIN schools s ON s.udise=t.udise WHERE t.shalarth LIKE ? OR t.name LIKE ? OR t.mobile LIKE ? ORDER BY t.name LIMIT 12").bind(lk,lk,lk).all()).results;
      const cs=(await env.DB.prepare('SELECT tid,cls,div FROM tclasses').all()).results;
      ts.forEach(x=>x.cl=cs.filter(c=>c.tid===x.id).map(c=>c.cls+c.div).join(', '));
      return J({ok:1,rows:ts});
    }
    if(p==='/api/admin/tmove'){
      // प्रशासकाकडून शिक्षकाची शाळा बदल: जुन्या शाळेचे वर्ग निघतात; approve=1 असल्यास लगेच मंजूर (वापर सुरू)
      const id=parseInt(b.id)||0,u=cl(b.udise,11).replace(/\D/g,'');if(!id||u.length!==11)return J({e:'arg'},400);
      const t=await env.DB.prepare('SELECT id,udise,status FROM teachers WHERE id=?').bind(id).first();if(!t)return J({e:'nf'},404);
      const sc=await env.DB.prepare('SELECT name FROM schools WHERE udise=?').bind(u).first();
      if(!sc&&!b.force)return J({e:'noschool'},404);
      const st=b.approve?'ok':(u!==t.udise?'pending':t.status);
      await env.DB.batch([env.DB.prepare('UPDATE teachers SET udise=?,conf=1,status=?,fails=0 WHERE id=?').bind(u,st,id),env.DB.prepare('DELETE FROM tclasses WHERE tid=? AND udise<>?').bind(id,u)]);
      return J({ok:1,school:sc?sc.name:'',status:st,moved:u!==t.udise?1:0});
    }
    if(p==='/api/admin/tset'){
      const st=b.status==='ok'?'ok':b.status==='del'?'del':'pending',id=parseInt(b.id)||0;
      if(st==='del'){await env.DB.batch([env.DB.prepare('DELETE FROM tclasses WHERE tid=?').bind(id),env.DB.prepare('DELETE FROM teachers WHERE id=?').bind(id)]);}
      else await env.DB.prepare('UPDATE teachers SET status=?,fails=0 WHERE id=?').bind(st,id).run();
      return J({ok:1});
    }
    if(p==='/api/admin/simport'){
      const st=[];
      await slEnsure(env);for(const x of (Array.isArray(b.rows)?b.rows:[]).slice(0,100)){const u=cl(x.u,11).replace(/\D/g,''),n=cl(x.n,120),c=cl(x.c,12).toUpperCase();if(u.length===11&&n){st.push(env.DB.prepare('INSERT INTO schools(udise,name) VALUES(?,?) ON CONFLICT(udise) DO UPDATE SET name=excluded.name').bind(u,n));if(CEN[c])st.push(env.DB.prepare('INSERT OR REPLACE INTO sch_center(udise,code) VALUES(?,?)').bind(u,c))}}
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
        await stLf(env);const now=Date.now();
        if(s.fails>=8&&now-(s.lf||0)<900000)return J({e:'locked'},429);
        if(await hashPin(pin,s.salt)!==s.pin_hash){await env.DB.prepare('UPDATE students SET fails=CASE WHEN fails>=8 AND ?-lf>=900000 THEN 1 ELSE fails+1 END,lf=? WHERE id=?').bind(now,now,s.id).run();return J({e:'bad'},401);}
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
      if(p==='/api/feedback/old'){
        const b=await body(r),t=cl(b.text,800);if(t.length<3)return J({e:'text'},400);
        const n=await env.DB.prepare("SELECT COUNT(*) c FROM feedback WHERE sid=0 AND ts>=datetime('now','-1 day')").first();
        if(n&&n.c>=100)return J({e:'many'},429);
        await env.DB.prepare('INSERT INTO feedback(sid,type,text,cls,lesson) VALUES(0,?,?,?,?)').bind(cl(b.type,20),'['+cl(b.name,40)+'] '+t,cl(b.cls,3),cl(b.lesson,80)).run();
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
