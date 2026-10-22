import { useEffect, useState } from 'react';
import type { PlayerView } from '../../shared/redact';
import { RESOURCES, emptyResources, countResources, type Action, type ResourceCounts, type TradeOffer } from '../../shared/types';
import { RESOURCE_COLOR, RESOURCE_NAME, ResourceGlyph } from '../board/icons';
import { TradeArrow, TradeFlow } from './TradeFlow';

function Picker({ value, max, onChange, giving }: { value: ResourceCounts; max: ResourceCounts; onChange: (v: ResourceCounts) => void; giving: boolean }) {
  return <div className="compact-picker" role="group" aria-label={giving ? 'Cards to give' : 'Cards to receive'}>
    <TradeArrow giving={giving} />
    <div className="compact-picker-resources">{RESOURCES.map(r => <div className="compact-picker-cell" key={r}>
      <span className="picker-resource-icon" style={{color: RESOURCE_COLOR[r]}} title={RESOURCE_NAME[r]}><ResourceGlyph resource={r} /></span>
      <b>{value[r]}</b>
      <div><button aria-label={`One less ${RESOURCE_NAME[r]}`} disabled={value[r] === 0} onClick={()=>onChange({...value,[r]:value[r]-1})}>−</button>
      <button aria-label={`One more ${RESOURCE_NAME[r]}`} disabled={value[r] >= max[r]} onClick={()=>onChange({...value,[r]:value[r]+1})}>+</button></div>
    </div>)}</div>
  </div>;
}

export function TradesOverlay({ view, send, composing, setComposing }: { view: PlayerView; send: (a: Action)=>void; composing: boolean; setComposing: (v: boolean)=>void }) {
  const [give,setGive]=useState(emptyResources);
  const [want,setWant]=useState(emptyResources);
  const [anyWant,setAnyWant]=useState(0);
  const [editing,setEditing]=useState<{id:string;revision:number}|null>(null);
  const [collapsed,setCollapsed]=useState(false);
  const offers=view.trades ?? [];
  const held=view.you?.resources ?? emptyResources();
  useEffect(()=>{if(composing)setCollapsed(false);},[composing]);
  // Offers disappear server-side when control passes. Do not leave another player's composer open.
  useEffect(()=>{if(!view.moves.isMyTurn)setComposing(false);},[view.current,view.turn,view.moves.isMyTurn,setComposing]);
  if(!offers.length&&!composing)return null;
  const active=view.phase==='main';
  return <section className="trade-overlay" aria-label="Board trades">
    <div className="trade-overlay-header">
      <b>Trades{offers.length ? ` (${offers.length})` : ''}</b>
      {view.moves.canOfferTrade&&!composing&&<button className="btn" onClick={()=>{setEditing(null);setGive(emptyResources());setWant(emptyResources());setAnyWant(0);setComposing(true);}}>New offer</button>}
      <button className="btn" aria-label={collapsed ? 'Show trades' : 'Minimize trades'} onClick={()=>{setCollapsed(!collapsed);if(!collapsed)setComposing(false);}}>{collapsed ? '+' : '−'}</button>
    </div>
    {!collapsed&&<div className="trade-overlay-content">
      {composing&&<div className="trade-composer">
        {!view.paired?.secondActive&&<>
          <Picker value={give} max={held} onChange={setGive} giving />
          <Picker value={want} max={view.moves.tradeWantMax} onChange={setWant} giving={false} />
          <label className="any-resource-input">Any resource cards <input aria-label="Any resource cards" type="number" min="0" max="95" value={anyWant} onChange={e=>setAnyWant(Math.max(0,Math.min(95,Number(e.target.value)||0)))}/></label>
          <div className="trade-buttons"><button className="btn" onClick={()=>setComposing(false)}>Close</button>
            <button className="btn btn-primary" disabled={!view.moves.canOfferTrade||!countResources(give)||(!countResources(want)&&!anyWant)} onClick={()=>{
              if(editing)send({type:'editTrade',offerId:editing.id,revision:editing.revision,give,want,anyWant});else send({type:'offerTrade',give,want,anyWant});setEditing(null);setAnyWant(0);setGive(emptyResources());setWant(emptyResources());setComposing(false);
            }}>{editing?'Save changes':'Post offer'}</button></div>
        </>}
        <details className="compact-bank" open={view.paired?.secondActive || undefined}>
          <summary>Bank &amp; harbours</summary>
          {RESOURCES.filter(r=>held[r]>=view.moves.bankRates[r]).map(from=><div key={from} className="bank-swap-row">
            <span style={{color:RESOURCE_COLOR[from]}}><ResourceGlyph resource={from}/></span><b>{view.moves.bankRates[from]}</b>
            <span aria-hidden="true">→</span>
            {RESOURCES.filter(to=>to!==from).map(to=><button key={to} className="btn" aria-label={`Trade ${view.moves.bankRates[from]} ${RESOURCE_NAME[from]} for 1 ${RESOURCE_NAME[to]}`} disabled={!active||view.bank[to]===0} onClick={()=>send({type:'bankTrade',give:from,want:to})} style={{color:RESOURCE_COLOR[to]}}><ResourceGlyph resource={to}/></button>)}
          </div>)}
          {!RESOURCES.some(r=>held[r]>=view.moves.bankRates[r])&&<p>Not enough cards for a bank trade.</p>}
          {view.paired?.secondActive&&<button className="btn" onClick={()=>setComposing(false)}>Close</button>}
        </details>
      </div>}
      <div className="trade-offer-list" aria-label="Open trade offers">
        {offers.map(offer=>{
          const mine=offer.from===view.you?.id;
          const from=view.players.find(p=>p.id===offer.from);
          const response=view.you ? offer.responses[view.you.id] : undefined;
          return <article className="board-trade" key={offer.id} data-offer-id={offer.id}>
            <header><b>{mine ? 'Your offer' : from?.name ?? 'Player'}</b>
              {mine&&<button className="btn" onClick={()=>{setGive({...offer.give});setWant({...offer.want});setAnyWant(offer.anyWant??0);setEditing({id:offer.id,revision:offer.revision??0});setComposing(true);}}>Edit</button>}
              {mine&&<button className="trade-cancel" aria-label="Withdraw this offer" onClick={()=>send({type:'cancelTrade',offerId:offer.id})}>×</button>}
              {!mine&&response!=='pending'&&<span className="trade-response">{response==='accept'?(view.you&&offer.proposals?.[view.you.id]?'Proposed':'Accepted'):'Rejected'}</span>}
            </header>
            <TradeFlow offer={offer} mine={mine}/>
            {!offer.canFulfil&&<p className="trade-unavailable">Offerer no longer has these cards.</p>}
            {mine ? <div className="trade-partners">{view.players.filter(p=>p.id!==offer.from).map(p=><div key={p.id}>
              <span>{p.name}</span><span className="trade-response">{offer.responses[p.id]==='accept'?(offer.proposals?.[p.id]?'Proposed':'Accepted'):offer.responses[p.id]==='reject'?'Rejected':'Waiting'}</span>
              {offer.proposals?.[p.id]&&<TradeFlow offer={{...offer,...offer.proposals[p.id],anyWant:0}} mine />}
              {offer.responses[p.id]==='accept'&&<button className="btn btn-primary" disabled={!offer.canCompleteWith.includes(p.id)} onClick={()=>send({type:'acceptTradeWith',player:p.id,offerId:offer.id,revision:offer.revision??0})}>Trade</button>}
            </div>)}</div> : <div className="trade-buttons">
              <button className="btn" disabled={!active||response==='reject'} onClick={()=>send({type:'respondTrade',accept:false,offerId:offer.id,revision:offer.revision??0})}>Reject</button>
              <button className="btn btn-primary" disabled={!offer.canAccept||response==='accept'} onClick={()=>send({type:'respondTrade',accept:true,offerId:offer.id,revision:offer.revision??0})}>Accept</button>
            </div>}
            {!mine&&view.you&&offer.proposals?.[view.you.id]&&<div><b>Your proposal</b><TradeFlow offer={{...offer,...offer.proposals[view.you.id],anyWant:0}} mine={false}/></div>}
            {!mine&&active&&<CounterOffer offer={offer} held={held} ownerHeldMax={Object.fromEntries(RESOURCES.map(r=>[r,95])) as ResourceCounts} send={send}/>}
          </article>;
        })}
      </div>
    </div>}
  </section>;
}

function CounterOffer({offer,held,ownerHeldMax,send}:{offer:TradeOffer & {id:string};held:ResourceCounts;ownerHeldMax:ResourceCounts;send:(a:Action)=>void}) {
  const [open,setOpen]=useState(false);
  const [give,setGive]=useState(emptyResources);
  const [want,setWant]=useState(emptyResources);
  const [revision,setRevision]=useState(0);
  return <div className="counter-offer">
    {!open?<button className="btn" onClick={()=>{setGive({...offer.want});setWant({...offer.give});setRevision(offer.revision??0);setOpen(true);}}>Choose cards / Counteroffer</button>:<>
      <Picker value={give} max={held} onChange={setGive} giving />
      <Picker value={want} max={ownerHeldMax} onChange={setWant} giving={false}/>
      <div className="trade-buttons"><button className="btn" onClick={()=>setOpen(false)}>Close</button><button className="btn btn-primary" disabled={!countResources(give)||!countResources(want)||RESOURCES.some(r=>give[r]>held[r])||(offer.revision??0)!==revision} onClick={()=>{send({type:'counterTrade',offerId:offer.id,revision,give:want,want:give});setOpen(false);}}>Propose cards</button></div>
      {(offer.revision??0)!==revision&&<p>Trade changed. Close and reopen to review the latest terms.</p>}
    </>}
  </div>;
}
