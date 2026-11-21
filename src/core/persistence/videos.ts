// Teknik videoları: ön kamerayla çekilen 10 saniyelik klipler (IndexedDB "videos" deposu).
// Telefondan çıkmaz; JSON yedeğine girmez (bkz. db.ts VIDEO_STORE).

import { openDb, VIDEO_STORE } from './db'

export interface TechniqueVideo {
  id: string
  /** ISO zaman damgası */
  createdAt: string
  /** YYYY-AA-GG */
  date: string
  mimeType: string
  durationSec: number
  blob: Blob
}

export const CLIP_SEC = 10
export const COUNTDOWN_SEC = 3

/** iOS Safari mp4 kaydeder; Chrome/Firefox webm. İlk desteklenen; hiçbiri yoksa tarayıcının varsayılanı. */
export const MIME_CANDIDATES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  for (const t of MIME_CANDIDATES) {
    try {
      if (isSupported(t)) return t
    } catch {
      /* bazı tarayıcılar bilinmeyen türde hata atar */
    }
  }
  return undefined
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export class VideoRepo {
  constructor(private db: Promise<IDBDatabase>) {}

  private async store(mode: IDBTransactionMode) {
    return (await this.db).transaction(VIDEO_STORE, mode).objectStore(VIDEO_STORE)
  }

  async save(v: TechniqueVideo): Promise<void> {
    await req((await this.store('readwrite')).put(v))
  }

  /** En yeni önce */
  async list(): Promise<TechniqueVideo[]> {
    const all = (await req((await this.store('readonly')).getAll())) as TechniqueVideo[]
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async delete(id: string): Promise<void> {
    await req((await this.store('readwrite')).delete(id))
  }
}

let shared: VideoRepo | null = null
export function getVideoRepo(): VideoRepo {
  if (!shared) shared = new VideoRepo(openDb())
  return shared
}
