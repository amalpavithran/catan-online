import { useEffect, useState } from 'react';
import type { RoomClock } from '../../shared/timers';
export function RoomTimer({ clock, serverNow }: { clock: RoomClock | null; serverNow: number }) {
  const [now, setNow] = useState(Date.now);
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(serverNow - Date.now()); setNow(Date.now()); }, [serverNow]);
  useEffect(() => {
    if (!clock || clock.deadline === null) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [clock?.deadline]);
  if (!clock) return null;
  const paused = clock.deadline === null;
  const seconds = Math.max(0, Math.ceil((paused ? clock.remainingMs : clock.deadline! - now - offset) / 1000));
  const label = clock.kind === 'roll' ? 'Auto-roll' : clock.kind === 'discard' ? 'Discard' : 'Action';
  return <span className="room-clock" role="timer" aria-live="off" data-urgent={!paused && seconds <= 5}
    title={paused ? 'Timer paused while everyone is disconnected' : `${label} timer: ${seconds} seconds remaining`}>
    <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 2"/></svg>
    {paused ? 'Paused' : `${label} ${seconds}s`}
  </span>;
}
