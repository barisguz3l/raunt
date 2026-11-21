import { useEffect, useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { systemSpeechAvailable, turkishVoice, voice } from '../../core/audio/voiceService'
import { getContentStore } from '../../core/content/contentStore'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { comboPhrases } from '../../core/speech/stanceMapper'
import { BigButton } from '../../design/BigButton'
import { ChoiceGroup } from '../../design/ChoiceGroup'
import { Toggle } from '../../design/Toggle'
import { tr } from '../../i18n/tr'

const t = tr.profile

/** Dokunuşta: motoru aç, klipleri yükle, örnek kombo söylet ("1-2-3-LKR", mevcut duruş ve isim moduyla). */
async function sample() {
  const s = settingsStore.get()
  const store = getContentStore()
  const combo = store.content.combos.find((c) => c.code === '1-2-3-LKR') ?? store.content.combos[0]
  const phrases = comboPhrases(store.comboMoves(combo), s.stance, 'names', s.nameStyle)
  await audio.unlock()
  await voice.preload(phrases)
  voice.speak(phrases)
}

export function ProfileSettings() {
  const s = useSettings()
  const [sysVoice, setSysVoice] = useState<string | null>(null)

  useEffect(() => {
    if (!systemSpeechAvailable()) return
    const update = () => setSysVoice(turkishVoice()?.name ?? null)
    update()
    speechSynthesis.addEventListener?.('voiceschanged', update)
    return () => speechSynthesis.removeEventListener?.('voiceschanged', update)
  }, [])

  return (
    <>
      <h2 className="section-title">{t.title}</h2>
      <div className="card setting-group">
        <ChoiceGroup
          label={t.stance}
          value={s.stance}
          onChange={(v) => void settingsStore.update({ stance: v })}
          options={[
            { value: 'orthodox', label: t.orthodox, hint: t.orthodoxHint },
            { value: 'southpaw', label: t.southpaw, hint: t.southpawHint },
          ]}
        />
        <ChoiceGroup
          label={t.nameStyle}
          layout="row"
          value={s.nameStyle}
          onChange={(v) => void settingsStore.update({ nameStyle: v })}
          options={[
            { value: 'leftRight', label: t.leftRight, hint: t.leftRightHint },
            { value: 'frontRear', label: t.frontRear, hint: t.frontRearHint },
          ]}
        />
        <Toggle label={t.coachApproved} hint={tr.safety.kickLock} checked={s.coachApproved} onChange={(v) => void settingsStore.update({ coachApproved: v })} />
      </div>

      <div className="card setting-group" style={{ marginTop: 12 }}>
        <ChoiceGroup
          label={t.voiceSource}
          value={s.voiceSource}
          onChange={(v) => void settingsStore.update({ voiceSource: v })}
          options={[
            { value: 'clips', label: t.clips, hint: t.clipsHint },
            { value: 'system', label: t.system, hint: t.systemHint },
          ]}
        />
        {s.voiceSource === 'system' &&
          (sysVoice ? <p className="card-muted">{t.systemVoice(sysVoice)}</p> : <p className="notice">{tr.coach.voiceMissing}</p>)}
        <BigButton variant="neutral" onClick={() => void sample()}>
          {t.sample}
        </BigButton>
      </div>
    </>
  )
}
