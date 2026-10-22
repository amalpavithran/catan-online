/** Original pentatonic score and synthesized effects: no downloads or licensed recordings. */
export type Cue = 'roll' | 'build' | 'trade' | 'robber' | 'steal' | 'card' | 'turn' | 'win' | 'discard';
export function cueFor(text: string): Cue | null {
  if (/wins the game/.test(text)) return 'win';
  if (/steals a resource/.test(text)) return 'steal';
  if (/rolls \d+/.test(text)) return 'roll';
  if (/builds |places a settlement|upgrades /.test(text)) return 'build';
  if (/trades |offers /.test(text)) return 'trade';
  if (/moves the robber|plays a Knight/.test(text)) return 'robber';
  if (/buys a development|plays /.test(text)) return 'card';
  if (/discards /.test(text)) return 'discard';
  if (/takes their turn|begins the first turn|takes Player 2/.test(text)) return 'turn';
  return null;
}
export class GameAudio {
  context: AudioContext | null = null;
  music = true; effects = true;
  private musicBus: GainNode | null = null;
  private beat = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  async unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.interval) { this.tick(); this.interval = setInterval(() => this.tick(), 400); }
    } catch { /* Audio unavailable: gameplay remains usable. */ }
  }
  private tone(freq: number, at: number, length: number, volume: number, type: OscillatorType, bus?: AudioNode) {
    const ctx = this.context; if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    oscillator.connect(gain); gain.connect(bus ?? ctx.destination);
    oscillator.start(at); oscillator.stop(at + length + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  private tick() {
    const ctx = this.context; if (!ctx || ctx.state !== 'running' || !this.music || document.hidden) return;
    if (!this.musicBus) { this.musicBus = ctx.createGain(); this.musicBus.connect(ctx.destination); }
    this.musicBus.gain.value = .65;
    const melody = [0,7,12,7,4,7,9,7,0,7,12,16,14,12,9,7];
    const roots = [130.813,110,87.307,97.999];
    const root = roots[Math.floor(this.beat / 16) % roots.length];
    const now = ctx.currentTime;
    this.tone(root * 2 ** (melody[this.beat % 16] / 12), now, .7, .035, 'sine', this.musicBus);
    if (this.beat % 4 === 0) this.tone(root / 2, now, 1.5, .04, 'triangle', this.musicBus);
    this.beat++;
  }
  setMusic(on: boolean) { this.music = on; if (!on && this.musicBus && this.context) this.musicBus.gain.setTargetAtTime(0, this.context.currentTime, .08); }
  play(cue: Cue) {
    if (!this.effects || document.hidden || this.context?.state !== 'running') return;
    const notes: Record<Cue, number[]> = {roll:[180,260,190,340],build:[220,330,440],trade:[440,660],robber:[165,147,110],steal:[440,330,660],card:[330,495],turn:[523,659],win:[523,659,784,1047],discard:[260,180]};
    notes[cue].forEach((n,i) => this.tone(n,this.context!.currentTime + i * .065,.16,.065,'triangle'));
  }
  visibility() { if (document.hidden) void this.context?.suspend().catch(()=>{}); /* Resume only on the next user gesture. */ }
  dispose() { if(this.interval) clearInterval(this.interval); this.interval=null; void this.context?.close().catch(()=>{}); this.context=null; }
}
