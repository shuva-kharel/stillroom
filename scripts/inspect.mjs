import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const b=await chromium.launch();const p=await b.newPage();const svg=await readFile('public/favicon.svg','utf8');
for(const n of [192,512]){await p.setViewportSize({width:n,height:n});await p.setContent(`<style>body{margin:0;background:#1c1d19}svg{width:100%;height:100%}</style>${svg}`);await p.screenshot({path:`public/icon-${n}.png`})}
await p.setViewportSize({width:1440,height:1000});p.on('pageerror',e=>console.log('ERROR',e.message));await p.goto('http://127.0.0.1:5173');await p.waitForTimeout(2000);console.log((await p.locator('body').innerText()).slice(0,3000));await mkdir('artifacts',{recursive:true});await p.screenshot({path:'artifacts/current-desktop.png',fullPage:true});await b.close();
