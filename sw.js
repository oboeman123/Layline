// Leyline offline support (made by build.js).
// index.html: network first, so a new upload shows at once (both players need the same version for online play);
//   the saved copy is only used when there is no network.
// art.bin?v=...: cache first. The version changes whenever the images change, and only a pack whose header
//   matches its ?v= is saved, so a half-finished upload is never kept.
const CACHE='leyline',ART='art.bin?v=3e9797d5e7',CORE=['./','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const APP=new URL('./',location).pathname;   // the game's own address (the folder sw.js is in)
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.all([
  ...CORE.map(u=>fetch(u,{cache:'no-cache'}).then(r=>r.ok&&c.put(u,r)).catch(()=>{})),
  caches.match(ART).then(hit=>hit||artNet(new Request(ART),'default')).catch(()=>{})])));});   // 'default': the page just downloaded it
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!='GET'||u.origin!=location.origin)return;   // PeerJS, fonts and matchmaking go straight to the network
  if(/\/art\.bin$/.test(u.pathname))e.respondWith(caches.match(r).then(hit=>hit||artNet(r)));
  else if(u.pathname===APP||u.pathname===APP+'index.html')e.respondWith(netFirst(r,'./'));   // the game (also ?join= links)
  else if(r.mode=='navigate')return;   // another page under this address (notes, HOSTING.md…): not the game, never saved as it
  else e.respondWith(netFirst(r,r));
});
function netFirst(r,key){
  // a page load is fetched by its address (some browsers refuse to copy a navigation request), and a redirected
  // answer is rebuilt as a plain one (Safari rejects redirected answers to a page load)
  const nav=r.mode=='navigate';
  return fetch(nav?r.url:r,{cache:'no-cache',credentials:'same-origin'}).then(res=>{
    if(nav&&res.redirected)res=new Response(res.body,{status:res.status,statusText:res.statusText,headers:res.headers});
    if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(key,c)).catch(()=>{});}return res;})
    .catch(err=>caches.match(key).then(hit=>{if(hit)return hit;throw err;}));
}
function artNet(r,mode){
  return fetch(r,{cache:mode||'no-cache'}).then(res=>{if(!res.ok)return res;
    return res.arrayBuffer().then(b=>{
      let v=null;try{const n=new DataView(b).getUint32(0,true);v=JSON.parse(new TextDecoder().decode(new Uint8Array(b,4,n))).v;}catch(e){}
      const mk=()=>new Response(b.slice(0),{headers:{'content-type':'application/octet-stream'}});
      if(v&&v===new URL(r.url).searchParams.get('v'))
        caches.open(CACHE).then(c=>c.keys().then(ks=>Promise.all(ks.filter(k=>/\/art\.bin\?/.test(k.url)&&k.url!=r.url).map(k=>c.delete(k)))).then(()=>c.put(r.url,mk()))).catch(()=>{});
      return mk();});});
}
