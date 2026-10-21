import { useEffect, useState } from 'react';
import type { PlayerView } from '../../shared/redact';
import { RESOURCES, emptyResources, countResources, type Action, type ResourceCounts } from '../../shared/types';
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
      {view.moves.canOfferTrade&&!composing&&<button className="btn" onClick={()=>setComposing(true)}>New offer</button>}
      <button className="btn" aria-label={collapsed ? 'Show trades' : 'Minimize trades'} onClick={()=>{setCollapsed(!collapsed);if(!collapsed)setComposing(false);}}>{collapsed ? '+' : '−'}</button>
    </div>
    {!collapsed&&<div className="trade-overlay-content">
      {composing&&<div className="trade-composer">
        {!view.paired?.secondActive&&<>
          <Picker value={give} max={held} onChange={setGive} giving />
          <Picker value={want} max={view.moves.tradeWantMax} onChange={setWant} giving={false} />
          <div className="trade-buttons"><button className="btn" onClick={()=>setComposing(false)}>Close</button>
            <button className="btn btn-primary" disabled={!view.moves.canOfferTrade||!countResources(give)||!countResources(want)} onClick={()=>{
              send({type:'offerTrade',give,want});setGive(emptyResources());setWant(emptyResources());setComposing(false);
            }}>Post offer</button></div>
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
              {mine&&<button className="trade-cancel" aria-label="Withdraw this offer" onClick={()=>send({type:'cancelTrade',offerId:offer.id})}>×</button>}
              {!mine&&response!=='pending'&&<span className="trade-response">{response==='accept'?'Accepted':'Rejected'}</span>}
            </header>
            <TradeFlow offer={offer} mine={mine}/>
            {!offer.canFulfil&&<p className="trade-unavailable">Offerer no longer has these cards.</p>}
            {mine ? <div className="trade-partners">{view.players.filter(p=>p.id!==offer.from).map(p=><div key={p.id}>
              <span>{p.name}</span><span className="trade-response">{offer.responses[p.id]==='accept'?'Accepted':offer.responses[p.id]==='reject'?'Rejected':'Waiting'}</span>
              {offer.responses[p.id]==='accept'&&<button className="btn btn-primary" disabled={!offer.canCompleteWith.includes(p.id)} onClick={()=>send({type:'acceptTradeWith',player:p.id,offerId:offer.id})}>Trade</button>}
            </div>)}</div> : <div className="trade-buttons">
              <button className="btn" disabled={!active||response==='reject'} onClick={()=>send({type:'respondTrade',accept:false,offerId:offer.id})}>Reject</button>
              <button className="btn btn-primary" disabled={!offer.canAccept||response==='accept'} onClick={()=>send({type:'respondTrade',accept:true,offerId:offer.id})}>Accept</button>
            </div>}
          </article>;
        })}
      </div>
    </div>}
  </section>;
}
