// Procedural WebAudio sound effects — original, asset-free, with a silent fallback.
import { locale } from '../i18n';
import { store } from './store';

class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  crowdGain: GainNode | null = null;
  crowdSrc: AudioBufferSourceNode | null = null;
  noise: AudioBuffer | null = null;
  failed = false;

  private ensure() {
    if (this.ctx || this.failed) return this.ctx;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) { this.failed = true; return null; }
      this.ctx = new AC();
      this.master = this.ctx!.createGain();
      this.master.connect(this.ctx!.destination);
      const len = this.ctx!.sampleRate * 2;
      this.noise = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
    } catch {
      this.failed = true;
    }
    return this.ctx;
  }

  applyVolume() {
    const s = store.settings;
    if (this.master) this.master.gain.value = s.muted ? 0 : s.master;
    if (this.crowdGain) this.crowdGain.gain.value = s.muted ? 0 : s.crowd * 0.08;
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  private sfxGain(v: number) {
    return v * store.settings.sfx;
  }

  private thud(freq: number, dur: number, vol: number, noiseAmt = 0.5, hp = 200) {
    const c = this.ensure();
    if (!c || !this.master || store.settings.muted) return;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(this.sfxGain(vol), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.master);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.4), t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur);
    if (noiseAmt > 0 && this.noise) {
      const n = c.createBufferSource();
      n.buffer = this.noise;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      const ng = c.createGain();
      ng.gain.setValueAtTime(this.sfxGain(vol * noiseAmt), t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
      n.connect(f); f.connect(ng); ng.connect(this.master);
      n.start(t, Math.random());
      n.stop(t + dur);
    }
  }

  punch(big = false) { this.thud(big ? 120 : 170, big ? 0.22 : 0.12, big ? 0.9 : 0.55, 0.7, 900); }
  kick(big = false) { this.thud(big ? 90 : 110, 0.2, big ? 0.9 : 0.7, 0.8, 500); }
  block() { this.thud(260, 0.08, 0.35, 0.9, 2000); }
  whoosh() {
    const c = this.ensure();
    if (!c || !this.master || !this.noise || store.settings.muted) return;
    const t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.15);
    const g = c.createGain(); g.gain.setValueAtTime(this.sfxGain(0.16), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.17);
  }
  slam() { this.thud(60, 0.4, 1, 0.6, 150); }
  bell(times = 1) {
    const c = this.ensure();
    if (!c || !this.master || store.settings.muted) return;
    for (let k = 0; k < times; k++) {
      const t = c.currentTime + k * 0.32;
      for (const [fr, v] of [[880, 0.4], [1320, 0.2], [2210, 0.12]] as const) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const g = c.createGain(); g.gain.setValueAtTime(this.sfxGain(v), t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.5);
      }
    }
  }
  click() {
    const c = this.ensure();
    if (!c || !this.master || store.settings.muted) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 660;
    const g = c.createGain(); g.gain.setValueAtTime(this.sfxGain(0.08), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.06);
  }
  cheer(intensity = 1) {
    const c = this.ensure();
    if (!c || !this.master || !this.noise || store.settings.muted) return;
    const t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(this.sfxGain(0.22 * intensity) * store.settings.crowd * 2, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random()); n.stop(t + 2.3);
  }
  startCrowd() {
    const c = this.ensure();
    if (!c || !this.master || !this.noise || this.crowdSrc) return;
    const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    this.crowdGain = c.createGain();
    n.connect(f); f.connect(this.crowdGain); this.crowdGain.connect(this.master);
    n.start();
    this.crowdSrc = n;
    this.applyVolume();
  }
  stopCrowd() {
    try { this.crowdSrc?.stop(); } catch { /* already stopped */ }
    this.crowdSrc = null;
    this.crowdGain = null;
  }
  victory() { this.bell(3); this.cheer(1.5); }
  defeat() { this.thud(90, 0.8, 0.5, 0.2, 100); }

  // ───────────── walkout music (original, synthesized live)
  musicGain: GainNode | null = null;
  musicTimer: number | null = null;
  musicEl: HTMLAudioElement | null = null;
  private musicStep = 0;
  private musicNext = 0;

  private voice(type: OscillatorType, freq: number, t: number, dur: number, vol: number, opts: { to?: number; lp?: number; attack?: number } = {}) {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = c.createGain();
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (opts.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g); g.connect(this.musicGain!);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private noiseHit(t: number, dur: number, vol: number, hp: number) {
    const c = this.ctx!;
    const n = c.createBufferSource(); n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.musicGain!);
    n.start(t, Math.random()); n.stop(t + dur + 0.02);
  }

  /** Play a walkout track. Returns false if audio is unavailable. */
  playTrack(id: string, seconds = 20): boolean {
    this.stopMusic();
    const c = this.ensure();
    if (!c || !this.master || store.settings.muted) return false;
    this.resume();
    const def = TRACKS.find((t) => t.id === id) ?? TRACKS[0];
    if (def.id === 'silence') return true;
    this.musicGain = c.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, c.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(store.settings.music ?? 0.6, c.currentTime + 1.2);
    this.musicGain.connect(this.master);
    const stepDur = 60 / def.bpm / 4;
    this.musicStep = 0;
    this.musicNext = c.currentTime + 0.05;
    const end = c.currentTime + seconds;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      while (this.musicNext < this.ctx.currentTime + 0.12) {
        if (this.musicNext > end) { this.stopMusic(); return; }
        def.step(this, this.musicStep, this.musicNext, stepDur);
        this.musicStep++;
        this.musicNext += stepDur;
      }
    }, 25);
    return true;
  }
  /** Play a user-provided audio file (object URL). */
  playUrl(url: string) {
    this.stopMusic();
    try {
      const el = new window.Audio(url);
      el.volume = store.settings.muted ? 0 : Math.min(1, store.settings.master * (store.settings.music ?? 0.6));
      el.play().catch(() => {});
      this.musicEl = el;
    } catch { /* unsupported */ }
  }
  stopMusic() {
    if (this.musicTimer) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
    if (this.musicGain && this.ctx) {
      const g = this.musicGain;
      try { g.gain.cancelScheduledValues(this.ctx.currentTime); g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4); } catch { /* ignore */ }
      window.setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 500);
      this.musicGain = null;
    }
    if (this.musicEl) { try { this.musicEl.pause(); } catch { /* ignore */ } this.musicEl = null; }
  }

  /** Crowd bed scaled by event size (0.4 regional … 1.6 title fight). */
  setCrowdLevel(level: number) {
    if (this.crowdGain) this.crowdGain.gain.value = store.settings.muted ? 0 : store.settings.crowd * 0.08 * level;
  }

  /** Optional announcer voice via the browser's built-in speech synthesis. */
  speak(text: string) {
    if (!(store.settings as any).announcerVoice || store.settings.muted) return;
    try {
      const sy = window.speechSynthesis;
      if (!sy) return;
      sy.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = locale();
      u.rate = 0.95; u.pitch = 0.8; u.volume = Math.min(1, store.settings.master);
      sy.speak(u);
    } catch { /* unsupported */ }
  }
  stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
}

// ───────────── track definitions: 16th-note step sequencers
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
interface TrackDef { id: string; name: string; mood: string; bpm: number; step: (a: Audio, i: number, t: number, sd: number) => void }
export const TRACKS: TrackDef[] = [
  { id: 'iron', name: 'Iron Pulse', mood: 'Driving four-on-the-floor', bpm: 126, step: (a: any, i, t, sd) => {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    if (s % 4 === 0) a.voice('sine', 120, t, 0.3, 0.9, { to: 40 });
    if (s === 4 || s === 12) a.noiseHit(t, 0.18, 0.35, 1200);
    if (s % 2 === 1) a.noiseHit(t, 0.04, 0.12, 7000);
    const root = [45, 45, 48, 43][bar];
    if (s % 2 === 0) a.voice('sawtooth', NOTE(root - 12 + (s % 8 === 6 ? 12 : 0)), t, sd * 1.8, 0.22, { lp: 500 });
  } },
  { id: 'desert', name: 'Desert Drums', mood: 'Tribal toms and a haunting pluck', bpm: 96, step: (a: any, i, t, sd) => {
    const s = i % 16;
    if ([0, 3, 6, 10, 12].includes(s)) a.voice('sine', s === 0 ? 110 : 160, t, 0.35, 0.7, { to: 60 });
    if (s === 8) a.noiseHit(t, 0.25, 0.3, 900);
    const scale = [57, 60, 62, 64, 67, 69];
    if (s % 4 === 2) a.voice('triangle', NOTE(scale[(i * 7) % scale.length] + 12), t, 0.5, 0.18);
    if (s === 0) a.voice('sawtooth', NOTE(33), t, sd * 16, 0.08, { lp: 300, attack: 0.3 });
  } },
  { id: 'neon', name: 'Neon Grind', mood: 'Fast arpeggiated synth', bpm: 140, step: (a: any, i, t, sd) => {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    if (s % 4 === 0) a.voice('sine', 110, t, 0.25, 0.8, { to: 45 });
    if (s === 4 || s === 12) a.noiseHit(t, 0.15, 0.3, 1500);
    a.noiseHit(t, 0.03, 0.07, 9000);
    const chord = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]][bar];
    a.voice('sawtooth', NOTE(chord[s % 3] + (s % 6 < 3 ? 0 : 12)), t, sd * 0.9, 0.12, { lp: 1800 });
  } },
  { id: 'anthem', name: "Champion's Anthem", mood: 'Slow, heavy and triumphant', bpm: 78, step: (a: any, i, t, sd) => {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    if (s === 0 || s === 10) a.voice('sine', 100, t, 0.5, 1, { to: 38 });
    if (s === 8) a.noiseHit(t, 0.45, 0.45, 600);
    if (s === 0) for (const n of [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]][bar]) a.voice('triangle', NOTE(n), t, sd * 16, 0.1, { attack: 0.6 });
    if (s % 8 === 0) a.voice('sawtooth', NOTE([45, 41, 36, 43][bar] - 12), t, sd * 8, 0.2, { lp: 260 });
  } },
  { id: 'silence', name: 'No music', mood: 'Walk out in silence', bpm: 60, step: () => {} },
];

export const audio = new Audio();
