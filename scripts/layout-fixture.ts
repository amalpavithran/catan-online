import fs from 'node:fs';
import { createRoom, joinRoom, startGame, saveRooms, enablePersistence } from '../server/rooms';
import { applyAction, legalMoves } from '../shared/rules';
import { RESOURCES } from '../shared/types';
import { start } from '../server/index';
enablePersistence('/tmp/catan-layout-state.json');
const fixtures=[];
for(const n of [4,6]){
 const {room,seat}=createRoom('Alex',`fixture-${n}-1`);const seats=[seat];
 for(let i=1;i<n;i++){const r=joinRoom(room.code,['Alex','Maya','Robin','Jules','Luca','Nora'][i],`fixture-${n}-${i+1}`);if(typeof r==='string')throw Error(r);seats.push(r.seat);}
 startGame(room,room.hostId);
 let state=room.state!;
 while(state.phase==='setup'){
  const p=state.players[state.current].id,m=legalMoves(state,p);
  const action=state.setup!.placing==='settlement'?{type:'placeSetupSettlement' as const,vertex:m.settlementSpots[0]}:{type:'placeSetupRoad' as const,edge:m.roadSpots[0]};
  const r=applyAction(state,p,action);if(!r.ok)throw Error(r.error);state=r.state;
 }
 state.phase='main';state.mustRoll=false;state.dice=[3,5];
 for(const p of state.players)for(const r of RESOURCES){state.bank[r]-=3-p.resources[r];p.resources[r]=3;}
 room.state=state;
 const current=state.players[state.current].id;
 fixtures.push({n,code:room.code,sessions:seats.map(s=>({name:s.name,id:s.playerId,code:room.code,token:s.token})),current});
}
saveRooms();fs.writeFileSync('/tmp/catan-layout-fixtures.json',JSON.stringify(fixtures),{mode:0o600});
await start(3191);console.log('Layout fixture server on 3191');
