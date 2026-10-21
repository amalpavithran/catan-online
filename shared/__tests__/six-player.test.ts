import { describe, it, expect } from 'vitest';
import { applyAction, createGame, legalMoves, totalVictoryPoints } from '../rules';
import { graphOf } from '../scenario';
import { RESOURCES, emptyResources, type Action, type GameState } from '../types';
import { viewFor } from '../redact';

const seats = (n: number) => Array.from({length:n}, (_,i)=>({id:`p${i+1}`,name:`Player ${i+1}`}));
function main(n=6): GameState {
 const s=createGame(seats(n),42);s.phase='main';s.setup=null;s.mustRoll=false;return s;
}
function move(s:GameState,a:Action,id=s.players[s.current].id):GameState {
 const r=applyAction(s,id,a);if(!r.ok)throw new Error(r.error);return r.state;
}
function fund(s:GameState,index:number,r:typeof RESOURCES[number],n:number){s.players[index].resources[r]+=n;s.bank[r]-=n;}

describe('official 2025 5–6 player extension',()=>{
 it.each([5,6])('uses extension components for %i players',n=>{
  const s=createGame(seats(n),42);
  expect(s.board.map).toBe('large');expect(Object.keys(s.board.hexes)).toHaveLength(30);
  expect(Object.values(s.board.hexes).filter(h=>h.terrain==='desert')).toHaveLength(2);
  expect(s.board.ports).toHaveLength(11);
  expect(s.bank).toEqual({brick:24,lumber:24,wool:24,grain:24,ore:24});
  const counts=Object.fromEntries(['knight','victoryPoint','roadBuilding','yearOfPlenty','monopoly'].map(t=>[t,s.devDeck.filter(c=>c===t).length]));
  expect(counts).toEqual({knight:20,victoryPoint:5,roadBuilding:3,yearOfPlenty:3,monopoly:3});
  expect(new Set(s.players.map(p=>p.color)).size).toBe(n);
  for(const p of s.players)expect(p.pieces).toEqual({road:15,settlement:5,city:4});
 });
 it.each([5,6])('completes the forward/reverse setup for %i players',n=>{
  let s=createGame(seats(n),42);const turns:string[]=[];
  while(s.phase==='setup'){
   const id=s.players[s.current].id,m=legalMoves(s,id);
   if(s.setup!.placing==='settlement'){turns.push(id);s=move(s,{type:'placeSetupSettlement',vertex:m.settlementSpots[0]});}
   else s=move(s,{type:'placeSetupRoad',edge:m.roadSpots[0]});
  }
  const ids=seats(n).map(p=>p.id);expect(turns).toEqual([...ids,...ids.slice().reverse()]);
  expect(s.current).toBe(0);expect(s.phase).toBe('rolling');
  for(const r of RESOURCES)expect(s.bank[r]+s.players.reduce((sum,p)=>sum+p.resources[r],0)).toBe(24);
 });
 it.each([5,6])('rotates paired markers one seat after each pair for %i players',n=>{
  let s=main(n);const seen:number[]=[];
  for(let first=0;first<n;first++){
   expect(s.current).toBe(first);seen.push(s.current);
   s.phase='main';s.mustRoll=false;s.dice=[3,4];
   s=move(s,{type:'endTurn'});
   expect(s.current).toBe((first+3)%n);expect(s.phase).toBe('main');expect(s.mustRoll).toBe(false);
   expect(s.dice).toEqual([3,4]);expect(legalMoves(s,s.players[s.current].id).canRoll).toBe(false);
   expect(applyAction(s,s.players[s.current].id,{type:'rollDice'}).ok).toBe(false);
   s=move(s,{type:'endTurn'});
   expect(s.phase).toBe('rolling');expect(s.mustRoll).toBe(true);expect(s.dice).toBeNull();
  }
  expect(seen).toEqual(Array.from({length:n},(_,i)=>i));expect(s.current).toBe(0);
 });
 it('allows Player 1 to trade with anyone, including the upcoming Player 2',()=>{
  let s=main();fund(s,0,'brick',1);fund(s,3,'ore',1);
  expect(legalMoves(s,'p1').canOfferTrade).toBe(true);
  s=move(s,{type:'offerTrade',give:{...emptyResources(),brick:1},want:{...emptyResources(),ore:1}});
  s=move(s,{type:'respondTrade',accept:true},'p4');
  s=move(s,{type:'acceptTradeWith',player:'p4'});expect(s.players[0].resources.ore).toBe(1);
 });
 it('rejects Player 2 player trades server-side, but allows bank and harbour trades',()=>{
  let s=move(main(),{type:'endTurn'});fund(s,3,'brick',4);fund(s,0,'ore',1);
  expect(legalMoves(s,'p4').canOfferTrade).toBe(false);
  expect(applyAction(s,'p4',{type:'offerTrade',give:{...emptyResources(),brick:1},want:{...emptyResources(),ore:1}}).ok).toBe(false);
  s=move(s,{type:'bankTrade',give:'brick',want:'ore'});expect(s.players[3].resources.ore).toBe(1);
  const port=s.board.ports.find(p=>p.type==='wool')!;s.board.buildings[port.vertices[0]]={owner:'p4',type:'settlement'};
  fund(s,3,'wool',2);s=move(s,{type:'bankTrade',give:'wool',want:'grain'});expect(s.players[3].resources.grain).toBe(1);
 });
 it('allows Player 2 to buy and build, with the usual costs',()=>{
  let s=move(main(),{type:'endTurn'});for(const r of RESOURCES)fund(s,3,r,5);
  const vertex=Object.keys(graphOf(s.board).vertices)[0];s.board.buildings[vertex]={owner:'p4',type:'settlement'};
  s=move(s,{type:'buildCity',vertex});expect(s.board.buildings[vertex].type).toBe('city');
  s=move(s,{type:'buyDevCard'});expect(s.players[3].devCards).toHaveLength(1);
 });
 it('permits one development card per portion, never a card bought in that portion',()=>{
  let s=main();s.players[0].devCards=[{type:'monopoly',boughtOnTurn:0,played:false},{type:'yearOfPlenty',boughtOnTurn:0,played:false}];
  s=move(s,{type:'playMonopoly',resource:'ore'});
  expect(applyAction(s,'p1',{type:'playYearOfPlenty',resources:['wool','grain']}).ok).toBe(false);
  s=move(s,{type:'endTurn'});s.players[3].devCards=[{type:'monopoly',boughtOnTurn:0,played:false}];
  s=move(s,{type:'playMonopoly',resource:'ore'});expect(s.playedDevThisTurn).toBe(true);
  s.players[3].devCards.push({type:'knight',boughtOnTurn:s.turn,played:false});s.playedDevThisTurn=false;
  expect(applyAction(s,'p4',{type:'playKnight'}).ok).toBe(false);
 });
 it.each([5,6])('cards bought as either paired role can be used in the next role (%i players)',n=>{
  let s=main(n);s.players[0].devCards=[{type:'monopoly',boughtOnTurn:s.turn,played:false}];
  expect(legalMoves(s,'p1').playableDevCards).not.toContain('monopoly');
  // Player 1 eventually becomes Player 2 before their next production turn.
  for(let i=0;i<(n-3)*2+1;i++){if(s.phase==='rolling'){s.phase='main';s.mustRoll=false;}s=move(s,{type:'endTurn'});}
  expect(s.players[s.current].id).toBe('p1');expect(s.paired?.secondActive).toBe(true);
  s=move(s,{type:'playMonopoly',resource:'ore'});
  s.players[0].devCards.push({type:'knight',boughtOnTurn:s.turn,played:false});
  while(!(s.current===0&&!s.paired?.secondActive)){if(s.phase==='rolling'){s.phase='main';s.mustRoll=false;}s=move(s,{type:'endTurn'});}
  expect(legalMoves(s,'p1').playableDevCards).toContain('knight');
 });
 it('resolves Player 2’s Knight without another production roll',()=>{
  let s=move(main(),{type:'endTurn'});s.players[3].devCards=[{type:'knight',boughtOnTurn:0,played:false}];
  s=move(s,{type:'playKnight'});expect(s.phase).toBe('movingRobber');
  s=move(s,{type:'moveRobber',hex:Object.keys(s.board.hexes).find(h=>h!==s.board.robber)!});
  expect(s.phase).toBe('main');expect(s.mustRoll).toBe(false);expect(s.current).toBe(3);
 });
 it('awards the win at either player’s portion, and Player 1 wins before Player 2 acts',()=>{
  let s=main();s.players[0].devCards=Array.from({length:10},()=>({type:'victoryPoint' as const,boughtOnTurn:1,played:false}));
  s.players[3].devCards=structuredClone(s.players[0].devCards);
  s=move(s,{type:'endTurn'});expect(s.winner).toBe('p1');expect(s.current).toBe(0);
  s=main();s.players[3].devCards=Array.from({length:10},()=>({type:'victoryPoint' as const,boughtOnTurn:0,played:false}));
  s=move(s,{type:'endTurn'});expect(s.winner).toBe('p4');expect(totalVictoryPoints(s,'p4')).toBe(10);
 });
 it('keeps base games and previously saved games on ordinary turns',()=>{
  for(const n of [2,3,4]){let s=main(n);delete s.paired;s=move(s,{type:'endTurn'});expect(s.current).toBe(1);expect(s.phase).toBe('rolling');expect(s.bank.ore).toBe(19);}
 });
 it('exposes the active paired role without exposing opponents’ cards',()=>{
  const s=move(main(),{type:'endTurn'});const v=viewFor(s,'p1');
  expect(v.paired).toEqual({first:0,secondActive:true});expect(v.currentPlayerId).toBe('p4');
  expect(v.players[3]).not.toHaveProperty('resources');expect(v.players[3]).not.toHaveProperty('devCards');
 });
 it('keeps the seven-card discard threshold for all six players',()=>{
  let s=main();s.phase='rolling';s.mustRoll=true;
  for(let i=0;i<6;i++){fund(s,i,i%2?'ore':'brick',i===5?7:8);}
  // Search a deterministic roll seed that produces seven, preserving the fixture.
  for(let seed=1;seed<1000;seed++){
   const candidate=structuredClone(s);candidate.rng=createGame(seats(6),seed).rng;
   const rolled=move(candidate,{type:'rollDice'});
   if(rolled.dice!.reduce((a,b)=>a+b)!==7)continue;
   s=rolled;break;
  }
  expect(s.phase).toBe('discarding');expect(Object.keys(s.pendingDiscards)).toHaveLength(5);
  expect(s.pendingDiscards.p4).toBe(4);expect(s.pendingDiscards.p6).toBeUndefined();
  for(const id of Object.keys(s.pendingDiscards)){
   const i=s.players.findIndex(p=>p.id===id);const r=i%2?'ore':'brick';
   s=move(s,{type:'discard',resources:{...emptyResources(),[r]:4}},id);
  }
  expect(s.phase).toBe('movingRobber');expect(s.current).toBe(0);
 });
 it('does not let Player 2 act before Player 1 finishes production or trading',()=>{
  const s=main();s.phase='rolling';s.mustRoll=true;
  s.players[3].devCards=[{type:'knight',boughtOnTurn:0,played:false}];
  expect(applyAction(s,'p4',{type:'playKnight'}).ok).toBe(false);
  expect(legalMoves(s,'p4').playableDevCards).toEqual([]);
  s.phase='main';expect(applyAction(s,'p4',{type:'endTurn'}).ok).toBe(false);
 });

});
