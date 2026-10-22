import type { DiceStats } from '../../shared/diceStats';
export function DiceStatistics({stats}:{stats:DiceStats|undefined}) {
 const counts=stats?.counts??Array(13).fill(0),total=counts.reduce((a,b)=>a+b,0),max=Math.max(1,...counts);
 return <section className="dice-statistics" aria-label="Dice roll statistics"><h2>Dice rolls</h2><p>{total} recorded rolls{stats?.complete?' · Full game':' · Available history only'}</p>
 {!stats?.complete&&<p className="stats-note">This game began before full roll tracking. Earlier rolls may be missing.</p>}
 <div className="dice-histogram" role="img" aria-label={`Dice totals: ${Array.from({length:11},(_,i)=>`${i+2}: ${counts[i+2]} rolls`).join(', ')}`}>{Array.from({length:11},(_,i)=>{const n=i+2;return <div key={n} className="dice-column"><b>{counts[n]}</b><div className="dice-bar-well"><div className="dice-bar" style={{height:`${counts[n]/max*100}%`}}/></div><strong>{n}</strong></div>;})}</div>
 <table className="dice-stats-table"><thead><tr><th>Total</th><th>Rolls</th><th>Observed</th><th>Expected</th></tr></thead><tbody>{Array.from({length:11},(_,i)=>{const n=i+2;return <tr key={n}><th>{n}</th><td>{counts[n]}</td><td>{total?(counts[n]/total*100).toFixed(1):'0.0'}%</td><td>{((6-Math.abs(7-n))/36*100).toFixed(1)}%</td></tr>;})}</tbody></table>
 </section>;
}
