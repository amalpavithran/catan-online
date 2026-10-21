import {beforeAll,afterAll,it,expect} from 'vitest';
import {io,type Socket} from 'socket.io-client';
import {start,stop} from '../index';
import {resetRooms,roomCount} from '../rooms';
let url='';const clients:Socket[]=[];
const ack=(s:Socket,event:string,payload:object)=>new Promise<any>(resolve=>s.emit(event,payload,resolve));
async function connect(){const s=io(url,{transports:['websocket']});clients.push(s);await new Promise<void>(r=>s.once('connect',r));return s;}
async function until(fn:()=>boolean,ms=10000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out waiting for timer-driven state');}
beforeAll(async()=>{resetRooms();url=`http://127.0.0.1:${await start(0)}`;});
afterAll(async()=>{for(const s of clients)s.disconnect();await stop();resetRooms();});
it('rejects invalid creation settings without creating a room',async()=>{const s=await connect();const before=roomCount();const r=await ack(s,'room:create',{name:'Invalid',timers:{actionSeconds:-1,autoRollSeconds:5}});expect(r.ok).toBe(false);expect(r.error).toMatch(/Action timer/);expect(roomCount()).toBe(before);});
it('broadcasts server-driven setup, automatic dice and automatic turn end without client actions',async()=>{
 const host=await connect(), guest=await connect();let latest:any=null;
 host.on('sync',s=>latest=s);
 const created=await ack(host,'room:create',{name:'Timer host',timers:{actionSeconds:1,autoRollSeconds:1}});
 expect(created.ok).toBe(true);expect((await ack(guest,'room:join',{code:created.code,name:'Timer guest'})).ok).toBe(true);
 host.emit('game:start');await until(()=>latest?.view?.phase==='setup');
 expect(latest.room.timers).toEqual({actionSeconds:1,autoRollSeconds:1});expect(latest.room.clock.deadline-latest.room.serverNow).toBeLessThanOrEqual(1000);
 await until(()=>latest?.view?.phase==='rolling');const turn=latest.view.turn;
 expect(latest.room.clock.kind).toBe('roll');expect(Object.keys(latest.view.board.buildings)).toHaveLength(4);
 await until(()=>latest?.view?.dice!==null);
 expect(latest.view.dice.every((n:number)=>n>=1&&n<=6)).toBe(true);
 await until(()=>latest?.view?.turn>turn);
 expect(latest.view.log.some((l:any)=>l.text.includes('auto-rolls'))).toBe(true);
 expect(latest.view.log.some((l:any)=>l.text.includes('runs out of action time'))).toBe(true);
},12000);
