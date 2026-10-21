import { applyAction, legalMoves } from '../shared/rules';
import { RESOURCES, emptyResources, type Action, type GameState } from '../shared/types';
import { LEGACY_TIMERS, type RoomClock, type TimerSettings } from '../shared/timers';

export type TimedRoom = {
  state: GameState | null;
  seats: { socketId: string | null }[];
  timers?: TimerSettings;
  clock?: RoomClock | null;
  endingTimedOutTurn?: boolean;
  updatedAt: number;
};

function specification(room: TimedRoom): Omit<RoomClock, 'deadline'> | null {
  const s = room.state;
  if (!s || s.phase === 'lobby' || s.phase === 'finished') return null;
  const timers = room.timers ?? LEGACY_TIMERS;
  const key = `${s.turn}:${s.current}:${s.phase}:${s.setup?.round ?? ''}:${s.setup?.placing ?? ''}`;
  if (s.phase === 'rolling') {
    // A disabled auto-roll does not disable the ordinary inactivity limit.
    const seconds = timers.autoRollSeconds || timers.actionSeconds;
    return seconds ? { key, kind: timers.autoRollSeconds ? 'roll' : 'action', remainingMs: seconds * 1000, playerIds: [s.players[s.current].id] } : null;
  }
  if (!timers.actionSeconds) return null;
  return { key, kind: s.phase === 'discarding' ? 'discard' : 'action', remainingMs: timers.actionSeconds * 1000,
    playerIds: s.phase === 'discarding' ? Object.keys(s.pendingDiscards) : [s.players[s.current].id] };
}

/** Arm a fresh action, or pause/resume without granting a fresh budget on reconnect. */
export function syncClock(room: TimedRoom, now = Date.now(), reset = false): boolean {
  const wanted = specification(room);
  if (!wanted) {
    const changed = !!room.clock;
    room.clock = null;
    return changed;
  }
  const online = room.seats.some(s => s.socketId !== null);
  const old = room.clock;
  // Discard responders share a deadline; answering never extends another debtor's time.
  if (!old || old.key !== wanted.key || (reset && wanted.kind !== 'discard')) {
    room.clock = { ...wanted, deadline: online ? now + wanted.remainingMs : null };
    return true;
  }
  old.playerIds = wanted.playerIds;
  if (!online && old.deadline !== null) {
    old.remainingMs = Math.max(0, old.deadline - now);
    old.deadline = null;
    return true;
  }
  if (online && old.deadline === null) {
    old.deadline = now + old.remainingMs;
    return true;
  }
  return false;
}

function log(room: TimedRoom, text: string): void {
  const s = room.state!;
  s.log.push({ id: s.nextLogId++, turn: s.turn, player: s.players[s.current].id, text });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}
function apply(room: TimedRoom, action: Action, player = room.state!.players[room.state!.current].id): void {
  const result = applyAction(room.state!, player, action);
  if (!result.ok) throw new Error(`Automatic ${action.type}: ${result.error}`);
  room.state = result.state;
}
function discard(room: TimedRoom, id: string): void {
  const s = room.state!;
  const p = s.players.find(p => p.id === id)!;
  let left = s.pendingDiscards[id];
  const resources = emptyResources();
  for (const r of [...RESOURCES].sort((a, b) => p.resources[b] - p.resources[a])) {
    resources[r] = Math.min(left, p.resources[r]);
    left -= resources[r];
  }
  apply(room, { type: 'discard', resources }, id);
}

/** Complete compulsory choices legally, then end only the timed-out player's portion. */
function finishExpiredTurn(room: TimedRoom): void {
  for (let step = 0; step < 16; step++) {
    const s = room.state!;
    const id = s.players[s.current].id;
    const moves = legalMoves(s, id);
    if (s.phase === 'finished') { room.endingTimedOutTurn = false; return; }
    if (s.phase === 'discarding') {
      if (s.pendingDiscards[id]) discard(room, id);
      // Other players still receive their own discard window.
      if (room.state!.phase === 'discarding') return;
    } else if (s.phase === 'rolling') apply(room, { type: 'rollDice' });
    else if (s.phase === 'movingRobber') apply(room, { type: 'moveRobber', hex: moves.robberSpots[0] });
    else if (s.phase === 'stealing') apply(room, { type: 'steal', target: moves.stealTargets[0] ?? null });
    else if (s.phase === 'main') {
      apply(room, { type: 'endTurn' });
      room.endingTimedOutTurn = false;
      return;
    } else return;
  }
  throw new Error('Automatic turn completion exceeded its transition bound.');
}

export function advanceClock(room: TimedRoom, now = Date.now()): boolean {
  let changed = syncClock(room, now);
  if (!room.clock || room.clock.deadline === null || now < room.clock.deadline) return changed;
  const s = room.state!;
  const clock = room.clock;
  if (clock.kind === 'roll') {
    log(room, 'auto-rolls after the dice timer expires.');
    apply(room, { type: 'rollDice' });
  } else if (s.phase === 'setup') {
    log(room, 'runs out of setup time; places legal starting pieces automatically.');
    const round = s.setup!.round;
    const player = s.current;
    if (s.setup!.placing === 'settlement') apply(room, { type: 'placeSetupSettlement', vertex: legalMoves(s, s.players[player].id).settlementSpots[0] });
    apply(room, { type: 'placeSetupRoad', edge: legalMoves(room.state!, room.state!.players[player].id).roadSpots[0] });
    // Snake-draft turns can belong to the same player in successive rounds.
    if (room.state!.phase === 'setup' && room.state!.current === player && room.state!.setup!.round === round) throw new Error('Setup did not advance.');
  } else if (s.phase === 'discarding') {
    const current = s.players[s.current].id;
    const timedOutCurrent = !!s.pendingDiscards[current];
    log(room, 'resolves overdue discards automatically.');
    for (const id of Object.keys(s.pendingDiscards)) discard(room, id);
    if (timedOutCurrent || room.endingTimedOutTurn) {
      room.endingTimedOutTurn = true;
      finishExpiredTurn(room);
    }
  } else {
    log(room, 'runs out of action time; the turn ends after required choices are resolved.');
    room.endingTimedOutTurn = true;
    finishExpiredTurn(room);
  }
  room.updatedAt = now;
  room.clock = null;
  syncClock(room, now);
  changed = true;
  return changed;
}

/** Continue a previously timed-out turn once all other players finish discarding. */
export function finishPendingTimeout(room: TimedRoom): void {
  if (room.endingTimedOutTurn && room.state?.phase !== 'discarding') finishExpiredTurn(room);
}
