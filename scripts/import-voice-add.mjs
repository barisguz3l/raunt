// Ses paketine YALNIZCA yeni klipleri ekler (mevcutlara dokunmaz).
//   node scripts/import-voice-add.mjs <mp3-klasörü>
// Klasördeki her <id>.mp3, sözlükteki (vocabulary.ts) bir ifadeyle eşleşmeli.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allPhrases } from '../src/core/speech/vocabulary.ts'
import { phraseId } from '../src/core/speech/pronounce.ts'
import { polish, readWav, resample, writeWav } from './voice-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcArg = process.argv[2]
if (!srcArg) throw new Error('Kullanım: node scripts/import-voice-add.mjs <mp3-klasörü>')
const srcDir = resolve(srcArg)
const RATE = 24000
const outDir = join(root, 'public', 'voice')
const manifestPath = join(root, 'src', 'core', 'speech', 'voiceManifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const moves = JSON.parse(readFileSync(join(root, 'seed', 'moves.json'), 'utf8')).moves
const byId = new Map(allPhrases(moves).map((p) => [phraseId(p), p]))
const files = readdirSync(srcDir).filter((f) => f.endsWith('.mp3'))
for (const f of files) if (!byId.has(f.slice(0, -4))) throw new Error(`Sözlükte yok: ${f}`)

const tmp = mkdtempSync(join(tmpdir(), 'raunt-add-'))
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'mp3-to-wav.ps1'), '-InDir', srcDir, '-OutDir', tmp], {
  stdio: 'inherit',
})
for (const f of files) {
  const id = f.slice(0, -4)
  const phrase = byId.get(id)
  const { rate, samples } = readWav(readFileSync(join(tmp, `${id}.wav`)))
  const out = polish(resample(samples, rate, RATE), RATE)
  writeFileSync(join(outDir, `${id}.wav`), writeWav(out, RATE))
  manifest.clips[phrase] = { id, ms: Math.round((out.length / RATE) * 1000) }
  console.log(`+ ${phrase} (${manifest.clips[phrase].ms} ms)`)
}
rmSync(tmp, { recursive: true, force: true })
const sorted = Object.fromEntries(Object.entries(manifest.clips).sort(([a], [b]) => a.localeCompare(b, 'tr')))
writeFileSync(manifestPath, JSON.stringify({ ...manifest, clips: sorted }, null, 2) + '\n', 'utf8')
