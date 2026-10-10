import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  ...(await readdir("dist/assets")).map((f) => "assets/" + f),
];
const hash = createHash("sha256");
for (const f of files) hash.update(await readFile("dist/" + f));
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE='stillroom-shell-${version}';
const BASE=new URL('./',self.location.href);const FILES=${JSON.stringify(files)}.map(f=>new URL(f,BASE).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
async function cleanOldCaches(){const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(clients.length>1)return;for(const key of await caches.keys())if(key.startsWith('stillroom-shell-')&&key!==CACHE)await caches.delete(key)}
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting();if(e.data==='CLIENT_READY')e.waitUntil(cleanOldCaches())});
self.addEventListener('activate',e=>e.waitUntil((async()=>{await cleanOldCaches();await self.clients.claim()})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==BASE.origin)return;
if(e.request.mode==='navigate'){e.respondWith(caches.open(CACHE).then(c=>c.match(new URL('index.html',BASE).href)).then(r=>r||fetch(e.request)));return}
if(FILES.includes(e.request.url))e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));
else if(new URL(e.request.url).pathname.startsWith(BASE.pathname+'assets/'))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});`,
);
console.log(
  "Offline shell " + version + " · " + files.length + " essential files",
);
