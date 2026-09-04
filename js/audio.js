// ============================================================ AUDIO (sintetizado con WebAudio, sin archivos)
const AUDIO = {ctx: null, master: null, musicGain: null, muted: false, last: {}, musicOn: false, musicTimer: null};
function audioInit() {
  if (AUDIO.ctx) { if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume(); return; }
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    AUDIO.ctx = C; AUDIO.master = C.createGain(); AUDIO.master.gain.value = OPTS.vol; AUDIO.master.connect(C.destination);
    AUDIO.musicGain = C.createGain(); AUDIO.musicGain.gain.value = OPTS.music * 0.5; AUDIO.musicGain.connect(C.destination);
    startMusic();
  } catch (e) { AUDIO.ctx = null; }
}
addEventListener('pointerdown', audioInit, {once: false}); addEventListener('keydown', audioInit);
function toggleMute() { AUDIO.muted = !AUDIO.muted; if (AUDIO.master) AUDIO.master.gain.value = AUDIO.muted ? 0 : OPTS.vol; if (AUDIO.musicGain) AUDIO.musicGain.gain.value = AUDIO.muted ? 0 : OPTS.music * 0.5; hint(AUDIO.muted ? 'Sonido silenciado' : 'Sonido activado'); }
function applyVolume() { if (AUDIO.master && !AUDIO.muted) AUDIO.master.gain.value = OPTS.vol; if (AUDIO.musicGain && !AUDIO.muted) AUDIO.musicGain.gain.value = OPTS.music * 0.5; }
function tone(freq, dur, type = 'sine', vol = 0.3, delay = 0, slide = 0) {
  const C = AUDIO.ctx; if (!C) return;
  const o = C.createOscillator(), g = C.createGain(); const t = C.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AUDIO.master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, delay = 0, freq = 1200) {
  const C = AUDIO.ctx; if (!C) return;
  const n = Math.floor(C.sampleRate * dur); const buf = C.createBuffer(1, n, C.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = C.createBufferSource(); s.buffer = buf; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = C.createGain(); const t = C.currentTime + delay; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AUDIO.master); s.start(t);
}
// sfx posicional: si se indica posición, solo suena si está cerca de la cámara y se atenúa
function sfx(name, x, y) {
  if (!AUDIO.ctx || AUDIO.muted || typeof G === 'undefined' || !G) return;
  const now = performance.now();
  const minGap = {clash: 70, thud: 90, arrow: 60, hammer: 120, boom: 150, click: 30}[name] || 40;
  if (AUDIO.last[name] && now - AUDIO.last[name] < minGap) return;
  let vol = 1;
  if (x !== undefined) {
    const cx = UI.cam.x + VW / 2 / UI.cam.z, cy = UI.cam.y + viewH() / 2 / UI.cam.z;
    const d = Math.hypot(x - cx, y - cy); const maxD = 900 / UI.cam.z;
    if (d > maxD) return; vol = 1 - d / maxD * 0.7;
  }
  AUDIO.last[name] = now;
  switch (name) {
    case 'click': tone(900, 0.04, 'square', 0.04); break;
    case 'order': tone(520, 0.06, 'triangle', 0.12); tone(780, 0.06, 'triangle', 0.1, 0.05); break;
    case 'order2': tone(400, 0.08, 'sawtooth', 0.1); tone(300, 0.1, 'sawtooth', 0.1, 0.06); break;
    case 'place': tone(300, 0.1, 'triangle', 0.2); noise(0.08, 0.15, 0, 600); break;
    case 'hammer': noise(0.05, 0.12 * vol, 0, 2500); tone(180 + Math.random() * 40, 0.05, 'square', 0.05 * vol); break;
    case 'clash': noise(0.06, 0.18 * vol, 0, 3500); tone(2200 + Math.random() * 600, 0.05, 'square', 0.04 * vol); break;
    case 'thud': noise(0.12, 0.2 * vol, 0, 300); break;
    case 'arrow': noise(0.08, 0.08 * vol, 0, 5000); break;
    case 'boom': noise(0.5, 0.5 * vol, 0, 150); tone(60, 0.5, 'sine', 0.4 * vol, 0, -40); break;
    case 'death': tone(220, 0.25, 'sawtooth', 0.12, 0, -150); break;
    case 'crumble': noise(0.8, 0.4, 0, 250); noise(0.6, 0.3, 0.2, 180); break;
    case 'horn': for (let i = 0; i < 2; i++) { tone(196, 0.35, 'sawtooth', 0.2, i * 0.4); tone(196 * 1.5, 0.35, 'sawtooth', 0.12, i * 0.4); } break;
    case 'bell': for (let i = 0; i < 3; i++) { tone(880, 0.6, 'sine', 0.2, i * 0.35); tone(1320, 0.4, 'sine', 0.08, i * 0.35); } break;
    case 'chime': tone(880, 0.15, 'sine', 0.2); tone(1174, 0.25, 'sine', 0.2, 0.12); break;
    case 'coin': tone(1500, 0.08, 'square', 0.08); tone(2000, 0.12, 'square', 0.08, 0.07); break;
    case 'convert': tone(440, 0.3, 'sine', 0.2, 0, 440); tone(660, 0.3, 'sine', 0.15, 0.15, 660); break;
    case 'fanfare2': [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, i * 0.12)); break;
    case 'fanfare': [392, 523, 659, 784, 1046].forEach((f, i) => { tone(f, 0.4, 'triangle', 0.2, i * 0.15); tone(f / 2, 0.4, 'sawtooth', 0.06, i * 0.15); }); tone(1046, 1.2, 'triangle', 0.2, 0.75); break;
    case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => { tone(f, 0.5, 'triangle', 0.22, i * 0.22); tone(f / 2, 0.5, 'sine', 0.12, i * 0.22); }); break;
    case 'defeat': [440, 415, 392, 349].forEach((f, i) => tone(f, 0.7, 'sawtooth', 0.15, i * 0.5)); break;
  }
}
// música ambiental: pad lento + melodía pentatónica aleatoria
function startMusic() {
  if (!AUDIO.ctx || AUDIO.musicOn) return;
  AUDIO.musicOn = true;
  const C = AUDIO.ctx;
  const scale = [220, 246.9, 293.7, 329.6, 392, 440, 493.9, 587.3];
  let step = 0;
  const play = () => {
    if (!AUDIO.musicOn) return;
    const bpm = 0.9; // segundos por nota
    const t = C.currentTime;
    if (step % 8 === 0) { // acorde pad
      const root = pick([220, 174.6, 196, 146.8]);
      for (const m of [1, 1.5, 2, 2.5]) { const o = C.createOscillator(), g = C.createGain(); o.type = 'sine'; o.frequency.value = root * m; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + bpm * 8); o.connect(g); g.connect(AUDIO.musicGain); o.start(t); o.stop(t + bpm * 8 + 0.1); }
    }
    if (Math.random() < 0.7) { const f = pick(scale) * (Math.random() < 0.3 ? 2 : 1); const o = C.createOscillator(), g = C.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + bpm * (Math.random() < 0.3 ? 2 : 1)); o.connect(g); g.connect(AUDIO.musicGain); o.start(t); o.stop(t + bpm * 2 + 0.1); }
    step++;
    AUDIO.musicTimer = setTimeout(play, bpm * 1000 * (Math.random() < 0.2 ? 2 : 1));
  };
  play();
}
