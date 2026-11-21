// Kilit ekranı / kulaklık düğmeleri (spec F-216: oynat/duraklat = duraklat/devam, ileri = atla).
// iOS web'de bu kontroller yalnızca sayfa medya çalarken görünür; desteklenmezse sessizce hiçbir şey yapmaz.

import type { Snapshot } from '../engine/workoutEngine'
import { phaseStyle } from '../../design/tokens'
import { formatClock } from '../engine/timeline'

export class MediaControls {
  private ms: MediaSession | null = typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null
  private lastTitle = ''

  constructor(actions: { toggle(): void; skip(): void }) {
    if (!this.ms) return
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        this.ms!.setActionHandler(a, h)
      } catch {
        /* desteklenmeyen eylem */
      }
    }
    set('play', () => actions.toggle())
    set('pause', () => actions.toggle())
    set('nexttrack', () => actions.skip())
  }

  update(s: Snapshot) {
    if (!this.ms) return
    const phase = phaseStyle[s.status === 'done' ? 'done' : s.phase].label
    const title = `${phase} · Raunt ${Math.min(s.round, s.totalRounds)}/${s.totalRounds}`
    // Kalan süre sanatçı alanında; meta veri yalnızca görünen metin değişince (≈ saniyede bir) yenilenir
    const artist = `Kalan ${formatClock(s.remaining)}`
    try {
      if (title + artist !== this.lastTitle) {
        this.ms.metadata = new MediaMetadata({ title, artist, album: 'Raunt' })
        this.lastTitle = title + artist
      }
      this.ms.playbackState = s.status === 'running' ? 'playing' : s.status === 'paused' ? 'paused' : 'none'
    } catch {
      /* MediaMetadata yok */
    }
  }

  clear() {
    if (!this.ms) return
    try {
      this.ms.metadata = null
      this.ms.playbackState = 'none'
      for (const a of ['play', 'pause', 'nexttrack'] as MediaSessionAction[]) this.ms.setActionHandler(a, null)
    } catch {
      /* yut */
    }
  }
}
