import { diceStats } from './diceStats';
import { canAfford, openTrades, legalMoves, publicVictoryPoints, totalVictoryPoints, type LegalMoves } from './rules';
import { countResources, type BoardState, type DevCardType, type GameState, type LogEntry, type Phase, type Player, type PlayerId, type ResourceCounts, type TradeOffer } from './types';

/**
 * What one player is allowed to know about another: how many cards they hold, not
 * which. Knights are public once played; everything else in a hand stays hidden
 * until the game ends.
 */
export type PublicPlayer = {
  id: PlayerId;
  name: string;
  color: string;
  seat: number;
  connected: boolean;
  handSize: number;
  devCardCount: number;
  knightsPlayed: number;
  pieces: { road: number; settlement: number; city: number };
  victoryPoints: number;
  /** Only filled in once the game is over. */
  hiddenVictoryPoints: number | null;
};

export type PlayerView = {
  diceStats?: import('./diceStats').DiceStats;
  phase: Phase;
  turn: number;
  paired: GameState['paired'];
  current: number;
  currentPlayerId: PlayerId | null;
  dice: [number, number] | null;
  mustRoll: boolean;
  board: BoardState;
  bank: ResourceCounts;
  devDeckSize: number;
  setup: GameState['setup'];
  pendingDiscards: Record<PlayerId, number>;
  stealTargets: PlayerId[];
  freeRoads: number;
  trade: TradeOffer | null;
  trades: (TradeOffer & { id: string; canAccept: boolean; canFulfil: boolean; canCompleteWith: PlayerId[] })[];
  longestRoad: GameState['longestRoad'];
  largestArmy: GameState['largestArmy'];
  winner: PlayerId | null;
  log: LogEntry[];
  players: PublicPlayer[];
  /** The viewer's own seat, with full information. Null for a spectator. */
  you: {
    id: PlayerId;
    resources: ResourceCounts;
    devCards: { type: DevCardType; playable: boolean; played: boolean }[];
  } | null;
  moves: LegalMoves;
};

function toPublic(state: GameState, p: Player): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    seat: p.seat,
    connected: p.connected,
    handSize: countResources(p.resources),
    devCardCount: p.devCards.filter((c) => !c.played).length,
    knightsPlayed: p.knightsPlayed,
    pieces: { ...p.pieces },
    victoryPoints: publicVictoryPoints(state, p.id),
    hiddenVictoryPoints: state.winner ? totalVictoryPoints(state, p.id) - publicVictoryPoints(state, p.id) : null,
  };
}

/**
 * Build the view one player is sent. The full state, the shuffled deck and the
 * RNG seed never leave the server, so a client cannot read the deck order or
 * predict a roll no matter what it does.
 */
export function viewFor(state: GameState, viewerId: PlayerId | null): PlayerView {
  const me = viewerId ? state.players.find((p) => p.id === viewerId) : undefined;

  return {
    diceStats: state.winner ? diceStats(state) : undefined,
    phase: state.phase,
    turn: state.turn,
    paired: state.paired,
    current: state.current,
    currentPlayerId: state.players[state.current]?.id ?? null,
    dice: state.dice,
    mustRoll: state.mustRoll,
    board: state.board,
    bank: state.bank,
    devDeckSize: state.devDeck.length,
    setup: state.setup,
    pendingDiscards: state.pendingDiscards,
    stealTargets: state.stealTargets,
    freeRoads: state.freeRoads,
    trade: state.trade,
    trades: openTrades(state).map(offer => {
      const from = state.players.find(p => p.id === offer.from)!;
      const canFulfil = canAfford(from, offer.give);
      return { ...offer, id: offer.id ?? 'legacy', canFulfil,
        canAccept: !!me && me.id !== offer.from && state.phase === 'main' && canFulfil && !offer.anyWant && canAfford(me, offer.want),
        canCompleteWith: state.phase === 'main' ? state.players.filter(p => { const terms = offer.proposals?.[p.id] ?? offer; return offer.responses[p.id] === 'accept' && (!offer.anyWant || !!offer.proposals?.[p.id]) && canAfford(from, terms.give) && canAfford(p, terms.want); }).map(p => p.id) : [],
      };
    }),
    longestRoad: state.longestRoad,
    largestArmy: state.largestArmy,
    winner: state.winner,
    log: state.log,
    players: state.players.map((p) => toPublic(state, p)),
    you: me
      ? {
          id: me.id,
          resources: { ...me.resources },
          devCards: me.devCards.map((c) => ({
            type: c.type,
            played: c.played,
            playable: !c.played && c.type !== 'victoryPoint' && c.boughtOnTurn < state.turn,
          })),
        }
      : null,
    moves: viewerId ? legalMoves(state, viewerId) : emptyMoves(),
  };
}

function emptyMoves(): LegalMoves {
  return {
    isMyTurn: false,
    canRoll: false,
    canEndTurn: false,
    canBuyDevCard: false,
    mustDiscard: 0,
    settlementSpots: [],
    citySpots: [],
    roadSpots: [],
    robberSpots: [],
    stealTargets: [],
    playableDevCards: [],
    bankRates: { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 4 },
    freeRoads: 0,
    canOfferTrade: false,
    tradeWantMax: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 },
    mustAnswerTrade: false,
    canAcceptTrade: false,
  };
}
