/**
 * Procedural short WAV generator — soft, polished mobile-game SFX.
 * Run: npm run sfx:generate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'sfx');
const SR = 44100;

function clamp(v, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function writeWav(filePath, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) {
    buf.writeInt16LE((clamp(samples[i]) * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

/** Exponential-ish ADSR */
function env(t, a, d, s, r, dur) {
  if (t < 0) return 0;
  if (t < a) return a <= 0 ? 1 : Math.pow(t / a, 0.7);
  if (t < a + d) {
    const u = (t - a) / Math.max(1e-6, d);
    return 1 - (1 - s) * (1 - Math.exp(-3 * u));
  }
  if (t < dur - r) return s;
  if (t < dur) {
    const u = (t - (dur - r)) / Math.max(1e-6, r);
    return s * Math.exp(-4 * u);
  }
  return 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Soft band-limited-ish oscillators (additive, not harsh digital square/saw). */
function osc(type, phase) {
  const p = phase % 1;
  const twopi = 2 * Math.PI;
  if (type === 'sine') return Math.sin(twopi * p);
  if (type === 'triangle') {
    return (2 / Math.PI) * Math.asin(Math.sin(twopi * p));
  }
  if (type === 'softsquare') {
    // Odd harmonics with rolloff — warm pulse, not 8-bit square
    let v = 0;
    for (let h = 1; h <= 7; h += 2) v += Math.sin(twopi * p * h) / (h * h);
    return v * 1.15;
  }
  if (type === 'warm') {
    // Fundamental + soft 2nd/3rd — UI “pluck”
    return (
      Math.sin(twopi * p) * 0.78 +
      Math.sin(twopi * p * 2) * 0.16 +
      Math.sin(twopi * p * 3) * 0.06
    );
  }
  if (type === 'softsaw') {
    let v = 0;
    for (let h = 1; h <= 8; h += 1) v += Math.sin(twopi * p * h) / (h * 1.35);
    return v * 0.55;
  }
  return Math.sin(twopi * p);
}

function tone({
  dur,
  freq,
  freqEnd,
  type = 'warm',
  vol = 0.32,
  a = 0.004,
  d = 0.05,
  s = 0.35,
  r = 0.06,
  noise = 0,
  vibratoHz = 0,
  vibratoCents = 0,
}) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const u = dur > 0 ? t / dur : 1;
    let f = freqEnd != null ? lerp(freq, freqEnd, u * u) : freq;
    if (vibratoHz > 0) {
      f *= Math.pow(2, (Math.sin(2 * Math.PI * vibratoHz * t) * vibratoCents) / 1200);
    }
    phase += f / SR;
    let wave = osc(type, phase);
    if (noise > 0) wave = wave * (1 - noise) + (Math.random() * 2 - 1) * noise;
    out[i] = wave * vol * env(t, a, d, s, r, dur);
  }
  return out;
}

/** One-pole low-pass */
function lowpass(samples, cutoffHz) {
  const out = new Float32Array(samples.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SR;
  const alpha = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < samples.length; i += 1) {
    y += alpha * (samples[i] - y);
    out[i] = y;
  }
  return out;
}

/** Simple high-pass via DC blocker / differentiator blend */
function highpass(samples, amount = 0.96) {
  const out = new Float32Array(samples.length);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    const y = amount * (prevY + x - prevX);
    prevX = x;
    prevY = y;
    out[i] = y;
  }
  return out;
}

function noiseBurst({
  dur,
  vol = 0.35,
  a = 0.002,
  r = 0.1,
  color = 'white', // white | pink | brown
  filterHz = 0,
}) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let b0 = 0;
  let brown = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let w = Math.random() * 2 - 1;
    if (color === 'pink') {
      // Paul Kellet approx
      b0 = 0.99765 * b0 + w * 0.099046;
      w = b0 + w * 0.25;
    } else if (color === 'brown') {
      brown = clamp(brown + w * 0.02, -1, 1);
      w = brown;
    }
    const e =
      t < a
        ? Math.pow(t / Math.max(1e-6, a), 0.6)
        : Math.exp(-3.2 * ((t - a) / Math.max(0.001, dur - a)));
    out[i] = w * vol * e;
  }
  return filterHz > 0 ? lowpass(out, filterHz) : out;
}

function softClip(samples, drive = 1.15) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i] * drive;
    out[i] = Math.tanh(x);
  }
  return out;
}

function normalize(samples, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) max = Math.max(max, Math.abs(samples[i]));
  if (max < 1e-6) return samples;
  const g = peak / max;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * g;
  return out;
}

function mix(...parts) {
  let len = 0;
  for (const p of parts) len = Math.max(len, p.length);
  const out = new Float32Array(len);
  for (const p of parts) {
    for (let i = 0; i < p.length; i += 1) out[i] += p[i];
  }
  return normalize(softClip(out));
}

function seq(gapsAndClips) {
  let total = 0;
  for (const [delay, clip] of gapsAndClips) {
    total = Math.max(total, Math.floor(delay * SR) + clip.length);
  }
  const out = new Float32Array(total);
  for (const [delay, clip] of gapsAndClips) {
    const off = Math.floor(delay * SR);
    for (let i = 0; i < clip.length; i += 1) out[off + i] += clip[i];
  }
  return normalize(softClip(out));
}

function thud({ dur = 0.12, freq = 140, vol = 0.35 }) {
  return mix(
    tone({
      dur,
      freq,
      freqEnd: freq * 0.45,
      type: 'sine',
      vol,
      a: 0.002,
      d: 0.04,
      s: 0.2,
      r: 0.07,
    }),
    lowpass(noiseBurst({ dur: dur * 0.7, vol: vol * 0.45, color: 'brown', filterHz: 600 }), 800),
  );
}

function sparkle({ dur = 0.14, freq = 880, vol = 0.28 }) {
  return mix(
    tone({
      dur,
      freq,
      freqEnd: freq * 1.35,
      type: 'warm',
      vol,
      a: 0.003,
      d: 0.05,
      s: 0.25,
      r: 0.08,
    }),
    tone({
      dur: dur * 0.85,
      freq: freq * 1.5,
      freqEnd: freq * 2,
      type: 'sine',
      vol: vol * 0.35,
      a: 0.004,
      r: 0.07,
    }),
  );
}

function chirpDown({ dur = 0.08, freq = 900, freqEnd = 420, vol = 0.26 }) {
  return tone({
    dur,
    freq,
    freqEnd,
    type: 'warm',
    vol,
    a: 0.002,
    d: 0.03,
    s: 0.25,
    r: 0.04,
  });
}

function fanfare(notes, noteDur = 0.09, gap = 0.08) {
  return seq(notes.map((f, i) => [i * gap, tone({
    dur: noteDur + (i === notes.length - 1 ? 0.06 : 0),
    freq: f,
    type: 'warm',
    vol: 0.3,
    a: 0.004,
    d: 0.05,
    s: 0.35,
    r: 0.07,
  })]));
}

const sounds = {
  // --- Maze ---
  chomp: chirpDown({ dur: 0.055, freq: 620, freqEnd: 380, vol: 0.24 }),
  chomp2: chirpDown({ dur: 0.055, freq: 700, freqEnd: 440, vol: 0.24 }),
  power: sparkle({ dur: 0.18, freq: 520, vol: 0.32 }),
  ghost: mix(
    tone({
      dur: 0.16,
      freq: 240,
      freqEnd: 180,
      type: 'triangle',
      vol: 0.22,
      vibratoHz: 7,
      vibratoCents: 18,
      a: 0.01,
      r: 0.08,
    }),
    tone({ dur: 0.16, freq: 360, freqEnd: 280, type: 'sine', vol: 0.1, r: 0.08 }),
  ),
  death: mix(
    tone({
      dur: 0.42,
      freq: 320,
      freqEnd: 70,
      type: 'softsaw',
      vol: 0.28,
      a: 0.01,
      d: 0.12,
      s: 0.35,
      r: 0.18,
    }),
    lowpass(noiseBurst({ dur: 0.22, vol: 0.18, color: 'pink', filterHz: 1200 }), 1400),
  ),
  fruit: sparkle({ dur: 0.16, freq: 740, vol: 0.3 }),
  level: fanfare([392, 494, 587, 784], 0.1, 0.09),

  // --- Pong ---
  pong_paddle: mix(
    tone({
      dur: 0.06,
      freq: 520,
      freqEnd: 680,
      type: 'warm',
      vol: 0.3,
      a: 0.002,
      r: 0.035,
    }),
    highpass(noiseBurst({ dur: 0.025, vol: 0.08, color: 'white' }), 0.97),
  ),
  pong_wall: tone({
    dur: 0.05,
    freq: 260,
    freqEnd: 220,
    type: 'triangle',
    vol: 0.26,
    a: 0.002,
    r: 0.03,
  }),
  pong_score: fanfare([523, 784], 0.1, 0.09),
  pong_miss: mix(
    tone({
      dur: 0.28,
      freq: 280,
      freqEnd: 90,
      type: 'softsaw',
      vol: 0.26,
      a: 0.008,
      d: 0.08,
      s: 0.3,
      r: 0.12,
    }),
    lowpass(noiseBurst({ dur: 0.14, vol: 0.12, color: 'brown' }), 500),
  ),
  pong_win: fanfare([523, 659, 784, 1046], 0.1, 0.09),
  pong_orb: sparkle({ dur: 0.14, freq: 900, vol: 0.28 }),

  // --- Breaker ---
  brk_hit: mix(
    thud({ dur: 0.08, freq: 170, vol: 0.28 }),
    highpass(noiseBurst({ dur: 0.035, vol: 0.12, color: 'white' }), 0.96),
  ),
  brk_break: mix(
    highpass(noiseBurst({ dur: 0.11, vol: 0.32, color: 'pink', filterHz: 4000 }), 0.94),
    tone({
      dur: 0.09,
      freq: 480,
      freqEnd: 180,
      type: 'triangle',
      vol: 0.2,
      a: 0.002,
      r: 0.05,
    }),
  ),
  brk_power: sparkle({ dur: 0.16, freq: 660, vol: 0.32 }),
  brk_life: mix(
    tone({
      dur: 0.32,
      freq: 240,
      freqEnd: 70,
      type: 'softsaw',
      vol: 0.28,
      a: 0.01,
      d: 0.1,
      s: 0.3,
      r: 0.14,
    }),
    lowpass(noiseBurst({ dur: 0.18, vol: 0.14, color: 'brown' }), 700),
  ),
  brk_stage: fanfare([392, 494, 587], 0.1, 0.09),

  // --- Snake ---
  snk_eat: tone({
    dur: 0.07,
    freq: 520,
    freqEnd: 780,
    type: 'warm',
    vol: 0.28,
    a: 0.003,
    r: 0.04,
  }),
  snk_bonus: sparkle({ dur: 0.18, freq: 700, vol: 0.32 }),
  snk_die: mix(
    tone({
      dur: 0.34,
      freq: 220,
      freqEnd: 55,
      type: 'softsaw',
      vol: 0.28,
      a: 0.01,
      d: 0.1,
      s: 0.35,
      r: 0.14,
    }),
    lowpass(noiseBurst({ dur: 0.16, vol: 0.16, color: 'pink' }), 900),
  ),

  // --- Tetris ---
  tet_rotate: tone({
    dur: 0.04,
    freq: 760,
    type: 'warm',
    vol: 0.2,
    a: 0.002,
    d: 0.02,
    s: 0.2,
    r: 0.02,
  }),
  tet_lock: mix(
    thud({ dur: 0.07, freq: 150, vol: 0.3 }),
    tone({ dur: 0.05, freq: 320, type: 'triangle', vol: 0.12, r: 0.03 }),
  ),
  tet_clear: fanfare([480, 720], 0.09, 0.07),
  tet_tetris: fanfare([523, 659, 784, 1046], 0.09, 0.08),
  tet_over: mix(
    tone({
      dur: 0.45,
      freq: 300,
      freqEnd: 75,
      type: 'softsaw',
      vol: 0.28,
      a: 0.012,
      d: 0.12,
      s: 0.35,
      r: 0.18,
    }),
    lowpass(noiseBurst({ dur: 0.2, vol: 0.12, color: 'brown' }), 600),
  ),

  // --- 2048 ---
  t48_move: tone({
    dur: 0.035,
    freq: 420,
    type: 'sine',
    vol: 0.16,
    a: 0.002,
    d: 0.015,
    s: 0.15,
    r: 0.018,
  }),
  t48_merge: sparkle({ dur: 0.12, freq: 560, vol: 0.3 }),
  t48_over: seq([
    [
      0,
      tone({
        dur: 0.14,
        freq: 300,
        type: 'triangle',
        vol: 0.26,
        a: 0.008,
        r: 0.08,
      }),
    ],
    [
      0.13,
      tone({
        dur: 0.22,
        freq: 200,
        freqEnd: 95,
        type: 'triangle',
        vol: 0.26,
        a: 0.008,
        r: 0.1,
      }),
    ],
  ]),

  // --- Invaders ---
  inv_shoot: chirpDown({ dur: 0.06, freq: 980, freqEnd: 420, vol: 0.24 }),
  inv_hit: mix(
    tone({
      dur: 0.08,
      freq: 540,
      freqEnd: 820,
      type: 'warm',
      vol: 0.28,
      a: 0.002,
      r: 0.04,
    }),
    highpass(noiseBurst({ dur: 0.04, vol: 0.1, color: 'white' }), 0.96),
  ),
  inv_die: mix(
    tone({
      dur: 0.28,
      freq: 260,
      freqEnd: 70,
      type: 'softsaw',
      vol: 0.28,
      a: 0.008,
      d: 0.08,
      s: 0.3,
      r: 0.12,
    }),
    lowpass(noiseBurst({ dur: 0.14, vol: 0.16, color: 'pink' }), 1100),
  ),
  inv_wave: fanfare([392, 523, 659], 0.1, 0.09),
  inv_bomb: mix(
    thud({ dur: 0.1, freq: 120, vol: 0.28 }),
    lowpass(noiseBurst({ dur: 0.08, vol: 0.18, color: 'brown' }), 700),
  ),

  // --- Asteroids ---
  ast_thrust: lowpass(
    mix(
      tone({
        dur: 0.09,
        freq: 70,
        type: 'softsaw',
        vol: 0.14,
        noise: 0.35,
        a: 0.01,
        r: 0.05,
      }),
      noiseBurst({ dur: 0.09, vol: 0.12, color: 'brown', filterHz: 400 }),
    ),
    500,
  ),
  ast_shoot: chirpDown({ dur: 0.055, freq: 1100, freqEnd: 480, vol: 0.24 }),
  ast_bang: mix(
    highpass(noiseBurst({ dur: 0.14, vol: 0.36, color: 'pink', filterHz: 5000 }), 0.93),
    tone({
      dur: 0.12,
      freq: 150,
      freqEnd: 55,
      type: 'softsaw',
      vol: 0.22,
      a: 0.004,
      r: 0.08,
    }),
  ),
  ast_split: mix(
    highpass(noiseBurst({ dur: 0.09, vol: 0.26, color: 'white', filterHz: 6000 }), 0.95),
    tone({
      dur: 0.08,
      freq: 320,
      freqEnd: 180,
      type: 'triangle',
      vol: 0.18,
      a: 0.002,
      r: 0.05,
    }),
  ),
  ast_die: mix(
    tone({
      dur: 0.4,
      freq: 200,
      freqEnd: 50,
      type: 'softsaw',
      vol: 0.28,
      a: 0.012,
      d: 0.12,
      s: 0.35,
      r: 0.16,
    }),
    lowpass(noiseBurst({ dur: 0.22, vol: 0.18, color: 'pink' }), 900),
  ),
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = path.join(outDir, `${name}.wav`);
  writeWav(file, samples);
  console.log('wrote', path.basename(file), `${(samples.length / SR * 1000).toFixed(0)}ms`);
}
console.log('done', Object.keys(sounds).length, 'files @', SR, 'Hz');
