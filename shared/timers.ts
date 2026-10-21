export type TimerSettings = { actionSeconds: number; autoRollSeconds: number };
export const DEFAULT_TIMERS: TimerSettings = { actionSeconds: 30, autoRollSeconds: 5 };
/** Existing rooms retain their original untimed behavior. */
export const LEGACY_TIMERS: TimerSettings = { actionSeconds: 0, autoRollSeconds: 0 };
export type RoomClock = {
  key: string;
  kind: 'action' | 'roll' | 'discard';
  playerIds: string[];
  /** Null while everyone is disconnected. */
  deadline: number | null;
  remainingMs: number;
};
export function parseTimerSettings(input: unknown): TimerSettings | string {
  if (input === undefined) return { ...DEFAULT_TIMERS };
  if (!input || typeof input !== 'object') return 'Choose valid timer settings.';
  const { actionSeconds, autoRollSeconds } = input as Record<string, unknown>;
  if (typeof actionSeconds !== 'number' || !Number.isInteger(actionSeconds) || actionSeconds < 0 || actionSeconds > 600) return 'Action timer must be 0–600 whole seconds (0 disables it).';
  if (typeof autoRollSeconds !== 'number' || !Number.isInteger(autoRollSeconds) || autoRollSeconds < 0 || autoRollSeconds > 60) return 'Auto-roll delay must be 0–60 whole seconds (0 disables it).';
  return { actionSeconds, autoRollSeconds };
}
