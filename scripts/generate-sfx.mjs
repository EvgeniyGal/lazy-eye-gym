/**
 * Procedural short WAV generator for game-tailored SFX.
 * Run: node scripts/generate-sfx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'sfx');
const SR = 22050;

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
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
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

function env(t, a, d, s, r, dur) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((1 - s) * (t - a)) / d;
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}

function tone({
  dur,
  freq,
  freqEnd,
  type = 'square',
  vol = 0.35,
  a = 0.005,
  d = 0.04,
  s = 0.5,
  r = 0.05,
  noise = 0,
}) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const f = freqEnd != null ? freq + (freqEnd - freq) * (t / dur) : freq;
    const phase = (t * f) % 1;
    let wave = 0;
    if (type === 'square') wave = phase < 0.5 ? 1 : -1;
    else if (type === 'triangle') wave = 1 - 4 * Math.abs(phase - 0.5);
    else if (type === 'saw') wave = 2 * phase - 1;
    else wave = Math.sin(2 * Math.PI * phase);
    if (noise > 0) wave = wave * (1 - noise) + (Math.random() * 2 - 1) * noise;
    out[i] = wave * vol * env(t, a, d, s, r, dur);
  }
  return out;
}

function noiseBurst({ dur, vol = 0.4, a = 0.002, r = 0.08, hipass = 0 }) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let w = Math.random() * 2 - 1;
    if (hipass > 0) {
      const filtered = w - prev;
      prev = w;
      w = filtered * hipass;
    }
    const e = t < a ? t / a : Math.max(0, 1 - (t - a) / Math.max(0.001, dur - a));
    out[i] = w * vol * e * e;
  }
  return out;
}

function mix(...parts) {
  let len = 0;
  for (const p of parts) len = Math.max(len, p.length);
  const out = new Float32Array(len);
  for (const p of parts) {
    for (let i = 0; i < p.length; i += 1) out[i] += p[i];
  }
  let peak = 0;
  for (let i = 0; i < len; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.95) {
    const g = 0.95 / peak;
    for (let i = 0; i < len; i += 1) out[i] *= g;
  }
  return out;
}

function seq(gapsAndClips) {
  // [[delaySec, samples], ...]
  let total = 0;
  for (const [delay, clip] of gapsAndClips) {
    total = Math.max(total, Math.floor(delay * SR) + clip.length);
  }
  const out = new Float32Array(total);
  for (const [delay, clip] of gapsAndClips) {
    const off = Math.floor(delay * SR);
    for (let i = 0; i < clip.length; i += 1) out[off + i] += clip[i];
  }
  return out;
}

const sounds = {
  // --- Pong: short blips ---
  pong_paddle: tone({ dur: 0.07, freq: 440, freqEnd: 660, type: 'square', vol: 0.32, r: 0.04 }),
  pong_wall: tone({ dur: 0.05, freq: 220, type: 'triangle', vol: 0.28, r: 0.03 }),
  pong_score: seq([
    [0, tone({ dur: 0.08, freq: 523, type: 'square', vol: 0.3 })],
    [0.08, tone({ dur: 0.1, freq: 784, type: 'square', vol: 0.3 })],
  ]),
  pong_miss: tone({ dur: 0.22, freq: 300, freqEnd: 90, type: 'saw', vol: 0.28, s: 0.3, r: 0.1 }),
  pong_win: seq([
    [0, tone({ dur: 0.09, freq: 523, type: 'square', vol: 0.28 })],
    [0.09, tone({ dur: 0.09, freq: 659, type: 'square', vol: 0.28 })],
    [0.18, tone({ dur: 0.16, freq: 784, type: 'square', vol: 0.32 })],
  ]),
  pong_orb: mix(
    tone({ dur: 0.12, freq: 880, freqEnd: 1320, type: 'sine', vol: 0.25 }),
    tone({ dur: 0.12, freq: 1320, freqEnd: 1760, type: 'sine', vol: 0.15 }),
  ),

  // --- Breaker ---
  brk_hit: mix(
    tone({ dur: 0.05, freq: 180, type: 'triangle', vol: 0.22 }),
    noiseBurst({ dur: 0.04, vol: 0.18, hipass: 0.6 }),
  ),
  brk_break: mix(
    noiseBurst({ dur: 0.1, vol: 0.35, hipass: 0.85 }),
    tone({ dur: 0.08, freq: 420, freqEnd: 160, type: 'square', vol: 0.2 }),
  ),
  brk_power: seq([
    [0, tone({ dur: 0.07, freq: 600, type: 'sine', vol: 0.28 })],
    [0.06, tone({ dur: 0.1, freq: 900, type: 'sine', vol: 0.3 })],
  ]),
  brk_life: tone({ dur: 0.28, freq: 260, freqEnd: 70, type: 'saw', vol: 0.3, s: 0.35, r: 0.12 }),
  brk_stage: seq([
    [0, tone({ dur: 0.08, freq: 392, type: 'square', vol: 0.26 })],
    [0.08, tone({ dur: 0.08, freq: 494, type: 'square', vol: 0.26 })],
    [0.16, tone({ dur: 0.14, freq: 587, type: 'square', vol: 0.3 })],
  ]),

  // --- Snake ---
  snk_eat: tone({ dur: 0.08, freq: 640, freqEnd: 820, type: 'square', vol: 0.28, r: 0.04 }),
  snk_bonus: seq([
    [0, tone({ dur: 0.07, freq: 700, type: 'sine', vol: 0.28 })],
    [0.07, tone({ dur: 0.1, freq: 1050, type: 'sine', vol: 0.3 })],
  ]),
  snk_die: mix(
    tone({ dur: 0.3, freq: 200, freqEnd: 60, type: 'saw', vol: 0.3 }),
    noiseBurst({ dur: 0.15, vol: 0.2 }),
  ),

  // --- Tetris ---
  tet_rotate: tone({ dur: 0.045, freq: 720, type: 'triangle', vol: 0.22, r: 0.025 }),
  tet_lock: tone({ dur: 0.06, freq: 180, type: 'square', vol: 0.26, noise: 0.15, r: 0.03 }),
  tet_clear: seq([
    [0, tone({ dur: 0.07, freq: 480, type: 'square', vol: 0.28 })],
    [0.06, tone({ dur: 0.1, freq: 720, type: 'square', vol: 0.28 })],
  ]),
  tet_tetris: seq([
    [0, tone({ dur: 0.07, freq: 523, type: 'square', vol: 0.28 })],
    [0.07, tone({ dur: 0.07, freq: 659, type: 'square', vol: 0.28 })],
    [0.14, tone({ dur: 0.07, freq: 784, type: 'square', vol: 0.28 })],
    [0.21, tone({ dur: 0.14, freq: 1046, type: 'square', vol: 0.32 })],
  ]),
  tet_over: tone({ dur: 0.4, freq: 340, freqEnd: 80, type: 'saw', vol: 0.3, s: 0.4, r: 0.15 }),

  // --- 2048 ---
  t48_move: tone({ dur: 0.04, freq: 380, type: 'triangle', vol: 0.18, r: 0.02 }),
  t48_merge: mix(
    tone({ dur: 0.09, freq: 520, freqEnd: 780, type: 'sine', vol: 0.3 }),
    tone({ dur: 0.09, freq: 780, freqEnd: 1040, type: 'sine', vol: 0.12 }),
  ),
  t48_over: seq([
    [0, tone({ dur: 0.12, freq: 300, type: 'triangle', vol: 0.28 })],
    [0.12, tone({ dur: 0.2, freq: 180, freqEnd: 90, type: 'triangle', vol: 0.28 })],
  ]),

  // --- Invaders ---
  inv_shoot: tone({ dur: 0.05, freq: 880, freqEnd: 420, type: 'square', vol: 0.22, r: 0.03 }),
  inv_hit: tone({ dur: 0.07, freq: 520, freqEnd: 780, type: 'triangle', vol: 0.28, r: 0.04 }),
  inv_die: tone({ dur: 0.25, freq: 280, freqEnd: 70, type: 'saw', vol: 0.3, s: 0.35, r: 0.1 }),
  inv_wave: seq([
    [0, tone({ dur: 0.08, freq: 392, type: 'square', vol: 0.26 })],
    [0.08, tone({ dur: 0.08, freq: 523, type: 'square', vol: 0.26 })],
    [0.16, tone({ dur: 0.12, freq: 659, type: 'square', vol: 0.3 })],
  ]),
  inv_bomb: tone({ dur: 0.09, freq: 200, freqEnd: 120, type: 'saw', vol: 0.24, noise: 0.2, r: 0.04 }),

  // --- Asteroids ---
  ast_thrust: tone({ dur: 0.08, freq: 90, type: 'saw', vol: 0.12, noise: 0.55, r: 0.04 }),
  ast_shoot: tone({ dur: 0.05, freq: 1000, freqEnd: 500, type: 'square', vol: 0.22, r: 0.03 }),
  ast_bang: mix(
    noiseBurst({ dur: 0.12, vol: 0.38, hipass: 0.7 }),
    tone({ dur: 0.1, freq: 160, freqEnd: 60, type: 'saw', vol: 0.22 }),
  ),
  ast_split: mix(
    noiseBurst({ dur: 0.08, vol: 0.28, hipass: 0.8 }),
    tone({ dur: 0.07, freq: 300, freqEnd: 180, type: 'triangle', vol: 0.2 }),
  ),
  ast_die: tone({ dur: 0.35, freq: 220, freqEnd: 55, type: 'saw', vol: 0.3, s: 0.4, r: 0.14 }),
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = path.join(outDir, `${name}.wav`);
  writeWav(file, samples);
  console.log('wrote', path.basename(file), samples.length);
}
console.log('done', Object.keys(sounds).length, 'files');
