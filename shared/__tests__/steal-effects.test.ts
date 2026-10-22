import {it,expect} from 'vitest';
import {createGame,applyAction} from '../rules';
import {viewFor} from '../redact';
it('publishes theft endpoints to every viewer without disclosing the stolen resource',()=>{
 const s=createGame([{id:'A',name:'Duplicate'},{id:'B',name:'Duplicate'},{id:'C',name:'Observer'}],123);
 s.phase='stealing';s.mustRoll=false;s.current=0;s.stealTargets=['B'];s.players[1].resources.ore=1;
 const result=applyAction(s,'A',{type:'steal',target:'B'});expect(result.ok).toBe(true);if(!result.ok)return;
 for(const id of ['A','B','C']){const entry=viewFor(result.state,id).log.at(-1)!;expect(entry.steal).toEqual({from:'B',to:'A'});expect(entry.text).not.toContain('ore');expect(Object.keys(entry.steal!)).toEqual(['from','to']);}
 expect(result.state.players[0].resources.ore).toBe(1);expect(result.state.players[1].resources.ore).toBe(0);
});
