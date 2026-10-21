import { hexDistance, parseHexId, type EdgeId, type HexId } from './layout';
import { shuffle, type Rng } from './rng';
import { BASE_GAME, RED_TOKENS, graphFor, type Scenario } from './scenario';
import type { BoardState, HexState, Port } from './types';

/**
 * Build a playable board: terrain shuffled onto the 19 hexes, number tokens dealt
 * so that no two red (6/8) tokens are adjacent, the robber parked on the desert,
 * and nine harbours spaced around the coastline.
 */
export function generateBoard(rng: Rng, scenario: Scenario = BASE_GAME): BoardState {
  const hexes = dealTerrainAndTokens(rng, scenario);
  const robber = Object.keys(hexes).find((h) => hexes[h].terrain === 'desert') ?? Object.keys(hexes)[0];
  return { map: scenario.id, hexes, ports: placePorts(rng, scenario), buildings: {}, roads: {}, robber };
}

function dealTerrainAndTokens(rng: Rng, scenario: Scenario): Record<HexId, HexState> {
  // Re-deal until the red-token rule holds. With 18 tokens this succeeds in a
  // handful of attempts; the cap only stops a pathological scenario hanging.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const deal = scenario.fixed ? <T>(_: Rng, xs: T[]) => [...xs] : shuffle;
    const terrains = deal(rng, scenario.terrains);
    const tokens = scenario.spiralTokens ?? deal(rng, scenario.tokens);
    const hexes: Record<HexId, HexState> = {};
    let t = 0;
    graphFor(scenario.id).hexes.forEach((h, i) => {
      const terrain = terrains[i];
      const producing = terrain !== 'desert' && terrain !== 'sea';
      hexes[h] = { terrain, token: producing && !scenario.spiralTokens ? tokens[t++] : null };
    });
    if (scenario.spiralTokens) {
      t = 0;
      for (const h of spiralHexes(scenario)) {
        if (hexes[h].terrain !== 'desert') hexes[h].token = tokens[t++];
      }
      return hexes;
    }
    if (redTokensSeparated(hexes)) return hexes;
  }
  throw new Error('could not lay out number tokens without adjacent red tokens');
}

function redTokensSeparated(hexes: Record<HexId, HexState>): boolean {
  const reds = Object.keys(hexes).filter((h) => hexes[h].token !== null && RED_TOKENS.has(hexes[h].token!));
  for (let i = 0; i < reds.length; i++) {
    for (let j = i + 1; j < reds.length; j++) {
      if (hexDistance(parseHexId(reds[i]), parseHexId(reds[j])) === 1) return false;
    }
  }
  return true;
}

/**
 * Harbours spaced evenly round the coast. On the base board that is nine on 30
 * edges, round(i * 30/9), leaving two or three open edges between each, matching
 * how the printed sea frame reads and guaranteeing no two harbours ever touch.
 */
function placePorts(rng: Rng, scenario: Scenario): Port[] {
  const graph = graphFor(scenario.id);
  const ring = graph.boundaryRing;
  const types = scenario.fixed ? scenario.ports : shuffle(rng, scenario.ports);
  return types.map((type, i) => {
    const edgeId: EdgeId = ring[Math.round((i * ring.length) / types.length) % ring.length];
    return { type, edge: edgeId, vertices: graph.edges[edgeId].vertices };
  });
}

/** Peel the island clockwise in axial space (counterclockwise on screen).
 * Each ring starts at its top-right corner, matching the printed A–Zc diagram.
 */
export function spiralHexes(scenario: Scenario): HexId[] {
  const remaining = new Set(graphFor(scenario.id).hexes);
  const result: HexId[] = [];
  const directions = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  while (remaining.size) {
    const ring = [...remaining].filter(h => {
      const {q,r} = parseHexId(h);
      return directions.some(([dq,dr]) => !remaining.has(`${q+dq},${r+dr}`));
    });
    const points = ring.map(h => ({h,...parseHexId(h)}));
    const cq = points.reduce((sum,p)=>sum+p.q,0)/points.length;
    const cr = points.reduce((sum,p)=>sum+p.r,0)/points.length;
    const angle = (p:typeof points[number]) => Math.atan2((p.r-cr)*Math.sqrt(3)/2, p.q-cq+(p.r-cr)/2);
    points.sort((a,b)=>angle(b)-angle(a));
    const top = Math.min(...points.map(p=>p.r));
    const start = points.findIndex(p=>p.r===top && p.q===Math.max(...points.filter(x=>x.r===top).map(x=>x.q)));
    const ordered=[...points.slice(start),...points.slice(0,start)];
    for(const p of ordered){result.push(p.h);remaining.delete(p.h);}
  }
  return result;
}
