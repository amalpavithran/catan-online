import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixtures=JSON.parse(await fs.readFile('/tmp/catan-layout-fixtures.json','utf8'));
const out='/tmp/catan-layout-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const errors=[];const metrics=[];
async function pageFor(session,width=1440,height=1000){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 await context.addInitScript(s=>{sessionStorage.setItem('catan.session',JSON.stringify(s));localStorage.setItem('catan.board','2d');},session);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3191');await page.locator('.handbar').waitFor();await page.waitForTimeout(1600);return page;
}
async function measure(p,label){
 const m=await p.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,nav:rect('.topbar'),stats:rect('.player-strip'),board:rect('.board-stage'),cards:rect('.handbar .cards'),icon:rect('.handbar .card svg')};});
 assert(m.scrollWidth<=m.width,`${label} overflow ${m.scrollWidth}`);
 assert(Math.abs(m.stats.top-m.nav.bottom)<2,'stats follow navbar');
 assert(m.board.height>m.height*.6,`${label} board should dominate: ${m.board.height}`);
 assert(m.board.width===m.width,'full width board');
 assert(m.cards.bottom<=m.height+1 && m.cards.bottom>m.height-15,'cards at bottom');assert(m.icon.width<=24,'compact icons');
 metrics.push({label,...m});
}
async function offer(host){
 await host.getByRole('button',{name:'Trade',exact:true}).click();
 await host.locator('.trade-side').nth(0).getByRole('button',{name:'One more Brick',exact:true}).click({clickCount:1});
 await host.locator('.trade-side').nth(0).getByRole('button',{name:'One more Brick',exact:true}).click();
 await host.locator('.trade-side').nth(1).getByRole('button',{name:'One more Ore',exact:true}).click();
 await host.getByRole('button',{name:'Offer it',exact:true}).click();
}
try{
 const four=fixtures.find(f=>f.n===4);const host=await pageFor(four.sessions[0]);const recipient=await pageFor(four.sessions[1],390,844);
 await measure(host,'four-desktop');await host.screenshot({path:`${out}/four-desktop.png`});
 await host.setViewportSize({width:390,height:844});await measure(host,'four-phone');await host.screenshot({path:`${out}/four-phone.png`});
 await host.setViewportSize({width:844,height:390});
 // Landscape keeps controls reachable even when the screen is short.
 assert(await host.locator('.end-turn').isVisible());await host.screenshot({path:`${out}/four-landscape.png`});
 await host.setViewportSize({width:1440,height:1000});
 await offer(host);await recipient.locator('.trade-flow').waitFor();
 assert.equal(await recipient.getByRole('group',{name:'Alex gives 2 Brick to You',exact:true}).count(),1);
 assert.equal(await recipient.getByRole('group',{name:'You give 1 Ore to Alex',exact:true}).count(),1);
 assert.equal(await recipient.locator('.trade-flow .trade-arrow').count(),2);
 assert.equal(await recipient.locator('.trade-flow .trade-resource').count(),2);
 await recipient.screenshot({path:`${out}/trade-recipient-phone.png`});await host.screenshot({path:`${out}/trade-offer-desktop.png`});
 await recipient.getByRole('button',{name:'Reject',exact:true}).click();await host.locator('[data-state="reject"]').waitFor();
 await host.getByRole('button',{name:'Withdraw offer',exact:true}).click();
 await offer(host);await recipient.getByRole('button',{name:'Accept',exact:true}).click();
 await host.locator('[data-state="accept"]').waitFor();
 await host.locator('.response').filter({hasText:'Maya'}).getByRole('button',{name:'Trade',exact:true}).click();
 await host.locator('.trade-flow').waitFor({state:'detached'});
 await host.waitForFunction(()=>document.querySelector('.handbar .card[data-resource="brick"] .card-count')?.textContent==='1');
 assert.equal(await host.locator('.handbar .card[data-resource="brick"] .card-count').textContent(),'1');
 await recipient.waitForFunction(()=>document.querySelector('.handbar .card[data-resource="brick"] .card-count')?.textContent==='5');
 assert.equal(await recipient.locator('.handbar .card[data-resource="brick"] .card-count').textContent(),'5');
 assert.equal(await recipient.locator('.handbar .card[data-resource="ore"] .card-count').textContent(),'2');
 await host.locator('.game-details summary').click();await host.getByLabel('Bank',{exact:true}).waitFor();await host.locator('.game-details summary').click();
 const six=fixtures.find(f=>f.n===6);const p6=await pageFor(six.sessions.find(s=>s.id===six.current),390,844);
 await measure(p6,'six-phone');await p6.screenshot({path:`${out}/six-phone.png`});
 // Exercise the default 3D renderer, including the closer camera.
 await host.getByRole('button',{name:'3D view',exact:true}).click();await host.locator('.board3d canvas').waitFor();
 await new Promise(r=>setTimeout(r,1800));await host.screenshot({path:`${out}/four-3d-desktop.png`});
 await host.setViewportSize({width:390,height:844});await new Promise(r=>setTimeout(r,800));await host.screenshot({path:`${out}/four-3d-phone.png`});
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));
 console.log(JSON.stringify({layout:true,tradeReject:true,tradeAccept:true,direction:true,bankLog:true,threeD:true,errors,metrics}));
}finally{await browser.close();}
