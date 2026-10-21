import { RESOURCES, type ResourceCounts, type TradeOffer } from '../../shared/types';
import { RESOURCE_COLOR, RESOURCE_NAME, ResourceGlyph } from '../board/icons';

export function TradeArrow({ giving }: { giving: boolean }) {
  return <svg className={giving ? 'resource-direction giving' : 'resource-direction receiving'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" role="img" aria-label={giving ? 'You give' : 'You receive'}>
    <path d={giving ? 'M12 21V3M5 10l7-7 7 7' : 'M12 3v18M5 14l7 7 7-7'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function Bundle({ resources }: { resources: ResourceCounts }) {
  return <div className="trade-bundle">{RESOURCES.filter(r => resources[r] > 0).map(r =>
    <span key={r} className="trade-resource" style={{ ['--resource-color' as string]: RESOURCE_COLOR[r] }}
      role="img" aria-label={`${resources[r]} ${RESOURCE_NAME[r]}`} title={`${resources[r]} ${RESOURCE_NAME[r]}`}>
      <ResourceGlyph resource={r} /><b>{resources[r]}</b>
    </span>
  )}</div>;
}
export function TradeFlow({ offer, mine }: { offer: TradeOffer; mine: boolean }) {
  return <div className="trade-flow compact-trade-flow">
    <div className="trade-leg" role="group" aria-label="Cards you give"><TradeArrow giving /><Bundle resources={mine ? offer.give : offer.want} /></div>
    <div className="trade-leg" role="group" aria-label="Cards you receive"><TradeArrow giving={false} /><Bundle resources={mine ? offer.want : offer.give} /></div>
  </div>;
}
