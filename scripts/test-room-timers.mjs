import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.env.CATAN_TEST_URL??'http://127.0.0.1:3191';const out='/tmp/catan-050-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[],states=new Map(),events=[];
async function until(fn,label,ms=20000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,20));}throw Error(`Timed out: ${label}`);}
async function page(width){const p=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});await p.addInitScript(()=>localStorage.setItem('catan.board','2d'));p.on('pageerror',e=>errors.push(e.message));p.on('websocket',ws=>ws.on('framereceived',({payload})=>{if(String(payload).startsWith('42')){try{const [event,state]=JSON.parse(String(payload).slice(2));if(event==='sync'){states.set(p,state);if(state.view)events.push(state.view);}}catch{}}}));await p.goto(base);await until(()=>p.getByRole('button',{name:'Start a new game',exact:true}).isEnabled(),'connection');return p;}
try{
 const host=await page(390);assert.equal(await host.getByLabel('Seconds per action').inputValue(),'30');assert.equal(await host.getByLabel('Auto-roll after (seconds)').inputValue(),'5');
 await host.screenshot({path:`out/create-phone.png`.replace('out/',out+'/')});
 await host.getByLabel('Your name').fill('Timer host');await host.getByLabel('Seconds per action').fill('1');await host.getByRole('button',{name:'Start a new game',exact:true}).click();await host.locator('.lobby-code').waitFor();
 const code=(await host.locator('.lobby-code').textContent()).trim();const session=await host.evaluate(()=>JSON.parse(sessionStorage.getItem('catan.session')));
 assert.match(await host.getByLabel('Room timer settings').textContent(),/Action: 1s.*Auto-roll: 5s/);
 await host.screenshot({path:`${out}/lobby-phone.png`});
 const guest=await page(1440);await guest.getByLabel('Your name').fill('Timer guest');await guest.getByLabel('Game code').fill(code);await guest.getByRole('button',{name:'Join game',exact:true}).click();await guest.locator('.lobby-code').waitFor();
 await host.getByRole('button',{name:'Deal the board',exact:true}).click();await until(()=>states.get(host)?.view?.phase==='rolling','setup timeout completed');
 await until(()=>host.getByRole('timer').textContent().then(t=>t.includes('Auto-roll')),'auto-roll countdown');
 await host.screenshot({path:`${out}/auto-roll-phone.png`});await guest.screenshot({path:`${out}/auto-roll-desktop.png`});
 const firstLabel=await host.getByRole('timer').textContent();await host.waitForTimeout(1100);const secondLabel=await host.getByRole('timer').textContent();assert.notEqual(firstLabel,secondLabel,'Visible countdown ticks without server messages');
 await until(()=>events.some(s=>s.dice),'server auto-roll');await until(()=>events.some(s=>s.turn>=2),'server automatic end of turn');
 assert(events.some(s=>s.log.some(l=>l.text.includes('auto-rolls'))));assert(events.some(s=>s.log.some(l=>l.text.includes('runs out of action time'))));
 const metrics=await host.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,timer:document.querySelector('.room-clock').getBoundingClientRect().toJSON(),nav:document.querySelector('.topbar').getBoundingClientRect().toJSON()}));assert.equal(metrics.width,metrics.scroll);assert(metrics.timer.right<=metrics.width);
 await host.waitForTimeout(500);await host.close();await guest.close();
 let room=await (await fetch(`${base}/api/room/${code}`)).json();assert.equal(room.clock.deadline,null);const remaining=room.clock.remainingMs;assert(remaining>=0&&remaining<=5000);
 await new Promise(r=>setTimeout(r,600));const paused=await(await fetch(`${base}/api/room/${code}`)).json();assert.equal(paused.clock.remainingMs,remaining);
 const resumed=await browser.newPage({viewport:{width:390,height:844}});await resumed.addInitScript(s=>{sessionStorage.setItem('catan.session',JSON.stringify(s));localStorage.setItem('catan.board','2d');},session);await resumed.goto(base);await resumed.locator('.handbar').waitFor();
 room=await(await fetch(`${base}/api/room/${code}`)).json();assert(room.clock.deadline!==null);assert(room.clock.deadline-room.serverNow<=remaining);await resumed.close();
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/metrics.json`,JSON.stringify({metrics,firstLabel,secondLabel,pausedRemainingMs:remaining,errors},null,2));
 console.log('PASS: creation defaults and custom settings; shared lobby; countdown; unattended setup, five-second auto-roll and turn expiry; pause/resume without reset; phone bounds.');
}finally{await browser.close();}
