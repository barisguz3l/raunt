import { useEffect, useRef, useState } from 'react'
import { toISODate } from '../../core/program/schedule'
import { CLIP_SEC, COUNTDOWN_SEC, getVideoRepo, pickMimeType, type TechniqueVideo } from '../../core/persistence/videos'
import { BigButton } from '../../design/BigButton'
import { Sheet } from '../../design/Sheet'
import { tr } from '../../i18n/tr'

const v = tr.video
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

/** İlerleme › Teknik videom: 10 sn'lik ön kamera klipleri, liste, sil, iki klibi yan yana karşılaştır. */
export function TechniqueVideoSection() {
  const [videos, setVideos] = useState<TechniqueVideo[] | null>(null)
  const [recording, setRecording] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [loadErr, setLoadErr] = useState(false)

  const reload = () =>
    getVideoRepo()
      .list()
      .then((list) => {
        setVideos(list)
        setPicked((p) => p.filter((id) => list.some((x) => x.id === id)))
      })
      .catch(() => {
        setVideos([])
        setLoadErr(true)
      })
  useEffect(() => {
    void reload()
  }, [])

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)))

  const remove = async (id: string) => {
    if (!confirm(v.deleteConfirm)) return
    await getVideoRepo().delete(id)
    await reload()
  }

  const pair = (videos ?? []).filter((x) => picked.includes(x.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <>
      <h2 className="section-title">{v.title}</h2>
      <div className="card setting-group">
        <p className="card-muted" style={{ margin: 0 }}>
          {v.intro}
        </p>
        <small className="card-muted">{v.privacy}</small>
        <BigButton variant="neutral" onClick={() => setRecording(true)}>
          {v.record}
        </BigButton>
        {loadErr && <p className="notice">{v.saveFailed}</p>}
        {videos && videos.length === 0 && <p className="card-muted" style={{ margin: 0 }}>{v.empty}</p>}
        {videos && videos.length > 0 && (
          <>
            {videos.length > 1 && (
              <p className="card-muted" style={{ margin: 0 }}>
                {v.pickHint}
              </p>
            )}
            <ul className="plain-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {videos.map((x) => (
                <li key={x.id} className="list-row tv-row">
                  <button type="button" className="chip tv-pick" aria-pressed={picked.includes(x.id)} onClick={() => toggle(x.id)}>
                    {fmtDate(x.date)}, {v.seconds(x.durationSec)}
                  </button>
                  <button type="button" className="chip" onClick={() => void remove(x.id)}>
                    {v.delete}
                  </button>
                </li>
              ))}
            </ul>
            {videos.length > 1 && (
              <BigButton variant="neutral" disabled={pair.length !== 2} onClick={() => setComparing(true)}>
                {v.compare}
              </BigButton>
            )}
          </>
        )}
      </div>
      {recording && (
        <RecordSheet
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false)
            void reload()
          }}
        />
      )}
      {comparing && pair.length === 2 && <CompareSheet before={pair[0]} after={pair[1]} onClose={() => setComparing(false)} />}
    </>
  )
}

type Stage = 'opening' | 'ready' | 'countdown' | 'recording' | 'saving'

function RecordSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)
  const timers = useRef<number[]>([])
  const [stage, setStage] = useState<Stage>('opening')
  const [count, setCount] = useState(COUNTDOWN_SEC)
  const [left, setLeft] = useState(CLIP_SEC)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    cancelled.current = false
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(v.unsupported)
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play().catch(() => undefined)
        }
        setStage('ready')
      })
      .catch((e: Error) => setError(e.name === 'NotAllowedError' || e.name === 'SecurityError' ? v.denied : v.failed))
    return () => {
      alive = false
      cancelled.current = true
      timers.current.forEach((id) => clearTimeout(id))
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const begin = () => {
    setStage('countdown')
    for (let i = 0; i < COUNTDOWN_SEC; i++) later(() => setCount(COUNTDOWN_SEC - i), i * 1000)
    setCount(COUNTDOWN_SEC)
    later(record, COUNTDOWN_SEC * 1000)
  }

  const record = () => {
    const s = stream.current
    if (!s) return
    const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t))
    let rec: MediaRecorder
    try {
      rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s)
    } catch {
      setError(v.unsupported)
      return
    }
    recorder.current = rec
    const chunks: Blob[] = []
    const t0 = performance.now()
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    rec.onstop = async () => {
      if (cancelled.current) return
      setStage('saving')
      const type = rec.mimeType || mime || 'video/mp4'
      const blob = new Blob(chunks, { type })
      const now = new Date()
      try {
        await getVideoRepo().save({
          id: `v_${now.getTime().toString(36)}`,
          createdAt: now.toISOString(),
          date: toISODate(now),
          mimeType: type,
          durationSec: Math.max(1, Math.round((performance.now() - t0) / 1000)),
          blob,
        })
        onSaved()
      } catch {
        setError(v.saveFailed)
      }
    }
    rec.start(1000)
    setStage('recording')
    setLeft(CLIP_SEC)
    for (let i = 1; i <= CLIP_SEC; i++) later(() => setLeft(CLIP_SEC - i), i * 1000)
    later(() => rec.state !== 'inactive' && rec.stop(), CLIP_SEC * 1000)
  }

  return (
    <Sheet title={v.title} onClose={onClose}>
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="tv-stage">
            <video ref={video} playsInline muted autoPlay aria-label={v.title} />
            {stage === 'countdown' && (
              <div className="tv-count" aria-live="assertive">
                {v.countdown(count)}
              </div>
            )}
            {stage === 'recording' && (
              <span className="tv-rec" aria-live="polite">
                {v.recording(left)}
              </span>
            )}
          </div>
          <p className="card-muted" style={{ marginTop: 0 }}>
            {v.placement}
          </p>
          {stage === 'saving' ? (
            <p className="card-muted">{v.saving}</p>
          ) : (
            <BigButton size="primary" disabled={stage !== 'ready'} onClick={begin}>
              {v.start}
            </BigButton>
          )}
        </>
      )}
      <BigButton variant="neutral" style={{ marginTop: 10 }} onClick={onClose}>
        {error ? v.close : v.cancel}
      </BigButton>
    </Sheet>
  )
}

function CompareSheet({ before, after, onClose }: { before: TechniqueVideo; after: TechniqueVideo; onClose: () => void }) {
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)
  // Adresler efektte üretilir ve aynı efektte bırakılır (StrictMode'un çift çalıştırmasında da geçerli kalır)
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const u = [URL.createObjectURL(before.blob), URL.createObjectURL(after.blob)]
    setUrls(u)
    return () => u.forEach((x) => URL.revokeObjectURL(x))
  }, [before, after])

  const playBoth = async () => {
    const vids = [a.current, b.current].filter((x): x is HTMLVideoElement => !!x)
    vids.forEach((x) => {
      x.pause()
      x.currentTime = 0
    })
    await Promise.all(vids.map((x) => x.play().catch(() => undefined)))
  }

  return (
    <Sheet title={v.compareTitle} onClose={onClose}>
      <div className="tv-compare">
        <figure>
          <video ref={a} src={urls[0] || undefined} playsInline muted preload="auto" />
          <figcaption>
            {v.before}: {fmtDate(before.date)}
          </figcaption>
        </figure>
        <figure>
          <video ref={b} src={urls[1] || undefined} playsInline muted preload="auto" />
          <figcaption>
            {v.after}: {fmtDate(after.date)}
          </figcaption>
        </figure>
      </div>
      <BigButton size="primary" onClick={() => void playBoth()}>
        {v.playBoth}
      </BigButton>
    </Sheet>
  )
}
