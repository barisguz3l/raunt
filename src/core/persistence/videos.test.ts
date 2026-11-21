import { describe, expect, it } from 'vitest'
import { DB_VERSION, openDb, Repo, STORES, VIDEO_STORE } from './db'
import { pickMimeType, VideoRepo, type TechniqueVideo } from './videos'

let n = 0
const name = () => `raunt-video-test-${n++}`
const clip = (id: string, createdAt: string): TechniqueVideo => ({
  id,
  createdAt,
  date: createdAt.slice(0, 10),
  mimeType: 'video/mp4',
  durationSec: 10,
  // fake-indexeddb'de Blob klonlanamayabilir; deponun mantığı için düz veri yeter
  blob: { size: 3 } as unknown as Blob,
})

describe('Teknik videoları', () => {
  it('sürüm 2: videolar deposu var, yedek listesinde yok', async () => {
    expect(DB_VERSION).toBe(2)
    expect((STORES as readonly string[]).includes(VIDEO_STORE)).toBe(false)
    const db = await openDb(name())
    expect(db.objectStoreNames.contains(VIDEO_STORE)).toBe(true)
  })

  it('kaydet, en yeni önce listele, sil', async () => {
    const repo = new VideoRepo(openDb(name()))
    await repo.save(clip('a', '2026-10-01T10:00:00.000Z'))
    await repo.save(clip('b', '2026-11-20T10:00:00.000Z'))
    expect((await repo.list()).map((v) => v.id)).toEqual(['b', 'a'])
    await repo.delete('b')
    expect((await repo.list()).map((v) => v.id)).toEqual(['a'])
  })

  it('JSON yedeği videoları içermez, eski sürüm yedeği yüklenir', async () => {
    const dbName = name()
    const repo = new Repo(openDb(dbName))
    await new VideoRepo(openDb(dbName)).save(clip('v1', '2026-11-20T10:00:00.000Z'))
    await repo.setKV('combo.stats', { c1: { count: 2, lastDate: '2026-11-20' } })
    const backup = await repo.exportAll()
    expect(backup.data[VIDEO_STORE]).toBeUndefined()
    expect(JSON.stringify(backup)).not.toContain('v1')
    expect(backup.kv['combo.stats']).toEqual({ c1: { count: 2, lastDate: '2026-11-20' } })

    const other = new Repo(openDb(name()))
    await other.importAll({ ...JSON.parse(JSON.stringify(backup)), schema: 1 })
    expect(await other.getKV('combo.stats')).toEqual({ c1: { count: 2, lastDate: '2026-11-20' } })
  })

  it('"Tüm verileri sil" videoları da siler', async () => {
    const dbName = name()
    const videos = new VideoRepo(openDb(dbName))
    await videos.save(clip('v1', '2026-11-20T10:00:00.000Z'))
    await new Repo(openDb(dbName)).clearAll()
    expect(await videos.list()).toEqual([])
  })

  it('kayıt türü: iOS mp4, Chrome webm, hiçbiri yoksa tanımsız', () => {
    expect(pickMimeType((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1')
    expect(pickMimeType((t) => t === 'video/mp4')).toBe('video/mp4')
    expect(pickMimeType((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9')
    expect(pickMimeType(() => false)).toBeUndefined()
    expect(
      pickMimeType(() => {
        throw new Error('x')
      }),
    ).toBeUndefined()
  })
})
