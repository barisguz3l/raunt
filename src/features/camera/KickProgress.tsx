import { useEffect, useState } from 'react'
import { kickLevel } from '../../core/vision/matching'
import { tr } from '../../i18n/tr'
import { loadVisionHistory, visionHistory } from './visionStore'

/** İlerleme: kameranın ölçtüğü en yüksek tekme (seans seans). Esneklik hedefi için. */
export function KickProgress() {
  const [items, setItems] = useState(visionHistory())
  useEffect(() => {
    void loadVisionHistory().then(() => setItems(visionHistory()))
  }, [])
  const kicks = items.filter((h) => h.stats.kicks > 0).slice(-10)
  if (!kicks.length) return null
  const max = Math.max(1.5, ...kicks.map((k) => k.stats.maxKickHeight))
  const v = tr.vision
  return (
    <>
      <h2 className="section-title">{v.kickTitle}</h2>
      <div className="card">
        <div className="bars" role="img" aria-label={v.kickTitle}>
          {kicks.map((k) => (
            <div key={k.date} className="bar">
              <div className="bar-fill" style={{ height: `${(k.stats.maxKickHeight / max) * 100}%` }} />
              <small>{new Date(k.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</small>
            </div>
          ))}
        </div>
        <p className="card-muted" style={{ marginBottom: 0 }}>
          {v.kickNow(v.kickLevels[kickLevel(kicks[kicks.length - 1].stats.maxKickHeight)])}
        </p>
      </div>
    </>
  )
}
