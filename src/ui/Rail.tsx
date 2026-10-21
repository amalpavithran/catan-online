import type { PlayerView } from '../../shared/redact';
import { RESOURCES, type PlayerId } from '../../shared/types';
import { RESOURCE_COLOR, RESOURCE_NAME, ResourceGlyph } from '../board/icons';

export function Rail({ view, me }: { view: PlayerView; me: PlayerId | null }) {
  return (
    <section className="player-strip" aria-label="Player statistics" data-count={view.players.length}>
      <div className="players">
        {view.players.map((p) => {
          const owed = view.pendingDiscards[p.id];
          return (
            <div
              key={p.id}
              className="player-card"
              data-player={p.id}
              style={{ ['--player-color' as string]: p.color }}
              data-active={p.id === view.currentPlayerId}
              data-offline={!p.connected}
            >
              <span className="avatar" aria-hidden="true" />
              <div className="player-name" title={p.name}>
                <span className="player-name-text">{p.name}</span>
                {p.id === me && <span className="award">you</span>}
                {view.longestRoad.owner === p.id && <span className="award">road</span>}
                {view.largestArmy.owner === p.id && <span className="award">army</span>}
              </div>
              <div className="player-vp" title="Victory points">{p.victoryPoints}<small>VP</small></div>
              <div className="player-meta">
                <span title="Resource cards" aria-label={`${p.handSize} resource cards`}>
                  <StatIcon kind="cards" /><b>{p.handSize}</b>
                </span>
                <span title="Development cards" aria-label={`${p.devCardCount} development cards`}>
                  <StatIcon kind="dev" /><b>{p.devCardCount}</b>
                </span>
                <span title="Knights played" aria-label={`${p.knightsPlayed} knights played`}>
                  <StatIcon kind="knights" /><b>{p.knightsPlayed}</b>
                </span>
                {owed ? <span style={{ color: 'var(--grain)' }}>discarding {owed}</span> : null}
                {!p.connected && <span style={{ color: 'var(--text-faint)' }}>offline</span>}
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}

export function GameDetails({ view }: { view: PlayerView }) {
  return <details className="game-details">
    <summary>Bank &amp; log</summary>
    <div className="game-details-panel">
      <div className="bank" aria-label="Bank">
        <span className="bank-label">Bank</span>
        {RESOURCES.map((r) => (
          <span key={r} className="bank-cell" title={RESOURCE_NAME[r]} data-empty={view.bank[r] === 0}>
            <span className="bank-glyph" style={{ color: RESOURCE_COLOR[r] }}>
              <ResourceGlyph resource={r} />
            </span>
            <b>{view.bank[r]}</b>
          </span>
        ))}
        <span className="bank-cell" title="Development cards">
          <span className="bank-glyph bank-dev">?</span>
          <b>{view.devDeckSize}</b>
        </span>
      </div>

      <div className="log">
        {view.log.length === 0 && <p className="log-empty">Nothing has happened yet.</p>}
        {[...view.log].reverse().map((entry) => {
          const who = view.players.find((p) => p.id === entry.player);
          return (
            <p key={entry.id} className="log-entry">
              {who && <b style={{ color: who.color }}>{who.name}</b>} {entry.text}
            </p>
          );
        })}
      </div>
    </div>
  </details>;
}

function StatIcon({ kind }: { kind: 'cards' | 'dev' | 'knights' }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {kind === 'cards' ? <><rect x="6" y="3" width="10" height="14" rx="2"/><path d="M4 6H3v11a2 2 0 0 0 2 2h7"/></>
      : kind === 'dev' ? <><rect x="4" y="2" width="12" height="16" rx="2"/><path d="m10 5 1.3 3 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1L8.7 8z"/></>
      : <><path d="M5 17h11M6 15h8l-1-5 3-2-4-5-4 1-2 5 3 1-3 5Z"/><path d="M11 6h1"/></>}
  </svg>;
}
