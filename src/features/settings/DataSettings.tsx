import { useEffect, useRef, useState } from 'react'
import { getRepo, type BackupFile } from '../../core/persistence/db'
import { settingsStore } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { HoldButton } from '../../design/HoldButton'
import { tr } from '../../i18n/tr'
import { saveFile } from '../../core/files'

const t = tr.settings

/** Yedek dosyası (ekran açılınca hazırlanır: iOS'ta paylaşım, dokunuştan hemen sonra çağrılmalı). */
async function buildBackupFile(): Promise<File> {
  const backup = await getRepo().exportAll()
  const json = JSON.stringify(backup, null, 1)
  return new File([json], `raunt-yedek-${backup.exportedAt.slice(0, 10)}.json`, { type: 'application/json' })
}

export function DataSettings() {
  const input = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  useEffect(() => {
    void buildBackupFile().then(setFile).catch(() => setFile(null))
  }, [])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      let backup: BackupFile
      try {
        backup = JSON.parse(await f.text()) as BackupFile
      } catch {
        throw new Error('Dosya okunamadı. Raunt’tan indirdiğin .json yedeğini seç.')
      }
      const n = await getRepo().importAll(backup)
      setMsg(t.importOk(n))
      setTimeout(() => location.reload(), 1200)
    } catch (e) {
      setMsg(t.importErr((e as Error).message))
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <h2 className="section-title">{t.data}</h2>
      <div className="card setting-group">
        <p className="card-muted" style={{ margin: 0 }}>
          {t.exportHint}
        </p>
        <BigButton
          variant="success"
          onClick={async () => {
            try {
              await saveFile(file ?? (await buildBackupFile()))
              setMsg(t.exported)
              void buildBackupFile().then(setFile)
            } catch {
              setMsg(t.exportErr)
            }
          }}
        >
          {t.exportBtn}
        </BigButton>
        <BigButton variant="neutral" onClick={() => input.current?.click()}>
          {t.importBtn}
        </BigButton>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        {msg && (
          <p className="card-muted" role="status" style={{ margin: 0 }}>
            {msg}
          </p>
        )}
        <BigButton variant="neutral" onClick={() => void settingsStore.update({ onboardingDone: false })}>
          {t.onboardingAgain}
        </BigButton>
        <hr className="divider" />
        <p className="card-muted" style={{ margin: 0 }}>
          {t.resetHint}
        </p>
        <HoldButton
          className="big-button big-button-danger"
          label={t.resetConfirm}
          onConfirm={async () => {
            await getRepo().clearAll()
            setMsg(t.resetDone)
            setTimeout(() => location.reload(), 600)
          }}
        >
          {t.resetConfirm}
        </HoldButton>
      </div>
    </>
  )
}
