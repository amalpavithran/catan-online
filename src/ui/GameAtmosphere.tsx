import { useEffect, useRef, useState } from 'react';
import type { PlayerView } from '../../shared/redact';
import type { LogEntry } from '../../shared/types';
import { cueFor, GameAudio } from '../fx/audio';

type Preferences = { music: boolean; effects: boolean };
function saved(): Preferences { try { const p=JSON.parse(localStorage.getItem('catan.audio') ?? '{}');return {music:p.music!==false,effects:p.effects!==false}; } catch { return {music:true,effects:true}; } }
export function useAtmosphere(view: PlayerView | null) {
  const [preferences,setPreferences]=useState(saved);
  const engine=useRef<GameAudio | null>(null);
  const previous=useRef<PlayerView | null>(null);
  const [steals,setSteals]=useState<LogEntry[]>([]);
  useEffect(()=>{
    const audio=new GameAudio();engine.current=audio;
    const unlock=()=>{ void audio.unlock(); };
    const visibility=()=>audio.visibility();
    window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);audio.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.setMusic(preferences.music && !!view);if(engine.current)engine.current.effects=preferences.effects;try{localStorage.setItem('catan.audio',JSON.stringify(preferences));}catch{}},[preferences,!!view]);
  useEffect(()=>{
    const prev=previous.current;previous.current=view;
    if(!prev||!view||prev.you?.id!==view.you?.id)return;
    const last=prev.log.at(-1)?.id ?? -1;
    const fresh=view.log.filter(e=>e.id>last);
    if(document.hidden)return;
    const cues=[...new Set(fresh.map(e=>cueFor(e.text)).filter(x=>x!==null))];
    // One compact cue per sync; steals and victories take precedence over a preceding roll.
    const cue=cues.includes('win')?'win':cues.includes('steal')?'steal':cues[0];
    if(cue)engine.current?.play(cue);
    const transfers=fresh.filter(e=>e.steal);if(transfers.length)setSteals(s=>[...s,...transfers]);
  },[view]);
  return {preferences,toggle:(key:keyof Preferences)=>setPreferences(p=>({...p,[key]:!p[key]})),steals,done:(id:number)=>setSteals(s=>s.filter(e=>e.id!==id))};
}
export function AudioControls({atmosphere}:{atmosphere:ReturnType<typeof useAtmosphere>}) {
  return <div className="audio-controls" role="group" aria-label="Game audio">{(['music','effects'] as const).map(key=><button key={key} className="mode-toggle" aria-pressed={atmosphere.preferences[key]} aria-label={`${key==='music'?'Music':'Sound effects'} ${atmosphere.preferences[key]?'on':'off'}`} title={`Toggle ${key}`} onClick={()=>atmosphere.toggle(key)}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{key==='music'?<><path d="M8 14V4l8-2v10M8 7l8-2"/><ellipse cx="5" cy="15" rx="3" ry="2"/><ellipse cx="13" cy="13" rx="3" ry="2"/></>:<><path d="M3 8h3l4-4v12l-4-4H3zM13 7q4 3 0 6M15 4q7 6 0 12"/></>}{!atmosphere.preferences[key]&&<path d="m2 2 16 16"/>}</svg><span>{key==='music'?'Music':'Effects'}</span></button>)}</div>;
}
export function StealFlights({entries,view,done}:{entries:LogEntry[];view:PlayerView;done:(id:number)=>void}) {
 return <div className="steal-layer">{entries.map(entry=><StealFlight key={entry.id} entry={entry} view={view} done={()=>done(entry.id)}/>)}</div>;
}
function StealFlight({entry,view,done}:{entry:LogEntry;view:PlayerView;done:()=>void}) {
 const ref=useRef<HTMLDivElement>(null);const callback=useRef(done);callback.current=done;
 useEffect(()=>{
   const center=(id:string)=>{const el=Array.from(document.querySelectorAll<HTMLElement>('.player-card')).find(e=>e.dataset.player===id);const r=el?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.bottom+12}:null;};
   const from=center(entry.steal!.from),to=center(entry.steal!.to);if(!from||!to){callback.current();return;}
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   const at=(x:number,y:number,angle:number)=>`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}deg)`;
   const anim=ref.current!.animate(reduced?[{transform:at(to.x,to.y+30,0),opacity:1},{transform:at(to.x,to.y+30,0),opacity:0}]:[{transform:at(from.x,from.y, -12),opacity:0},{transform:at(from.x,from.y+45,-12),opacity:1,offset:.18},{transform:at((from.x+to.x)/2,Math.max(from.y,to.y)+100,8),opacity:1,offset:.55},{transform:at(to.x,to.y+15,0),opacity:1,offset:.85},{transform:at(to.x,to.y,0),opacity:0}],{duration:reduced?450:800,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
   anim.onfinish=()=>callback.current();const timer=setTimeout(()=>callback.current(),1000);return()=>{anim.cancel();clearTimeout(timer);};
 },[entry]);
 const name=(id:string)=>view.players.find(p=>p.id===id)?.name??'Player';
 return <><div ref={ref} className="stolen-card" aria-hidden="true"><svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="24" height="36" rx="3"/><path d="m16 12 8 10-8 10-8-10zM16 17v10"/></svg></div><span className="sr-only" role="status">{name(entry.steal!.to)} stole a card from {name(entry.steal!.from)}.</span></>;
}
