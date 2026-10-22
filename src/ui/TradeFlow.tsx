import { RESOURCES, type ResourceCounts, type TradeOffer } from '../../shared/types';
import { RESOURCE_COLOR, RESOURCE_NAME, ResourceGlyph } from '../board/icons';

export function TradeArrow({ giving }: { giving: boolean }) {
  return <svg className={giving ? 'resource-direction giving' : 'resource-direction receiving'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" role="img" aria-label={giving ? 'You give' : 'You receive'}>
    <path d={giving ? 'M12 21V3M5 10l7-7 7 7' : 'M12 3v18M5 14l7 7 7-7'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function Bundle({ resources, any = 0 }: { resources: ResourceCounts; any?: number }) {
  return <div className="trade-bundle">{RESOURCES.filter(r => resources[r] > 0).map(r =>
    <span key={r} className="trade-resource" style={{ ['--resource-color' as string]: RESOURCE_COLOR[r] }}
      role="img" aria-label={`${resources[r]} ${RESOURCE_NAME[r]}`} title={`${resources[r]} ${RESOURCE_NAME[r]}`}>
      <ResourceGlyph resource={r} /><b>{resources[r]}</b>
    </span>
  )}{any>0&&<span className="trade-resource" style={{['--resource-color' as string]:'#d9c8a6'}} role="img" aria-label={`${any} any resource cards`} title="Any resource cards"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1"/></svg><b>{any}</b></span>}</div>;
}
export function TradeFlow({ offer, mine }: { offer: TradeOffer; mine: boolean }) {
  return <div className="trade-flow compact-trade-flow">
    <div className="trade-leg" role="group" aria-label="Cards you give"><TradeArrow giving /><Bundle resources={mine ? offer.give : offer.want} any={mine ? 0 : offer.anyWant} /></div>
    <div className="trade-leg" role="group" aria-label="Cards you receive"><TradeArrow giving={false} /><Bundle resources={mine ? offer.want : offer.give} any={mine ? offer.anyWant : 0} /></div>
  </div>;
}
