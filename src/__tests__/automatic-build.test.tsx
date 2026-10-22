import {it,expect} from 'vitest';import {renderToStaticMarkup} from 'react-dom/server';
import {Board} from '../board/Board';import {viewFor} from '../../shared/redact';import {createGame,applyAction,legalMoves} from '../../shared/rules';import {emptyResources} from '../../shared/types';
it('shows affordable road and city options together without choosing a build mode, and hides them off turn or without resources',()=>{
 let s=createGame([{id:'a',name:'A'},{id:'b',name:'B'}],123);while(s.phase==='setup'){const id=s.players[s.current].id,m=legalMoves(s,id),r=applyAction(s,id,s.setup!.placing==='settlement'?{type:'placeSetupSettlement',vertex:m.settlementSpots[0]}:{type:'placeSetupRoad',edge:m.roadSpots[0]});if(!r.ok)throw Error(r.error);s=r.state;}
 s.phase='main';s.mustRoll=false;s.players[0].resources={brick:3,lumber:3,wool:3,grain:3,ore:3};const render=(who:string)=>renderToStaticMarkup(<Board view={viewFor(s,who)} pending={null} onVertex={()=>{}} onEdge={()=>{}} onHex={()=>{}}/>);
 const markup=render('a');expect(markup).toContain('data-build="road"');expect(markup).toContain('data-build="city"');expect(render('b')).not.toContain('data-build=');
 for(let i=0;i<10&&!legalMoves(s,'a').settlementSpots.length;i++){s.players[0].resources={brick:10,lumber:10,wool:10,grain:10,ore:10};const r=applyAction(s,'a',{type:'buildRoad',edge:legalMoves(s,'a').roadSpots[0]});if(!r.ok)throw Error(r.error);s=r.state;}
 expect(legalMoves(s,'a').settlementSpots.length).toBeGreaterThan(0);expect(render('a')).toContain('data-build="settlement"');s.players[0].resources=emptyResources();expect(render('a')).not.toContain('data-build=');
});
