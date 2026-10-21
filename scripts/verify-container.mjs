import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.CATAN_TEST_URL??'http://127.0.0.1:3188';
const clients=[];const file='/tmp/catan-container-check.json';
async function until(fn){const deadline=Date.now()+15000;while(Date.now()<deadline){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout');}
async function client(){const c={socket:io(url,{transports:['websocket']}),sync:null,errors:[]};c.socket.on('sync',s=>c.sync=s);c.socket.on('error:message',e=>c.errors.push(e));clients.push(c);await until(()=>c.socket.connected);return c;}
const ack=(c,event,payload)=>new Promise(resolve=>c.socket.emit(event,payload,resolve));
try{
 if(process.argv.includes('--resume')){
  const saved=JSON.parse(await fs.readFile(file,'utf8'));const c=await client();const a=await ack(c,'room:rejoin',{code:saved.code,token:saved.token});assert(a.ok);await until(()=>c.sync?.view);
  assert.deepEqual(c.sync.view.paired,saved.paired);assert.equal(c.sync.view.current,saved.current);assert.equal(c.sync.view.phase,saved.phase);
  console.log('Container restart preserved six-player state, Player 2 role and reconnect token.');
 }else{
  const host=await client();const owner=await ack(host,'room:create',{name:'Deployment check 1'});
  for(let i=2;i<=6;i++){const c=await client();assert((await ack(c,'room:join',{code:owner.code,name:`Deployment check ${i}`})).ok);}
  const seventh=await client();assert.equal((await ack(seventh,'room:join',{code:owner.code,name:'Seventh'})).ok,false);seventh.socket.disconnect();clients.pop();
  host.socket.emit('game:start');await until(()=>clients.every(c=>c.sync?.view));
  assert.equal(host.sync.view.devDeckSize,34);assert.equal(host.sync.view.bank.ore,24);assert.equal(host.sync.view.board.map,'large');
  let n=0;
  while(host.sync.view.phase==='setup'){
   await until(()=>clients.some(c=>c.sync?.view?.moves.isMyTurn));const actor=clients.find(c=>c.sync.view.moves.isMyTurn);const v=actor.sync.view;
   const before=JSON.stringify([v.phase,v.current,v.setup]);const m=v.moves;
   actor.socket.emit('game:action',v.setup.placing==='settlement'?{type:'placeSetupSettlement',vertex:m.settlementSpots[0]}:{type:'placeSetupRoad',edge:m.roadSpots[0]});
   await until(()=>clients.every(c=>JSON.stringify([c.sync.view.phase,c.sync.view.current,c.sync.view.setup])!==before));n++;
  }
  assert.equal(n,24);let actor=clients.find(c=>c.sync.view.moves.canRoll);assert(actor);
  actor.socket.emit('game:action',{type:'rollDice'});await until(()=>clients.every(c=>c.sync.view.phase!=='rolling'));
  if(actor.sync.view.phase==='movingRobber'){actor.socket.emit('game:action',{type:'moveRobber',hex:actor.sync.view.moves.robberSpots[0]});await until(()=>actor.sync.view.phase!=='movingRobber');}
  if(actor.sync.view.phase==='stealing'){actor.socket.emit('game:action',{type:'steal',target:actor.sync.view.moves.stealTargets[0]});await until(()=>actor.sync.view.phase==='main');}
  actor.socket.emit('game:action',{type:'endTurn'});await until(()=>clients.every(c=>c.sync.view.paired.secondActive));
  actor=clients.find(c=>c.sync.view.moves.isMyTurn);assert.equal(actor.sync.view.moves.canRoll,false);assert.equal(actor.sync.view.moves.canOfferTrade,false);
  assert(clients.every(c=>c.errors.length===0));
  await fs.writeFile(file,JSON.stringify({code:owner.code,token:owner.token,paired:host.sync.view.paired,current:host.sync.view.current,phase:host.sync.view.phase}),{mode:0o600});
  console.log('Six-player Docker check passed: seventh seat rejected, extension supplies, 24 setup actions, paired phase and trade restriction.');
 }
}finally{for(const c of clients)c.socket.disconnect();}
