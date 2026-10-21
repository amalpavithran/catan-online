import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.CATAN_TEST_URL??'http://127.0.0.1:3191';
const out='/tmp/catan-browser-verification';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const pages=[],states=new Map(),errors=[];
async function until(fn,label){const end=Date.now()+20000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error(`Timed out: ${label}`);}
try {
 for(let i=0;i<6;i++){
  const context=await browser.newContext({viewport:i===3?{width:390,height:844}:{width:1440,height:1000},isMobile:i===3,hasTouch:i===3,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('catan.board','2d'));
  const page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('websocket',ws=>ws.on('framereceived',({payload})=>{
   const data=String(payload);if(data.startsWith('42')){try{const [event,state]=JSON.parse(data.slice(2));if(event==='sync')states.set(page,state);}catch{}}
  }));
  await page.goto(url);await page.getByRole('button',{name:'Start a new game',exact:true}).waitFor();
  await until(()=>page.getByRole('button',{name:'Start a new game',exact:true}).isEnabled(),'connected');
  await page.getByLabel('Your name').fill(`Test player ${i+1}`);
  if(i===0)await page.getByRole('button',{name:'Start a new game',exact:true}).click();
  else {await page.getByLabel('Game code').fill((await pages[0].locator('.lobby-code').textContent()).trim());await page.getByRole('button',{name:'Join game',exact:true}).click();}
  await page.locator('.lobby-code').waitFor();
 }
 await until(()=>states.get(pages[0])?.room.players.length===6,'six joined');
 await pages[0].screenshot({path:`${out}/lobby-desktop.png`});await pages[3].screenshot({path:`${out}/lobby-mobile.png`});
 assert.equal(await pages[0].locator('select').inputValue(),'large');
 await pages[0].getByRole('button',{name:'Deal the board'}).click();
 await until(()=>[...states.values()].every(s=>s.view),'game started');
 let actions=0;
 while(states.get(pages[0]).view.phase==='setup'){
  await until(()=>pages.some(p=>states.get(p)?.view?.moves.isMyTurn),'setup actor sync');
  const actor=pages.find(p=>states.get(p)?.view?.moves.isMyTurn);assert(actor,'setup actor');
  const before=JSON.stringify(states.get(actor).view.setup)+states.get(actor).view.current;
  await actor.locator('.board2d-spots .spot').first().click({force:true});actions++;
  await until(()=>JSON.stringify(states.get(actor).view.setup)+states.get(actor).view.current!==before,'setup advanced');
 }
 assert.equal(actions,24);
 let actor=pages.find(p=>states.get(p).view.moves.canRoll);assert(actor,'production player');
 const first=states.get(actor).view.current;
 await actor.getByRole('button',{name:'Roll the dice',exact:true}).click();
 await until(()=>states.get(actor).view.phase!=='rolling','rolled');
 if(states.get(actor).view.phase==='movingRobber'){
  await actor.locator('.board2d-spots .spot').first().click({force:true});
  await until(()=>states.get(actor).view.phase!=='movingRobber','robber moved');
 }
 if(states.get(actor).view.phase==='stealing'){
  await actor.locator('.modal button').first().click();
  await until(()=>states.get(actor).view.phase==='main','stole');
 }
 await actor.getByRole('button',{name:'Pass to Player 2'}).click();
 await until(()=>states.get(pages[0]).view.paired.secondActive,'Player 2 active');
 actor=pages.find(p=>states.get(p).view.moves.isMyTurn);
 assert.equal(states.get(actor).view.current,(first+3)%6);
 assert.equal(states.get(actor).view.moves.canRoll,false);
 assert.equal(states.get(actor).view.moves.canOfferTrade,false);
 assert.equal(await actor.getByRole('button',{name:'Roll the dice',exact:true}).count(),0);
 await actor.getByRole('button',{name:'Bank trade',exact:true}).click();
 assert.equal(await actor.getByRole('button',{name:'Offer it',exact:true}).count(),0);
 await actor.getByRole('button',{name:'Close bank trade'}).click();
 // Inspect the active Player 2 at desktop and phone sizes in one pass.
 await actor.setViewportSize({width:1440,height:1000});await actor.screenshot({path:`out/paired-desktop.png`.replace('out/',out+'/')});
 await actor.setViewportSize({width:390,height:844});await actor.screenshot({path:`${out}/paired-mobile.png`});
 const metrics=await actor.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.actions button')].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))}));
 await fs.writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));
 assert(metrics.width<=metrics.viewport,`Phone overflow: ${metrics.width} > ${metrics.viewport}`);
 await actor.reload();await until(()=>states.get(actor)?.view?.paired?.secondActive && states.get(actor)?.view?.moves.isMyTurn,'Player 2 reload');
 await actor.getByRole('button',{name:'End turn',exact:true}).click();
 await until(()=>states.get(pages[0]).view.phase==='rolling'&&!states.get(pages[0]).view.paired.secondActive,'next production');
 assert.equal(states.get(pages[0]).view.current,(first+1)%6);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({sixBrowsers:true,setupActions:actions,pairedTurn:true,bankOnlyUI:true,reconnect:true,errors,metrics,room:states.get(pages[0]).room.code}));
}finally{await browser.close();}
