import { useEffect, useState, type ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { IconLibrary, IconProgress, IconSettings, IconToday, IconTrain } from '../design/icons'
import { TodayScreen } from '../features/today/TodayScreen'
import { TrainScreen } from '../features/train/TrainScreen'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { ActiveWorkoutScreen } from '../features/activeWorkout/ActiveWorkoutScreen'
import { audio } from '../core/audio/audioService'
import { saveLastConfig } from '../core/engine/presets'
import type { WorkoutPlan } from '../features/activeWorkout/plan'
import { parseShare } from '../features/combos/userCombos'
import { setUpdateBusy } from './registerSW'
import { Onboarding } from '../features/onboarding/Onboarding'
import { settingsStore, useSettings } from '../core/settings/settings'

export type TabId = 'bugun' | 'antrenman' | 'kutuphane' | 'ilerleme' | 'ayarlar'

const tabs: { id: TabId; label: string; icon: () => ReactNode }[] = [
  { id: 'bugun', label: tr.tabs.today, icon: IconToday },
  { id: 'antrenman', label: tr.tabs.train, icon: IconTrain },
  { id: 'kutuphane', label: tr.tabs.library, icon: IconLibrary },
  { id: 'ilerleme', label: tr.tabs.progress, icon: IconProgress },
  { id: 'ayarlar', label: tr.tabs.settings, icon: IconSettings },
]

function tabFromHash(): TabId {
  const h = window.location.hash.replace(/^#\/?/, '')
  return tabs.find((t) => t.id === h)?.id ?? 'bugun'
}

interface ActiveRun {
  plan: WorkoutPlan
  key: number
  audioOk: boolean
}

export function App() {
  // Paylaşılan kombo bağlantısı (#/kombo/...) → Kütüphane'de editör dolu açılır
  const [shared] = useState(() => {
    const p = parseShare(window.location.hash)
    // Yenilemede editör aynı kombo ile tekrar açılmasın
    if (p) history.replaceState(null, '', '#/kutuphane')
    return p
  })
  const [tab, setTab] = useState<TabId>(() => (shared ? 'kutuphane' : tabFromHash()))
  const [run, setRun] = useState<ActiveRun | null>(null)
  // Yeni sürüm antrenman ortasında sayfayı yenilemesin
  useEffect(() => {
    setUpdateBusy(!!run)
  }, [run])
  const settings = useSettings()
  // Karşılama (sağlık notu onayı dahil) paylaşım bağlantısıyla gelende de önce gösterilir
  const loaded = settingsStore.loaded()
  const needsOnboarding = loaded && !settings.onboardingDone

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (id: TabId) => {
    if (id !== tab) window.location.hash = `/${id}`
    setTab(id)
    window.scrollTo(0, 0)
  }

  /** Dokunuşun içinde çağrılır: ses motoru yalnızca kullanıcı hareketiyle açılır (iOS). Sonra ses saati sınanır. */
  const checkAudio = () => {
    const unlocking = audio.unlock()
    void unlocking
      .then((ok) => (ok ? audio.selfTest() : false))
      .then((ok) => setRun((r) => (r ? { ...r, audioOk: ok } : r)))
  }

  const startWorkout = (plan: WorkoutPlan) => {
    checkAudio()
    if (plan.kind === 'timer') void saveLastConfig(plan.config)
    // Tekrar: aynı ayar, yeni rastgele sıra
    const fresh = plan.coach ? { ...plan, coach: { ...plan.coach, seed: Math.floor(Math.random() * 2 ** 31) } } : plan
    setRun({ plan: fresh, key: Date.now(), audioOk: true })
  }

  const screen = (() => {
    switch (tab) {
      case 'bugun':
        return <TodayScreen onStart={startWorkout} onNavigate={select} />
      case 'antrenman':
        return <TrainScreen onStart={startWorkout} />
      case 'kutuphane':
        return <LibraryScreen shared={shared} onStart={startWorkout} />
      case 'ilerleme':
        return <ProgressScreen />
      case 'ayarlar':
        return <SettingsScreen />
    }
  })()

  if (!loaded) return <div className="app-shell" aria-busy="true" />
  if (needsOnboarding) return <Onboarding />

  return (
    <div className="app-shell">
      <main hidden={!!run}>{screen}</main>
      {!run && (
        <nav className="tabbar" aria-label="Ana menü">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-current={t.id === tab ? 'page' : undefined} onClick={() => select(t.id)}>
              {t.icon()}
              {t.label}
            </button>
          ))}
        </nav>
      )}
      {run && (
        <ActiveWorkoutScreen
          key={run.key}
          plan={run.plan}
          audioOk={run.audioOk}
          onRetryAudio={checkAudio}
          onClose={() => setRun(null)}
          onRestart={() => startWorkout(run.plan)}
        />
      )}
    </div>
  )
}
