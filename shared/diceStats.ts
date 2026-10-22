import type { GameState } from './types';
export type DiceStats = { counts: number[]; complete: boolean };
/** Older saves have only the retained log. Never present that as a complete game. */
export function diceStats(state: Pick<GameState,'diceStats'|'log'>): DiceStats {
 if(state.diceStats)return state.diceStats;
 const counts=Array(13).fill(0);
 for(const e of state.log){const m=/^rolls (\d+)\.$/.exec(e.text);if(m&&+m[1]>=2&&+m[1]<=12)counts[+m[1]]++;}
 return {counts,complete:false};
}
