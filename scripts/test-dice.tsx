/** Regression: all 36 rolls, across phone/desktop widths and a constrained footer. */
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {Dice} from '../src/ui/HandBar';
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const cases=[];
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)cases.push(<div className="dice-case hand-status" key={`${a}-${b}`} data-roll={`${a},${b}`}><Dice dice={[a,b]}/></div>);
const html=`<!doctype html><meta name="viewport" content="width=device-width"><style>${css}\nbody{overflow:auto;height:auto;padding:10px}.dice-grid{display:grid;grid-template-columns:repeat(auto-fit,120px);gap:12px}.dice-case{width:120px;min-width:0}</style><div class="dice-grid">${renderToStaticMarkup(<>{cases}</>)}</div>`;
const server=createServer((_,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
const port=(server.address() as {port:number}).port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const width of [320,390,844,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});await page.goto(`http://127.0.0.1:${port}`);
  const errors=await page.locator('.dice-case').evaluateAll(cases=>cases.flatMap(node=>{
   const values=node.getAttribute('data-roll')!.split(',').map(Number);const dice=[...node.querySelectorAll('svg.die')];const errors:string[]=[];
   if(dice.length!==2)errors.push('Expected two vector dice');
   dice.forEach((die,i)=>{
    const box=die.getBoundingClientRect();if(box.width<36||box.height<36||Math.abs(box.width-box.height)>.1)errors.push(`Distorted or shrunken face: ${box.width}x${box.height}`);
    const pips=[...die.querySelectorAll('circle')].map(p=>({x:Number(p.getAttribute('cx')),y:Number(p.getAttribute('cy')),r:Number(p.getAttribute('r'))}));
    if(pips.length!==values[i])errors.push(`Wrong pip count for ${values[i]}`);
    for(const p of pips){if(p.x-p.r<1||p.y-p.r<1||p.x+p.r>35||p.y+p.r>35)errors.push('Pip clips outside face');}
    for(let j=0;j<pips.length;j++)for(let k=j+1;k<pips.length;k++)if(Math.hypot(pips[j].x-pips[k].x,pips[j].y-pips[k].y)<=pips[j].r+pips[k].r)errors.push('Overlapping pips');
    if(box.right>node.getBoundingClientRect().right+.1)errors.push('Dice escape constrained footer');
   });return errors;
  }));assert.deepEqual(errors,[],`Dice rendering at ${width}px`);results.push({width,rolls:36,faces:72,errors});
  if(width===390){mkdirSync('/tmp/catan-040-qa',{recursive:true});await page.screenshot({path:'/tmp/catan-040-qa/dice-all-faces.png',fullPage:true});}
  await page.close();
 }
 writeFileSync('/tmp/catan-040-dice-results.json',JSON.stringify(results,null,2));console.log('PASS: all 36 rolls at 4 viewport widths; square 36px SVG faces, correct pip counts, no overlapping or clipped pips.');
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
