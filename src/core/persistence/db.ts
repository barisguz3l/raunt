// Kullanıcı verisi: IndexedDB (bağımlılıksız küçük sarmalayıcı).
// Statik içerik burada tutulmaz; içerik güncellemesi kullanıcı verisini asla silmez.

export const DB_NAME = 'raunt'
export const DB_VERSION = 2

/** Koleksiyonlar (her kayıt "id" alanıyla saklanır). */
export const STORES = [
  'sessions', // SessionLog
  'testResults', // TestResult
  'measurements', // BodyMeasurement
  'journals', // LessonJournal
  'userCombos', // kullanıcı kombosu
  'userPresets', // kullanıcı zamanlayıcı ön ayarı
  'workouts', // WorkoutTemplate
] as const
export type StoreName = (typeof STORES)[number]

/** Tekil anahtar-değer verisi (profil, ayarlar, program kaydı…). */
export const KV_STORE = 'kv'

/**
 * Teknik videoları (Blob). Bilerek STORES listesinde değil: JSON yedeğine girmez (büyük ikili veri).
 * Sürüm 2'de eklendi.
 */
export const VIDEO_STORE = 'videos'

export interface Identified {
  id: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export function openDb(name = DB_NAME): Promise<IDBDatabase> {
  if (dbPromise && name === DB_NAME) return dbPromise
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(name, DB_VERSION)
    open.onupgradeneeded = () => {
      const db = open.result
      // Sürüm geçişleri burada, eskiden yeniye sırayla eklenir. Var olan veri silinmez.
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE)
      // Sürüm 2: teknik videoları
      if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE, { keyPath: 'id' })
    }
    open.onsuccess = () => {
      // Başka sekmede yeni sürüm açılırsa bu bağlantı yükseltmeyi engellemesin
      open.result.onversionchange = () => open.result.close()
      resolve(open.result)
    }
    open.onerror = () => reject(open.error)
  })
  if (name === DB_NAME) dbPromise = p
  return p
}

export class Repo {
  constructor(private db: Promise<IDBDatabase>) {}

  private async store(name: string, mode: IDBTransactionMode) {
    return (await this.db).transaction(name, mode).objectStore(name)
  }

  async put<T extends Identified>(store: StoreName, item: T): Promise<void> {
    await req((await this.store(store, 'readwrite')).put(item))
  }
  async get<T>(store: StoreName, id: string): Promise<T | undefined> {
    return req((await this.store(store, 'readonly')).get(id))
  }
  async all<T>(store: StoreName): Promise<T[]> {
    return req((await this.store(store, 'readonly')).getAll())
  }
  async delete(store: StoreName, id: string): Promise<void> {
    await req((await this.store(store, 'readwrite')).delete(id))
  }

  async getKV<T>(key: string): Promise<T | undefined> {
    return req((await this.store(KV_STORE, 'readonly')).get(key))
  }
  async setKV<T>(key: string, value: T): Promise<void> {
    await req((await this.store(KV_STORE, 'readwrite')).put(value, key))
  }

  /** Tüm kullanıcı verisini siler (Ayarlar › Verilerim › Tüm verileri sil). */
  async clearAll(): Promise<void> {
    for (const s of [...STORES, KV_STORE, VIDEO_STORE]) await req((await this.store(s, 'readwrite')).clear())
  }

  /** JSON yedek (spec F-1502; araştırma: iOS veriyi silebilir → yedek MVP'de). */
  async exportAll(): Promise<BackupFile> {
    const data: Record<string, unknown[]> = {}
    for (const s of STORES) data[s] = await this.all(s)
    const kvStore = await this.store(KV_STORE, 'readonly')
    const keys = (await req(kvStore.getAllKeys())) as string[]
    const kv: Record<string, unknown> = {}
    for (const k of keys) kv[k] = await this.getKV(k)
    return { app: 'raunt', schema: DB_VERSION, exportedAt: new Date().toISOString(), data, kv }
  }

  /** Yedeği geri yükler; aynı id'li kayıtların üzerine yazar, diğerlerini korur. */
  async importAll(backup: BackupFile): Promise<number> {
    if (!backup || typeof backup !== 'object' || backup.app !== 'raunt') throw new Error('Bu dosya bir Raunt yedeği değil.')
    if (typeof backup.schema !== 'number' || backup.schema > DB_VERSION) throw new Error('Yedek, uygulamanın daha yeni bir sürümüne ait.')
    const data = backup.data && typeof backup.data === 'object' ? backup.data : {}
    const kv = backup.kv && typeof backup.kv === 'object' ? backup.kv : {}
    // Önce doğrula: bozuk kayıt varsa hiçbir şey yazılmaz
    const rows: [StoreName, Identified][] = []
    for (const s of STORES) {
      const list = data[s] ?? []
      if (!Array.isArray(list)) throw new Error('Yedek dosyası bozuk.')
      for (const item of list) {
        if (!item || typeof (item as Identified).id !== 'string') throw new Error('Yedek dosyası bozuk.')
        rows.push([s, item as Identified])
      }
    }
    // Hepsi tek işlemde: yarım yüklenmiş yedek kalmaz
    const db = await this.db
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([...STORES, KV_STORE], 'readwrite')
      for (const [s, item] of rows) tx.objectStore(s).put(item)
      for (const [k, v] of Object.entries(kv)) tx.objectStore(KV_STORE).put(v, k)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('İşlem iptal edildi.'))
    })
    return rows.length
  }
}

export interface BackupFile {
  app: 'raunt'
  schema: number
  exportedAt: string
  data: Record<string, unknown[]>
  kv: Record<string, unknown>
}

let shared: Repo | null = null
export function getRepo(): Repo {
  if (!shared) shared = new Repo(openDb())
  return shared
}

/** iOS'ta verinin silinmemesi için kalıcı depolama iste (garanti değil). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
