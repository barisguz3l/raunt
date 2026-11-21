import { openDb, Repo } from './db'

let n = 0
const freshRepo = () => new Repo(openDb(`raunt-test-${n++}`))

describe('Repo (IndexedDB)', () => {
  it('kayıt ekle, oku, listele, sil', async () => {
    const repo = freshRepo()
    await repo.put('sessions', { id: 'a', minutes: 30 })
    await repo.put('sessions', { id: 'b', minutes: 45 })
    expect(await repo.get('sessions', 'a')).toEqual({ id: 'a', minutes: 30 })
    expect((await repo.all('sessions')).length).toBe(2)
    await repo.delete('sessions', 'a')
    expect(await repo.get('sessions', 'a')).toBeUndefined()
  })

  it('anahtar-değer', async () => {
    const repo = freshRepo()
    await repo.setKV('profile', { stance: 'orthodox' })
    expect(await repo.getKV('profile')).toEqual({ stance: 'orthodox' })
  })

  it('yedek dışa aktar → başka veritabanına geri yükle', async () => {
    const a = freshRepo()
    await a.put('testResults', { id: 't1', testId: 'pushup', value: 3 })
    await a.setKV('profile', { stance: 'southpaw' })
    const backup = await a.exportAll()

    const b = freshRepo()
    await b.put('testResults', { id: 'eski', testId: 'plank', value: 30 })
    await b.importAll(JSON.parse(JSON.stringify(backup)))
    expect((await b.all('testResults')).map((x: any) => x.id).sort()).toEqual(['eski', 't1'])
    expect(await b.getKV('profile')).toEqual({ stance: 'southpaw' })
  })

  it('yabancı dosya reddedilir', async () => {
    await expect(freshRepo().importAll({ app: 'baska' } as any)).rejects.toThrow('Raunt yedeği değil')
  })
})
