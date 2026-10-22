/** Local QA only. Never used by the production server. */
import './layout-fixture';
import fs from 'node:fs';
import {createRoom,joinRoom,startGame,saveRooms,getRoom} from '../server/rooms';
import {applyAction} from '../shared/rules';
const built=JSON.parse(fs.readFileSync('/tmp/catan-layout-fixtures.json','utf8'));const six=getRoom(built[1].code)!;six.state!.players[six.state!.current].devCards.push({type:'knight',boughtOnTurn:0,played:false});
const {room,seat}=createRoom('Alex','stats-host',{actionSeconds:0,autoRollSeconds:0});joinRoom(room.code,'Maya','stats-guest');startGame(room,seat.playerId);
let state=room.state!;for(let i=0;i<72;i++){state.phase='rolling';state.mustRoll=true;const r=applyAction(state,state.players[state.current].id,{type:'rollDice'});if(!r.ok)throw Error(r.error);state=r.state;}
state.phase='finished';state.winner=seat.playerId;room.state=state;saveRooms();fs.writeFileSync('/tmp/catan-stats-fixture.json',JSON.stringify({code:room.code,token:seat.token,total:72,counts:state.diceStats!.counts}),{mode:0o600});
