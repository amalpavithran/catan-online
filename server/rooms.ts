import fs from 'node:fs';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { applyAction, createGame } from '../shared/rules';
import { viewFor, type PlayerView } from '../shared/redact';
import { MAPS, isMapId, type MapId } from '../shared/scenario';
import { DEFAULT_TIMERS, LEGACY_TIMERS, parseTimerSettings, type TimerSettings, type RoomClock } from '../shared/timers';
import { advanceClock, syncClock, finishPendingTimeout } from './timers';
import type { Action, GameState, PlayerId } from '../shared/types';

export const MAX_SEATS = 6;
export const MIN_SEATS = 2;

export type Seat = {
  /** Public identity, safe to broadcast. */
  playerId: PlayerId;
  /** Private reconnect secret — never leaves the seat's own socket. */
  token: string;
  name: string;
  socketId: string | null;
};

export type Room = {
  code: string;
  hostId: PlayerId;
  seats: Seat[];
  /** Picked by the host in the lobby. */
  map: MapId;
  state: GameState | null;
  updatedAt: number;
  timers?: TimerSettings;
  clock?: RoomClock | null;
  endingTimedOutTurn?: boolean;
};

export type RoomView = {
  code: string;
  hostId: PlayerId;
  started: boolean;
  timers: TimerSettings;
  clock: RoomClock | null;
  serverNow: number;
  map: MapId;
  players: { id: PlayerId; name: string; connected: boolean }[];
};

const rooms = new Map<string, Room>();

// -- persistence -------------------------------------------------------------

let dataFile: string | null = null;

/**
 * Load rooms from disk and write them back after every change, so a server
 * restart no longer ends games. Only the real server turns this on; tests keep
 * the store in memory.
 */
export function enablePersistence(file: string): void {
  dataFile = file;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Room[];
    for (const room of saved) {
      // Nobody is connected to a server that has just started.
      for (const seat of room.seats) seat.socketId = null;
      for (const p of room.state?.players ?? []) p.connected = false;
      syncClock(room);
      rooms.set(room.code, room);
    }
  } catch {
    // No file yet, or unreadable: start empty.
  }
}

/** ponytail: rewrites the whole store on every change; fine for a few dozen rooms, per-room files if it grows. */
export function saveRooms(): void {
  if (!dataFile) return;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...rooms.values()]));
  fs.renameSync(tmp, dataFile);
}

// Unambiguous alphabet: no O/0, no I/1.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(length: number, alphabet: string): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function newCode(): string {
  let code = randomString(4, CODE_ALPHABET);
  while (rooms.has(code)) code = randomString(4, CODE_ALPHABET);
  return code;
}

function newToken(): string {
  return randomString(24, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 16) : '';
  return name || 'Player';
}

export function roomView(room: Room): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.state !== null,
    timers: room.timers ?? LEGACY_TIMERS,
    clock: room.clock ?? null,
    serverNow: Date.now(),
    map: room.map,
    players: room.seats.map((s) => ({ id: s.playerId, name: s.name, connected: s.socketId !== null })),
  };
}

export function getRoom(code: unknown): Room | undefined {
  return typeof code === 'string' ? rooms.get(code.trim().toUpperCase()) : undefined;
}

export function createRoom(name: unknown, socketId: string, settings: TimerSettings = DEFAULT_TIMERS): { room: Room; seat: Seat } {
  const timers = parseTimerSettings(settings);
  if (typeof timers === 'string') throw new Error(timers);
  const seat: Seat = { playerId: 'p1', token: newToken(), name: cleanName(name), socketId };
  const room: Room = { code: newCode(), hostId: seat.playerId, seats: [seat], map: 'classic', state: null, updatedAt: Date.now(), timers, clock: null };
  rooms.set(room.code, room);
  return { room, seat };
}

/** Lobby seats of people who went away; a newcomer or the deal may clear them. */
function dropOfflineSeats(room: Room): void {
  room.seats = room.seats.filter((s) => s.socketId !== null);
}

/** Lowest free id, so a seat freed mid-lobby never leaves two players sharing one. */
function freePlayerId(room: Room): PlayerId {
  let i = 1;
  while (room.seats.some((s) => s.playerId === `p${i}`)) i++;
  return `p${i}`;
}

export function joinRoom(code: unknown, name: unknown, socketId: string): { room: Room; seat: Seat } | string {
  const room = getRoom(code);
  if (!room) return 'No game with that code.';
  if (room.state) return 'That game has already started.';
  if (room.seats.length >= MAX_SEATS) dropOfflineSeats(room);
  if (room.seats.length >= MAX_SEATS) return 'That game is full.';

  const seat: Seat = {
    playerId: freePlayerId(room),
    token: newToken(),
    name: cleanName(name),
    socketId,
  };
  room.seats.push(seat);
  if (room.seats.length >= 5) room.map = 'large';
  room.updatedAt = Date.now();
  return { room, seat };
}

/**
 * Reconnect by secret token. This is what makes a browser refresh survivable:
 * the seat, the hand and the turn order are all still on the server.
 */
export function rejoinRoom(code: unknown, token: unknown, socketId: string): { room: Room; seat: Seat } | string {
  const room = getRoom(code);
  if (!room) return 'No game with that code.';
  const seat = room.seats.find((s) => s.token === token);
  if (!seat) return 'That seat is not in this game.';

  seat.socketId = socketId;
  syncClock(room);
  if (room.state) {
    const player = room.state.players.find((p) => p.id === seat.playerId);
    if (player) player.connected = true;
  }
  room.updatedAt = Date.now();
  return { room, seat };
}

export function startGame(room: Room, playerId: PlayerId): string | null {
  if (room.hostId !== playerId) return 'Only the host can start the game.';
  if (room.state) return 'The game has already started.';
  if (room.seats.filter((s) => s.socketId !== null).length < MIN_SEATS) return `You need at least ${MIN_SEATS} players.`;
  dropOfflineSeats(room);

  const openingRolls: string[] = [];
  if (room.seats.length >= 5) {
    room.map = 'large';
    // The official setup chooses the first player by highest dice roll.
    let tied = [...room.seats];
    while (tied.length > 1) {
      const rolls = tied.map(seat => ({seat, roll: randomInt(1, 7) + randomInt(1, 7)}));
      openingRolls.push(rolls.map(({seat, roll}) => `${seat.name}: ${roll}`).join(', '));
      const best = Math.max(...rolls.map(r => r.roll));
      tied = rolls.filter(r => r.roll === best).map(r => r.seat);
    }
    const first = room.seats.indexOf(tied[0]);
    room.seats = [...room.seats.slice(first), ...room.seats.slice(0, first)];
  }
  room.state = createGame(
    room.seats.map((s) => ({ id: s.playerId, name: s.name })),
    undefined,
    MAPS[room.map],
  );
  if (openingRolls.length) {
    room.state.log.unshift({id: 0, turn: 1, player: null,
      text: `Opening dice (${openingRolls.join('; tie reroll: ')}). ${room.seats[0].name} starts.`});
  }
  room.updatedAt = Date.now();
  syncClock(room);
  return null;
}

export function setMap(room: Room, playerId: PlayerId, map: unknown): string | null {
  if (room.hostId !== playerId) return 'Only the host can pick the map.';
  if (room.state) return 'The game has already started.';
  if (!isMapId(map)) return 'No such map.';
  if (room.seats.length >= 5 && map !== 'large') return 'Five or six players require the Large island map.';
  room.map = map;
  room.updatedAt = Date.now();
  return null;
}

export function act(room: Room, playerId: PlayerId, action: Action): string | null {
  if (!room.state) return 'The game has not started.';
  const now = Date.now();
  const expired = room.clock?.deadline !== null && room.clock?.deadline !== undefined && now >= room.clock.deadline;
  const advanced = advanceClock(room, now);
  if (expired && advanced) return 'The timer expired before that action arrived.';
  const active = room.state.players[room.state.current].id;
  const result = applyAction(room.state, playerId, action);
  if (!result.ok) return result.error;
  room.state = result.state;
  finishPendingTimeout(room);
  syncClock(room, now, active === playerId);
  room.updatedAt = now;
  return null;
}

/**
 * A dropped connection keeps the seat, in the lobby as well as in a game, so a
 * refresh or a server restart puts everyone back where they were.
 */
export function markDisconnected(socketId: string): Room[] {
  const touched: Room[] = [];
  for (const room of rooms.values()) {
    const seat = room.seats.find((s) => s.socketId === socketId);
    if (!seat) continue;
    seat.socketId = null;

    if (room.state) {
      const player = room.state.players.find((p) => p.id === seat.playerId);
      if (player) player.connected = false;
    } else if (room.hostId === seat.playerId) {
      // Someone still here has to be able to deal.
      const online = room.seats.find((s) => s.socketId !== null);
      if (online) room.hostId = online.playerId;
    }
    syncClock(room);
    touched.push(room);
  }
  return touched;
}

/**
 * Going back to the menu on purpose. A lobby seat is given up; a seat in a game
 * is kept, so the player can resume it later.
 */
export function leaveRoom(room: Room, seat: Seat): void {
  markDisconnected(seat.socketId ?? '');
  if (room.state) return;
  room.seats = room.seats.filter((s) => s !== seat);
  if (room.seats.length === 0) rooms.delete(room.code);
  else if (room.hostId === seat.playerId) room.hostId = (room.seats.find((s) => s.socketId !== null) ?? room.seats[0]).playerId;
}

export function viewForSeat(room: Room, seat: Seat): PlayerView | null {
  return room.state ? viewFor(room.state, seat.playerId) : null;
}

/** Drop rooms nobody has touched in a week. */
export function sweepStaleRooms(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [code, room] of rooms) {
    const anyoneHere = room.seats.some((s) => s.socketId !== null);
    if (!anyoneHere && room.updatedAt < cutoff) rooms.delete(code);
  }
}

export function roomCount(): number {
  return rooms.size;
}

/** A read-only snapshot of the in-memory store, for the status endpoint. */
export type RoomSummary = {
  code: string;
  map: MapId;
  players: number;
  connected: number;
  started: boolean;
  finished: boolean;
  ageMs: number;
};

export function roomsSnapshot(): RoomSummary[] {
  return [...rooms.values()].map((room) => ({
    code: room.code,
    map: room.map,
    players: room.seats.length,
    connected: room.seats.filter((s) => s.socketId !== null).length,
    started: room.state !== null,
    finished: room.state?.phase === 'finished',
    ageMs: Date.now() - room.updatedAt,
  }));
}

/** Test seam: drop every room so one test file cannot leak into the next. */
export function resetRooms(): void {
  rooms.clear();
}

/** Called by the server heartbeat, never by a browser-controlled timer. */
export function tickTimers(now = Date.now()): Room[] {
  const changed: Room[] = [];
  for (const room of rooms.values()) if (advanceClock(room, now)) changed.push(room);
  return changed;
}
