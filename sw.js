var C='am-v344';
var PP=['paripath/','paripath/index.html','paripath/rashtrageet.mp3','paripath/maharashtra-geet.mp3','paripath/songs.json'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.json','icon-192.png']).then(function(){return Promise.all(PP.map(function(u){return c.add(u).catch(function(){})}))})}));self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}));self.clients.claim()});
function ranged(req,res){
  var h=req.headers.get('range');if(!h||!res||res.status!==200)return res;
  return res.arrayBuffer().then(function(b){
    var m=/bytes=(\d*)-(\d*)/.exec(h),s=m[1]?+m[1]:0,e=m[2]?+m[2]:b.byteLength-1;
    return new Response(b.slice(s,e+1),{status:206,headers:{'Content-Type':res.headers.get('Content-Type')||'audio/mpeg','Content-Range':'bytes '+s+'-'+e+'/'+b.byteLength,'Content-Length':e-s+1}});
  });
}
self.addEventListener('fetch',function(e){
  var r=e.request;if(r.method!=='GET')return;
  var u=new URL(r.url);if(u.origin!==location.origin)return;
  if(u.pathname.indexOf('/paripath/')!==-1){
    var key=u.origin+u.pathname;
    e.respondWith(caches.open(C).then(function(c){return c.match(key).then(function(hit){
      if(hit)return ranged(r,hit);
      return fetch(key).then(function(x){
        if(x&&x.status===200&&/\.(mp3|json|txt)$/.test(u.pathname)){c.put(key,x.clone())}
        return ranged(r,x);
      }).catch(function(){return caches.match('index.html')});
    })}));return;
  }
  e.respondWith(fetch(r).then(function(x){var c=x.clone();caches.open(C).then(function(y){y.put(r,c)});return x}).catch(function(){return caches.match(r).then(function(m){return m||caches.match('index.html')})}));
});
