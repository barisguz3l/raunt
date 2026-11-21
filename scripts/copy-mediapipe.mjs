// MediaPipe wasm dosyalarını node_modules'tan public/mediapipe'a kopyalar (depoya girmez, .gitignore).
// npm run dev / build öncesinde otomatik çalışır.
import { cpSync, existsSync, mkdirSync } from 'node:fs'

const src = 'node_modules/@mediapipe/tasks-vision/wasm'
const dst = 'public/mediapipe'
if (!existsSync(src)) {
  console.warn('MediaPipe wasm bulunamadı; önce npm install çalıştır.')
  process.exit(0)
}
mkdirSync(dst, { recursive: true })
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) cpSync(`${src}/${f}`, `${dst}/${f}`)
console.log('MediaPipe wasm kopyalandı.')
