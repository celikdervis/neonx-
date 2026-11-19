// Deterministic WAV fixtures for Chromium's fake microphone
// (--use-file-for-fake-audio-capture) and a decoder for the data: URLs that
// RE:VERSE writes to the room, so tests can check what the other player receives.
import fs from 'node:fs';
import path from 'node:path';

function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

/** Writes the fixtures once and returns their paths. */
export function audioFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const rate = 48000;
  // 1.5 s rising chirp 300 → 1500 Hz (then the fake device loops it). Reversed it falls.
  const n = Math.round(1.5 * rate), chirp = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) { const f = 300 + 1200 * (i / n); phase += 2 * Math.PI * f / rate; chirp[i] = 0.6 * Math.sin(phase); }
  const silence = new Float32Array(rate * 2);
  const files = { chirp: path.join(dir, 'chirp-rising.wav'), silence: path.join(dir, 'silence.wav') };
  if (!fs.existsSync(files.chirp)) fs.writeFileSync(files.chirp, wav(chirp, rate));
  if (!fs.existsSync(files.silence)) fs.writeFileSync(files.silence, wav(silence, rate));
  return files;
}

/** Decodes a data:audio/wav;base64 URL (16-bit PCM mono) into stats. */
export function inspectWavDataUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('data:audio/wav;base64,')) return { ok: false, reason: 'not a WAV data URL', head: String(url).slice(0, 40) };
  const b = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  const rate = b.readUInt32LE(24), bits = b.readUInt16LE(34), channels = b.readUInt16LE(22);
  let p = 12, off = -1, size = 0;
  while (p + 8 <= b.length) { const id = b.toString('ascii', p, p + 4), len = b.readUInt32LE(p + 4); if (id === 'data') { off = p + 8; size = len; break; } p += 8 + len + (len & 1); }
  const count = Math.floor(size / 2), s = new Float32Array(count);
  for (let i = 0; i < count; i++) s[i] = b.readInt16LE(off + i * 2) / 32768;
  let peak = 0, sum = 0;
  for (const x of s) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
  // Zero-crossing rate per window → frequency trend (falling for a reversed rising chirp).
  const win = Math.round(rate * 0.1), zcr = [];
  for (let w = 0; w + win <= count; w += win) { let z = 0; for (let i = w + 1; i < w + win; i++) if ((s[i - 1] < 0) !== (s[i] < 0)) z++; const e = s.slice(w, w + win).reduce((a, x) => a + x * x, 0) / win; if (e > 1e-4) zcr.push(z); }
  let falls = 0, rises = 0;
  for (let i = 1; i < zcr.length; i++) { if (zcr[i] < zcr[i - 1]) falls++; else if (zcr[i] > zcr[i - 1]) rises++; }
  return { ok: true, rate, bits, channels, seconds: +(count / rate).toFixed(2), bytes: b.length, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, count)).toFixed(4), falls, rises };
}
