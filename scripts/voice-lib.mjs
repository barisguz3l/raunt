// Ses klibi işleme yardımcıları (bağımlılıksız): WAV okuma/yazma, tek kanal, yeniden örnekleme,
// sessizlik kırpma, ses seviyesi eşitleme. Hem Tolga hem yapay zekâ sesi betikleri kullanır.

/** PCM16 WAV → { rate, samples: Float32Array (tek kanal) } */
export function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('WAV değil')
  let off = 12
  let fmt = null
  let data = null
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) }
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size)
    off += 8 + size + (size % 2)
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('Beklenmeyen WAV biçimi')
  const frames = Math.floor(data.length / 2 / fmt.channels)
  const samples = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let s = 0
    for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((i * fmt.channels + c) * 2)
    samples[i] = s / fmt.channels / 32768
  }
  return { rate: fmt.rate, samples }
}

/** Basit alçak geçiren + doğrusal ara değerle yeniden örnekleme (konuşma için yeterli). */
export function resample(samples, from, to) {
  if (from === to) return samples
  let src = samples
  if (to < from) {
    // Örtüşmeyi azaltmak için kısa ortalama filtresi
    const k = Math.max(1, Math.round(from / to))
    src = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      let s = 0
      let n = 0
      for (let j = i - (k >> 1); j <= i + (k >> 1); j++) if (j >= 0 && j < samples.length) (s += samples[j]), n++
      src[i] = s / n
    }
  }
  const out = new Float32Array(Math.floor((src.length * to) / from))
  for (let i = 0; i < out.length; i++) {
    const x = (i * from) / to
    const a = Math.floor(x)
    const f = x - a
    out[i] = (src[a] ?? 0) * (1 - f) + (src[a + 1] ?? src[a] ?? 0) * f
  }
  return out
}

/** Sessizliği kırp, RMS'yi eşitle (tepe ≤ 0,95), kenarlara kısa yumuşatma uygula. */
/**
 * Konuşma sınırları: 10 ms pencerelerin enerjisine bakar. Uzun sessizlikle (≥ 200 ms) ayrılmış,
 * kısa (< 120 ms) baş/son parçalar çıtırtı/nefes sayılıp atılır.
 */
export function speechBounds(samples, rate) {
  const win = Math.round(rate * 0.01)
  const env = []
  for (let s = 0; s < samples.length; s += win) {
    let sq = 0
    const e = Math.min(samples.length, s + win)
    for (let i = s; i < e; i++) sq += samples[i] * samples[i]
    env.push(Math.sqrt(sq / (e - s)))
  }
  const peak = Math.max(...env, 1e-6)
  const on = env.map((e) => e > peak * 0.06)
  // Konuşma parçaları [başlangıç, bitiş) pencere indeksiyle
  const segs = []
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue
    let j = i
    while (j < on.length && on[j]) j++
    const last = segs[segs.length - 1]
    if (last && i - last[1] < 6) last[1] = j // < 60 ms boşluk: aynı parça
    else segs.push([i, j])
    i = j
  }
  if (!segs.length) return [0, samples.length - 1]
  const isBlip = (s) => s[1] - s[0] < 12
  while (segs.length > 1 && isBlip(segs[segs.length - 1]) && segs[segs.length - 1][0] - segs[segs.length - 2][1] >= 20) segs.pop()
  while (segs.length > 1 && isBlip(segs[0]) && segs[1][0] - segs[0][1] >= 20) segs.shift()
  return [segs[0][0] * win, Math.min(samples.length - 1, segs[segs.length - 1][1] * win)]
}

export function polish(samples, rate, { targetRms = 0.14, headSec = 0.03, tailSec = 0.06 } = {}) {
  let [a, b] = speechBounds(samples, rate)
  a = Math.max(0, a - Math.round(rate * headSec))
  b = Math.min(samples.length - 1, b + Math.round(rate * tailSec))
  const out = samples.slice(a, b + 1)
  let sq = 0
  let pk = 0
  for (const v of out) {
    sq += v * v
    pk = Math.max(pk, Math.abs(v))
  }
  const rms = Math.sqrt(sq / out.length) || 1e-6
  const gain = Math.min(targetRms / rms, 0.95 / (pk || 1e-6))
  for (let i = 0; i < out.length; i++) out[i] *= gain
  const fade = Math.round(rate * 0.006)
  for (let i = 0; i < Math.min(fade, out.length); i++) {
    out[i] *= i / fade
    out[out.length - 1 - i] *= i / fade
  }
  return out
}

export function writeWav(samples, rate) {
  const pcm = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + pcm.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}
