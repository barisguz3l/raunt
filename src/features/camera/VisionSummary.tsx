import { fatiguePct, kickLevel, type VisionStats } from '../../core/vision/matching'
import { tr } from '../../i18n/tr'

const v = tr.vision

/** Antrenman sonu: yapay zekânın gördükleri. Dil "algılandı" — kamera her şeyi göremez. */
export function VisionSummary({ stats, ghost }: { stats: VisionStats; ghost?: { dodged: number; caught: number } }) {
  if (stats.punches + stats.kicks + stats.calls === 0) return null
  const fat = fatiguePct(stats.roundSpeed)
  const total = stats.bySide.left + stats.bySide.right
  const rows: [string, string][] = []
  if (stats.calls) rows.push([v.sumCombos, v.sumCombosVal(stats.completed, stats.calls)])
  rows.push([v.sumPunches, String(stats.punches)])
  if (total) rows.push([v.sumSides, v.sumSidesVal(Math.round((stats.bySide.left / total) * 100), Math.round((stats.bySide.right / total) * 100))])
  if (stats.returnSecAvg != null) rows.push([v.sumReturn, `${stats.returnSecAvg.toFixed(2).replace('.', ',')} sn`])
  if (fat != null) rows.push([v.sumFatigue, v.sumFatigueVal(fat)])
  rows.push([v.sumGuard, String(stats.guardDrops)])
  if (stats.chinUps) rows.push([v.sumChin, String(stats.chinUps)])
  if (stats.kicks) rows.push([v.sumKick, v.kickLevels[kickLevel(stats.maxKickHeight)]])
  if (stats.slips + stats.blocks) rows.push([v.sumDefense, v.sumDefenseVal(stats.slips, stats.blocks)])
  if (ghost && ghost.dodged + ghost.caught > 0) rows.push([v.sumGhost, v.sumGhostVal(ghost.dodged, ghost.caught)])

  return (
    <section className="vision-summary" aria-label={v.sumTitle}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        {v.sumTitle}
      </h2>
      <dl>
        {rows.map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <p className="card-muted" style={{ margin: '8px 0 0' }}>
        {v.sumNote}
      </p>
    </section>
  )
}
