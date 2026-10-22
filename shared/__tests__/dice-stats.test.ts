import {it,expect} from 'vitest';
import {createGame,applyAction} from '../rules';
import {diceStats} from '../diceStats';
import {viewFor} from '../redact';
it('counts every roll past the retained log limit and preserves stats in saved games',()=>{
 let s=createGame([{id:'a',name:'A'},{id:'b',name:'B'}],33);const expected=Array(13).fill(0);
 for(let i=0;i<250;i++){s.phase='rolling';s.mustRoll=true;const result=applyAction(s,'a',{type:'rollDice'});if(!result.ok)throw Error(result.error);s=result.state;expected[s.dice![0]+s.dice![1]]++;}
 expect(s.log.length).toBeLessThanOrEqual(200);expect(diceStats(s).counts).toEqual(expected);expect(diceStats(s).counts.reduce((a,b)=>a+b,0)).toBe(250);expect(diceStats(s).complete).toBe(true);expect(viewFor(s,'a').diceStats).toBeUndefined();s.winner='a';s.phase='finished';expect(viewFor(JSON.parse(JSON.stringify(s)),'a').diceStats?.counts).toEqual(expected);
});
it('labels old saves as partial history rather than inventing missing rolls',()=>{
 expect(diceStats({log:[{id:1,turn:1,player:'a',text:'rolls 6.'},{id:2,turn:1,player:'a',text:'collects 1 ore.'}]})).toEqual({counts:[0,0,0,0,0,0,1,0,0,0,0,0,0],complete:false});
});
