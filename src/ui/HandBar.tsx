import type { PlayerView } from '../../shared/redact';
import { BUILD_COSTS, RESOURCES, type Resource, type ResourceCounts } from '../../shared/types';
import { RESOURCE_COLOR, RESOURCE_NAME, ResourceGlyph } from '../board/icons';

export type Pending = 'settlement' | 'city' | 'road' | 'robber' | null;

export function Dice({ dice }: { dice: [number, number] | null }) {
  if (!dice) return null;
  return (
    <div className="dice">
      <Die value={dice[0]} />
      <Die value={dice[1]} />
      <span className="dice-total">{dice[0] + dice[1]}</span>
    </div>
  );
}

/** Pip positions on a 3x3 grid, in CSS grid-area terms. */
const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
};

function Die({ value }: { value: number }) {
  return (
    <svg className="die" data-rolling="true" viewBox="0 0 36 36" role="img" aria-label={`Die showing ${value}`}>
      <rect x="1" y="1" width="34" height="34" rx="6" fill="var(--paper)" stroke="#b5a487" />
      {(PIP_LAYOUT[value] ?? []).map(([row, col], i) => (
        <circle key={i} className="pip" cx={8 + (col - 1) * 10} cy={8 + (row - 1) * 10} r="3" fill="var(--ink)" />
      ))}
    </svg>
  );
}

export function Cards({ resources }: { resources: ResourceCounts }) {
  return (
    <div className="cards" aria-label="Your resource cards">
      {RESOURCES.map((r) => (
        <div
          key={r}
          className="card"
          data-resource={r}
          style={{ ['--card-color' as string]: RESOURCE_COLOR[r] }}
          data-empty={resources[r] === 0}
          title={`${RESOURCE_NAME[r]}: ${resources[r]}`}
          role="img" aria-label={`${resources[r]} ${RESOURCE_NAME[r]}`}
        >
          <ResourceGlyph resource={r} />
          {/* Keyed on the count so a change remounts the chip and it pops. */}
          <span key={resources[r]} className="card-count">
            {resources[r]}
          </span>
        </div>
      ))}
    </div>
  );
}

function CostRow({ cost }: { cost: ResourceCounts }) {
  return (
    <span className="build-costs">
      {RESOURCES.flatMap((r) =>
        Array.from({ length: cost[r] }, (_, i) => (
          <span
            key={`${r}${i}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: RESOURCE_COLOR[r],
              display: 'inline-block',
            }}
          />
        )),
      )}
    </span>
  );
}

function BuildButton({
  label,
  cost,
  active,
  disabled,
  onClick,
}: {
  label: string;
  cost: ResourceCounts;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'btn btn-primary' : 'btn'}
      disabled={disabled}
      onClick={onClick}
      style={{ display: 'grid', justifyItems: 'center', gap: 2, padding: '8px 14px' }}
    >
      <span>{label}</span>
      <CostRow cost={cost} />
    </button>
  );
}

/** One line telling the player exactly what the game is waiting on. */
function prompt(view: PlayerView, owed: number): string | null {
  if (view.winner) return null;
  if (owed > 0) return `Discard ${owed} ${owed === 1 ? 'card' : 'cards'}.`;
  if (!view.moves.isMyTurn) {
    if (view.moves.mustAnswerTrade) return 'Answer the trade offer.';
    const who = view.players.find((p) => p.id === view.currentPlayerId);
    return who ? `${who.name} is playing.` : null;
  }
  switch (view.phase) {
    case 'setup':
      return view.setup?.placing === 'settlement'
        ? 'Place a settlement on any free corner.'
        : 'Place a road next to it.';
    case 'rolling':
      return 'Roll to start your turn.';
    case 'movingRobber':
      return 'Move the robber to a new hex.';
    case 'stealing':
      return 'Choose who to steal from.';
    case 'discarding':
      return 'Waiting for everyone to discard.';
    default:
      return view.freeRoads > 0 ? `Place ${view.freeRoads} free ${view.freeRoads === 1 ? 'road' : 'roads'}.` : view.paired?.secondActive ? 'Player 2: build, play a card, or trade with the bank. No dice roll or player trades.' : view.paired ? 'Player 1: trade and build, then pass to Player 2.' : view.moves.roadSpots.length || view.moves.settlementSpots.length || view.moves.citySpots.length ? 'Tap a highlighted edge or corner to build.' : null;
  }
}

export type HandBarProps = {
  view: PlayerView;
  onRoll: () => void;
  onEndTurn: () => void;
  onBuyDevCard: () => void;
  openTrade: () => void;
  openCards: () => void;
};

export function HandBar({
  view,
  onRoll,
  onEndTurn,
  onBuyDevCard,
  openTrade,
  openCards,
}: HandBarProps) {
  const { moves } = view;
  const owed = moves.mustDiscard;
  const hint = prompt(view, owed);
  const myTurn = moves.isMyTurn;
  const inMain = view.phase === 'main' && myTurn;



  return (
    <div className="handbar">
      <div className="hand-status">
        <Dice dice={view.dice} />
        {hint && <p className="prompt" role="status">{hint}</p>}
      </div>
      <div className="turn-controls">
      <div className="actions">
        {myTurn && view.phase === 'rolling' && (
          <button className="btn btn-primary" onClick={onRoll}>
            Roll the dice
          </button>
        )}

        {inMain && (
          <>
            <BuildButton
              label="Buy card"
              cost={BUILD_COSTS.devCard}
              active={false}
              disabled={!moves.canBuyDevCard}
              onClick={onBuyDevCard}
            />
          </>
        )}

        {myTurn && (view.phase === 'main' || view.phase === 'rolling') && (
          <button className="btn" onClick={openCards} disabled={(view.you?.devCards.length ?? 0) === 0}>
            Your cards ({view.you?.devCards.filter((c) => !c.played).length ?? 0})
          </button>
        )}

        {inMain && (
          <button className="btn" onClick={openTrade}>
            {view.paired?.secondActive ? 'Bank trade' : 'Trade'}
          </button>
        )}

      </div>
        {inMain && (
          <button className="btn btn-primary end-turn" onClick={onEndTurn}>
            {view.paired && !view.paired.secondActive ? 'Pass to Player 2' : 'End turn'}
          </button>
        )}
      </div>
      <Cards resources={view.you?.resources ?? { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }} />
    </div>
  );
}

export const emptyCounts = (): ResourceCounts => ({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });

export function totalOf(counts: ResourceCounts): number {
  return RESOURCES.reduce((n, r) => n + counts[r], 0);
}

export type { Resource };
