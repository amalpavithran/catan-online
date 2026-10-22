import {it,expect} from 'vitest';
import {createGame,applyAction,openTrades} from '../rules';
import {viewFor} from '../redact';
import {emptyResources,type GameState,type Action} from '../types';
const cards=(v:Partial<ReturnType<typeof emptyResources>>)=>({...emptyResources(),...v});
function game(n=3){const s=createGame(Array.from({length:n},(_,i)=>({id:String(i),name:`Player ${i}`})),123);s.phase='main';s.mustRoll=false;s.setup=null;for(const p of s.players)p.resources=cards({brick:3,ore:3,wool:3});return s;}
function act(s:GameState,who:string,a:Action){const r=applyAction(s,who,a);if(!r.ok)throw Error(r.error);return r.state;}
function offer(s=game(),anyWant=0){return act(s,'0',{type:'offerTrade',give:cards({brick:1}),want:cards(anyWant?{}:{ore:1}),anyWant});}
it('edits one offer in place and clears prior acceptances and counteroffers',()=>{
 let s=offer();const id=openTrades(s)[0].id!;s=act(s,'1',{type:'counterTrade',offerId:id,give:cards({brick:2}),want:cards({wool:1}),revision:0});s=act(s,'0',{type:'editTrade',offerId:id,give:cards({brick:1}),want:cards({ore:2}),revision:1});const o=openTrades(s)[0];expect(o.id).toBe(id);expect(o.responses['1']).toBe('pending');expect(o.proposals).toEqual({});expect(o.revision).toBe(2);expect(applyAction(s,'0',{type:'acceptTradeWith',player:'1',offerId:id,revision:1}).ok).toBe(false);
});
it('accepts concrete mixed cards for any resource and transfers only the agreed proposal',()=>{
 let s=offer(game(),2);const id=openTrades(s)[0].id!;expect(viewFor(s,'1').trades[0].canAccept).toBe(false);expect(applyAction(s,'1',{type:'respondTrade',accept:true,offerId:id}).ok).toBe(false);
 s=act(s,'1',{type:'counterTrade',offerId:id,give:cards({brick:1}),want:cards({ore:1,wool:1}),revision:0});expect(viewFor(s,'0').trades[0].canCompleteWith).toEqual(['1']);expect(applyAction(s,'0',{type:'acceptTradeWith',player:'1',offerId:id}).ok).toBe(false);s=act(s,'0',{type:'acceptTradeWith',player:'1',offerId:id,revision:1});expect(s.players[0].resources).toEqual(cards({brick:2,ore:4,wool:4}));expect(s.players[1].resources).toEqual(cards({brick:4,ore:2,wool:2}));expect(openTrades(s)).toHaveLength(0);
});
it('keeps multiple proposals and offers independent, and rejects stale completion after a proposal changes',()=>{
 let s=offer();const id=openTrades(s)[0].id!;s=act(s,'0',{type:'offerTrade',give:cards({wool:1}),want:cards({brick:1})});s=act(s,'1',{type:'counterTrade',offerId:id,give:cards({brick:1}),want:cards({wool:1}),revision:0});s=act(s,'2',{type:'counterTrade',offerId:id,give:cards({brick:2}),want:cards({ore:1}),revision:1});expect(Object.keys(openTrades(s)[0].proposals!)).toHaveLength(2);expect(applyAction(s,'0',{type:'acceptTradeWith',player:'1',offerId:id,revision:1}).ok).toBe(false);s=act(s,'0',{type:'acceptTradeWith',player:'1',offerId:id,revision:2});expect(openTrades(s)).toHaveLength(1);
});
it('rejects unavailable cards, self proposals, off-turn editing and wildcard abuse',()=>{
 const s=offer();const id=openTrades(s)[0].id!;for(const [who,a] of [['1',{type:'counterTrade',offerId:id,give:cards({brick:4}),want:cards({ore:1})}],['0',{type:'counterTrade',offerId:id,give:cards({brick:1}),want:cards({ore:1})}],['1',{type:'editTrade',offerId:id,give:cards({brick:1}),want:cards({ore:1})}],['0',{type:'offerTrade',give:cards({brick:1}),want:cards({}),anyWant:-1}]] as [string,Action][])expect(applyAction(s,who,a).ok).toBe(false);
});
it('rechecks both hands at completion, and rejecting removes a proposal',()=>{
 let s=offer();const id=openTrades(s)[0].id!;s=act(s,'1',{type:'counterTrade',offerId:id,give:cards({brick:1}),want:cards({ore:2})});const changed=structuredClone(s);changed.players[1].resources.ore=0;expect(viewFor(changed,'0').trades[0].canCompleteWith).toEqual([]);expect(applyAction(changed,'0',{type:'acceptTradeWith',player:'1',offerId:id}).ok).toBe(false);s=act(s,'1',{type:'respondTrade',offerId:id,accept:false});expect(openTrades(s)[0].proposals?.['1']).toBeUndefined();
});
it('preserves the paired-player bank-only action phase restriction',()=>{
 const s=game(6);s.paired!.secondActive=true;expect(applyAction(s,'0',{type:'offerTrade',give:cards({brick:1}),want:cards({ore:1})}).ok).toBe(false);
});
