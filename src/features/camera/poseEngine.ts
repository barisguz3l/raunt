// MediaPipe Pose Landmarker: yalnızca ayna açılınca yüklenir (dinamik import → ana paket büyümez).
// Dosyalar uygulamanın kendi sunucusundan gelir (public/mediapipe, public/models); ilk açılıştan sonra çevrimdışı.

import type { P3, Pose } from '../../core/vision/pose'

type Landmarker = {
  detectForVideo: (v: HTMLVideoElement, ts: number) => { landmarks: P3[][]; worldLandmarks: P3[][] }
  close: () => void
}

let loading: Promise<Landmarker> | null = null

export function loadPoseLandmarker(): Promise<Landmarker> {
  loading ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const base = import.meta.env.BASE_URL
    const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe`)
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${base}models/pose_landmarker_lite.task`, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    try {
      return (await make('GPU')) as unknown as Landmarker
    } catch {
      return (await make('CPU')) as unknown as Landmarker
    }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

/** Videodan bir kare: duruş yoksa null. */
export function detect(lm: Landmarker, video: HTMLVideoElement, tsMs: number): Pose | null {
  const r = lm.detectForVideo(video, tsMs)
  const img = r.landmarks?.[0]
  const world = r.worldLandmarks?.[0]
  if (!img || !world) return null
  const map = (a: P3[]) => a.map((p) => ({ x: p.x, y: p.y, z: p.z, v: (p as P3 & { visibility?: number }).visibility ?? 1 }))
  return { img: map(img), world: map(world) }
}
