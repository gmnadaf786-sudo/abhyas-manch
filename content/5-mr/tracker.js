/* डिजिटल शिक्षण मंच – ५वी: लॉगिन ॲपमध्ये होते; येथे फक्त निकाल ॲपला कळवला जातो. */
(function(){var u=null;try{var s=JSON.parse(localStorage.getItem('am_sess_v1')||'null');if(s&&s.st)u={name:s.st.name||s.st.pen,pen:s.st.pen,cls:s.st.className||'',school:''}}catch(e){}
window.GM_USER=u;
window.GMTrack=function(ev,d){if(ev==='mcq_done'){try{parent.postMessage({type:'ssResult',score:d.score,total:d.total},'*')}catch(e){}}};})();
