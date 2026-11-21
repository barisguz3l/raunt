// Yapay zekâ ile üretilmiş koç seslerini (MP3) uygulamaya alır.
//   node scripts/import-voice.mjs <mp3-klasörü> [ses-açıklaması]
// Dosya adları ifade kimliği olmalı (ör. sol-krose.mp3; bkz. phraseId). Eksik ifade varsa hata verir.
// Çıktı: public/voice/<id>.wav (24 kHz mono, kırpılmış, seviyesi eşitlenmiş) + src/core/speech/voiceManifest.json

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allPhrases } from '../src/core/speech/vocabulary.ts'
import { phraseId } from '../src/core/speech/pronounce.ts'
import { polish, readWav, resample, writeWav } from './voice-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [, , srcArg, voiceLabel = 'Yapay zekâ sesi'] = process.argv
if (!srcArg) throw new Error('Kullanım: node scripts/import-voice.mjs <mp3-klasörü> [ses-açıklaması]')
const srcDir = resolve(srcArg)
const RATE = 24000
const outDir = join(root, 'public', 'voice')
const manifestPath = join(root, 'src', 'core', 'speech', 'voiceManifest.json')

const moves = JSON.parse(readFileSync(join(root, 'seed', 'moves.json'), 'utf8')).moves
const phrases = allPhrases(moves)
const missing = phrases.filter((p) => !existsSync(join(srcDir, `${phraseId(p)}.mp3`)))
if (missing.length) throw new Error(`Eksik klip: ${missing.join(', ')}`)

const tmp = mkdtempSync(join(tmpdir(), 'raunt-import-'))
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'mp3-to-wav.ps1'), '-InDir', srcDir, '-OutDir', tmp], {
  stdio: 'inherit',
})

mkdirSync(outDir, { recursive: true })
const clips = {}
const keep = new Set()
let bytes = 0
for (const p of phrases) {
  const id = phraseId(p)
  const { rate, samples } = readWav(readFileSync(join(tmp, `${id}.wav`)))
  const out = polish(resample(samples, rate, RATE), RATE)
  const wav = writeWav(out, RATE)
  writeFileSync(join(outDir, `${id}.wav`), wav)
  keep.add(`${id}.wav`)
  clips[p] = { id, ms: Math.round((out.length / RATE) * 1000) }
  bytes += wav.length
}
for (const f of readdirSync(outDir)) if (f.endsWith('.wav') && !keep.has(f)) unlinkSync(join(outDir, f))
rmSync(tmp, { recursive: true, force: true })
writeFileSync(manifestPath, JSON.stringify({ voice: voiceLabel, sampleRate: RATE, clips }, null, 2) + '\n', 'utf8')
console.log(`${phrases.length} klip, ${(bytes / 1024 / 1024).toFixed(2)} MB → public/voice/ (${voiceLabel})`)
