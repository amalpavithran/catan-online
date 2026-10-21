import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const f=JSON.parse(await fs.readFile('/tmp/catan-layout-fixtures.json','utf8')).find(f=>f.n===4);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];const out='/tmp/catan-040-qa';await fs.mkdir(out,{recursive:true});
async function pageFor(session,width){const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});await page.addInitScript(s=>{sessionStorage.setItem('catan.session',JSON.stringify(s));localStorage.setItem('catan.board','2d');},session);page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.CATAN_TEST_URL ?? 'http://127.0.0.1:3191');await page.locator('.handbar').waitFor();await page.waitForTimeout(1000);return page;}
async function post(p,give,want,n=1){
 const button=p.getByRole('button',{name:'New offer',exact:true});if(await button.count())await button.click();else await p.getByRole('button',{name:'Trade',exact:true}).click();
 for(let i=0;i<n;i++)await p.getByRole('group',{name:'Cards to give',exact:true}).getByRole('button',{name:`One more ${give}`,exact:true}).click();
 await p.getByRole('group',{name:'Cards to receive',exact:true}).getByRole('button',{name:`One more ${want}`,exact:true}).click();
 await p.getByRole('button',{name:'Post offer'}).click();
}
async function bounds(p){return p.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {board:r('.board-stage'),overlay:r('.trade-overlay'),cards:r('.handbar .cards'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};});}
try{
 const host=await pageFor(f.sessions[0],1440);const other=await pageFor(f.sessions[1],390);
 await post(host,'Brick','Ore',2);await other.locator('.board-trade').waitFor();
 const first=other.locator('.board-trade').first();
 assert.equal(await first.getByRole('group',{name:'Cards you give',exact:true}).getByRole('img',{name:'1 Ore',exact:true}).count(),1);
 assert.equal(await first.getByRole('group',{name:'Cards you receive',exact:true}).getByRole('img',{name:'2 Brick',exact:true}).count(),1);
 for(const arrow of await first.locator('.resource-direction').all()){const r=await arrow.boundingBox();assert(r.width<=24&&r.height<=24,'Trade direction arrows must stay compact inside the board SVG styles');}
 const colors=await first.locator('.resource-direction').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).color));assert.deepEqual(colors,['rgb(245, 119, 112)','rgb(131, 217, 154)']);
 await post(host,'Wool','Grain');await post(host,'Lumber','Ore');
 await other.locator('.board-trade').nth(2).waitFor();assert.equal(await other.locator('.scrim').count(),0);
 const ids=await other.locator('.board-trade').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-offer-id')));
 await first.getByRole('button',{name:'Reject',exact:true}).click();
 const second=other.locator('.board-trade').nth(1);await second.getByRole('button',{name:'Accept',exact:true}).click();
 const hostSecond=host.locator(`[data-offer-id="${ids[1]}"]`);await hostSecond.getByRole('button',{name:'Trade',exact:true}).click();
 await other.locator(`[data-offer-id="${ids[1]}"]`).waitFor({state:'detached'});
 await host.waitForFunction(()=>document.querySelector('.card[data-resource="wool"] .card-count')?.textContent==='2');
 assert.equal(await other.locator('.card[data-resource="wool"] .card-count').textContent(),'4');
 assert.equal(await other.locator('.board-trade').count(),2);
 await host.locator(`[data-offer-id="${ids[0]}"]`).getByRole('button',{name:'Withdraw this offer'}).click();
 await other.locator(`[data-offer-id="${ids[0]}"]`).waitFor({state:'detached'});
 for(let i=0;i<5;i++)await post(host,'Ore','Brick');
 await other.locator('.board-trade').nth(5).waitFor();
 const phone=await bounds(other);assert(phone.overlay.top>=phone.board.top);assert(phone.overlay.bottom<=phone.board.bottom+1);assert(phone.overlay.bottom<phone.cards.top);assert.equal(phone.width,phone.scrollWidth);
 const scroll=await other.locator('.trade-overlay-content').evaluate(n=>{const before=n.scrollTop;n.scrollTop=n.scrollHeight;return {height:n.clientHeight,scrollHeight:n.scrollHeight,before,after:n.scrollTop};});assert(scroll.scrollHeight>scroll.height);assert(scroll.after>scroll.before);
 await other.locator('.trade-overlay-content').evaluate(n=>n.scrollTop=0);
 await other.screenshot({path:`${out}/multiple-trades-phone.png`});await host.screenshot({path:`${out}/multiple-trades-desktop.png`});
 await host.setViewportSize({width:390,height:844});await host.getByRole('button',{name:'New offer'}).click();await host.screenshot({path:`${out}/trade-composer-phone.png`});
 const composerColors=await host.locator('.compact-picker .resource-direction').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).color));assert.deepEqual(composerColors,['rgb(245, 119, 112)','rgb(131, 217, 154)']);
 const composing=await bounds(host);assert(composing.overlay.bottom<=composing.board.bottom+1);assert(composing.overlay.bottom<composing.cards.top);
 await host.getByRole('button',{name:'Minimize trades'}).click();await host.getByRole('button',{name:'Show trades'}).click();assert.equal(await host.locator('.board-trade').count(),6);
 await other.reload();await other.locator('.board-trade').nth(5).waitFor();assert.equal(await other.locator('.board-trade').count(),6);
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/trade-metrics.json`,JSON.stringify({phone,composing,scroll,errors},null,2));
 console.log('PASS: multiple independent offers; correct give/receive colors and resources; accept, reject, completion, withdrawal; board bounds; visible hands; scroll; minimize; reload.');
}finally{await browser.close();}
