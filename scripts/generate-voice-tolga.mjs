// Türkçe koç ses paketini üretir (yalnızca Windows'ta, Microsoft Tolga sesiyle).
//   node scripts/generate-voice-tolga.mjs   (YEDEK: varsayılan ses artık yapay zekâ sesi, bkz. import-voice.mjs)
// Çıktı: public/voice/<id>.wav (16 kHz mono, sessizlik kırpılmış) + src/core/speech/voiceManifest.json
// Kelime listesi uygulamayla aynı kaynaktan gelir (src/core/speech/vocabulary.ts).

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allPhrases } from '../src/core/speech/vocabulary.ts'
import { phraseId, toSpeakText } from '../src/core/speech/pronounce.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RATE = 0.95
const outDir = join(root, 'public', 'voice')
const manifestPath = join(root, 'src', 'core', 'speech', 'voiceManifest.json')

const moves = JSON.parse(readFileSync(join(root, 'seed', 'moves.json'), 'utf8')).moves
const phrases = allPhrases(moves)
console.log(`${phrases.length} ifade üretilecek…`)

const tmp = mkdtempSync(join(tmpdir(), 'raunt-voice-'))
const list = join(tmp, 'list.tsv')
writeFileSync(list, phrases.map((p) => `${phraseId(p)}\t${toSpeakText(p)}`).join('\n') + '\n', 'utf8')
execFileSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'tts-tolga.ps1'), '-ListFile', list, '-OutDir', join(tmp, 'raw'), '-Rate', String(RATE)],
  { stdio: 'inherit' },
)

/** WAV (PCM16 mono) başındaki/sonundaki sessizliği kırpar. */
function trimWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('WAV değil')
  // "data" bölümünü bul
  let off = 12
  let fmt = null
  let data = null
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) }
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size)
    off += 8 + size + (size % 2)
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.channels !== 1) throw new Error('Beklenmeyen WAV biçimi')
  const n = data.length / 2
  // Eşik, en yüksek tepeye göre (kısık kliplerde de kelime başı kesilmesin)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data.readInt16LE(i * 2)))
  const thr = Math.max(40, peak * 0.03)
  let a = 0
  while (a < n && Math.abs(data.readInt16LE(a * 2)) < thr) a++
  let b = n - 1
  while (b > a && Math.abs(data.readInt16LE(b * 2)) < thr) b--
  a = Math.max(0, a - Math.round(fmt.rate * 0.03))
  b = Math.min(n - 1, b + Math.round(fmt.rate * 0.08))
  const pcm = Buffer.from(data.subarray(a * 2, (b + 1) * 2))
  // Ses seviyesini eşitle: RMS hedefi, tepe 0,95'i geçmesin (kısa kelimeler artık kısık değil)
  {
    const len0 = pcm.length / 2
    let sq = 0
    let pk = 0
    for (let i = 0; i < len0; i++) {
      const v = pcm.readInt16LE(i * 2) / 32768
      sq += v * v
      pk = Math.max(pk, Math.abs(v))
    }
    const rms = Math.sqrt(sq / len0) || 1e-6
    const gain = Math.min(0.14 / rms, 0.95 / (pk || 1e-6))
    for (let i = 0; i < len0; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.readInt16LE(i * 2) * gain))), i * 2)
  }
  // Kısa yumuşak giriş/çıkış (tık sesi olmasın)
  const fade = Math.round(fmt.rate * 0.006)
  const len = pcm.length / 2
  for (let i = 0; i < Math.min(fade, len); i++) {
    pcm.writeInt16LE(Math.round((pcm.readInt16LE(i * 2) * i) / fade), i * 2)
    const j = len - 1 - i
    pcm.writeInt16LE(Math.round((pcm.readInt16LE(j * 2) * i) / fade), j * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(fmt.rate, 24)
  header.writeUInt32LE(fmt.rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return { wav: Buffer.concat([header, pcm]), ms: Math.round((len / fmt.rate) * 1000) }
}

mkdirSync(outDir, { recursive: true })
const keep = new Set()
const clips = {}
let bytes = 0
for (const p of phrases) {
  const id = phraseId(p)
  const { wav, ms } = trimWav(readFileSync(join(tmp, 'raw', `${id}.wav`)))
  writeFileSync(join(outDir, `${id}.wav`), wav)
  keep.add(`${id}.wav`)
  clips[p] = { id, ms }
  bytes += wav.length
}
for (const f of readdirSync(outDir)) if (f.endsWith('.wav') && !keep.has(f)) unlinkSync(join(outDir, f))
rmSync(tmp, { recursive: true, force: true })

writeFileSync(
  manifestPath,
  JSON.stringify({ voice: 'Microsoft Tolga (tr-TR)', rate: RATE, sampleRate: 16000, clips }, null, 2) + '\n',
  'utf8',
)
console.log(`${phrases.length} klip, toplam ${(bytes / 1024 / 1024).toFixed(2)} MB → public/voice/`)
