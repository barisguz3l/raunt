import { useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import { forceUpdate } from '../../app/registerSW'
import { BigButton } from '../../design/BigButton'
import { SoundSettings } from './SoundSettings'
import { ProfileSettings } from './ProfileSettings'
import { PersonalSettings } from './PersonalSettings'
import { DataSettings } from './DataSettings'

export function SettingsScreen() {
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false))
  }, [])

  return (
    <section className="screen" aria-labelledby="settings-title">
      <h1 id="settings-title" className="screen-title">
        {tr.settings.title}
      </h1>

      <PersonalSettings />
      <ProfileSettings />
      <SoundSettings />
      <DataSettings />

      <h2 className="section-title">{tr.settings.storage}</h2>
      <div className="card card-muted">
        {persisted == null ? tr.common.loading : persisted ? tr.settings.storagePersisted : tr.settings.storageNotPersisted}
      </div>

      <h2 className="section-title">{tr.settings.safetyTitle}</h2>
      <div className="card setting-group">
        <p className="notice" style={{ margin: 0 }}>
          {tr.safety.healthNote}
        </p>
        <p className="notice" style={{ margin: 0 }}>
          {tr.safety.concussion}
        </p>
        <p className="notice" style={{ margin: 0 }}>
          {tr.safety.backPain}
        </p>
      </div>

      <h2 className="section-title">{tr.settings.about}</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <strong>{tr.app.name}</strong>, {tr.settings.version.toLocaleLowerCase('tr')} {__APP_VERSION__} ({tr.settings.built(new Date(__BUILD_TIME__))})
        </p>
        <UpdateButton />
        <p className="card-muted">{tr.settings.offline}</p>
        <p className="card-muted">{tr.settings.educationNote}</p>
      </div>
    </section>
  )
}

function UpdateButton() {
  const [busy, setBusy] = useState(false)
  return (
    <>
      <BigButton
        variant="neutral"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void forceUpdate()
        }}
      >
        {busy ? tr.settings.updating : tr.settings.update}
      </BigButton>
      <p className="card-muted" style={{ margin: '6px 0 12px' }}>
        {tr.settings.updateHint}
      </p>
    </>
  )
}
