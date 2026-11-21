import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Üretim derlemesinde dist/sw.js üretir: tüm derleme çıktıları + public/ dosyaları önbelleğe alınır.
 * Önbellek adı içerik özetinden türetilir; her yeni sürüm eski önbelleği temizler.
 */
export function serviceWorkerPlugin(): Plugin {
  let publicDir = ''
  return {
    name: 'raunt-sw',
    apply: 'build',
    configResolved(cfg) {
      publicDir = cfg.publicDir
    },
    generateBundle(_opts, bundle) {
      const files = new Set<string>(['./', './index.html'])
      for (const f of Object.keys(bundle)) files.add(`./${f}`)
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name)
          if (statSync(p).isDirectory()) walk(p)
          else {
            const rel = relative(publicDir, p).split('\\').join('/')
            // Yapay zekâ dosyaları (~20 MB) önbelleğe baştan alınmaz; ayna ilk açılınca alınır (sw-template)
            if (!rel.startsWith('mediapipe/') && !rel.startsWith('models/')) files.add('./' + rel)
          }
        }
      }
      try {
        walk(publicDir)
      } catch {
        /* public/ yoksa sorun değil */
      }
      const list = [...files].sort()
      const hash = createHash('sha256')
      for (const f of Object.values(bundle)) hash.update('code' in f ? f.code : String(f.source))
      hash.update(list.join('|'))
      // Zaman öneki: önbellek adları sıralanabilir (en yeni önceki sürüm saklanır)
      const version = `${Date.now().toString(36)}-${hash.digest('hex').slice(0, 12)}`

      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8')
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(list, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}
