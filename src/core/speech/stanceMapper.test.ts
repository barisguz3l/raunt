import { getContentStore } from '../content/contentStore'
import { phraseId, toSpeakText } from './pronounce'
import { comboPhrases, sideOf, spokenPhrase } from './stanceMapper'
import { allPhrases } from './vocabulary'

const store = getContentStore()
const mv = (id: string) => store.move(id)!
const combo = (code: string) => store.comboMoves(store.content.combos.find((c) => c.code === code)!)

describe('StanceMapper (spec §4.2.1 tablosu)', () => {
  it('sayılar her iki duruşta aynı', () => {
    const ids = ['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut']
    const nums = ['bir', 'iki', 'üç', 'dört', 'beş', 'altı']
    for (const st of ['orthodox', 'southpaw'] as const) {
      expect(ids.map((id) => spokenPhrase(mv(id), st, 'numbers'))).toEqual(nums)
    }
  })

  it.each([
    ['jab', 'sol direkt', 'sağ direkt'],
    ['cross', 'sağ direkt', 'sol direkt'],
    ['lead_hook', 'sol kroşe', 'sağ kroşe'],
    ['rear_hook', 'sağ kroşe', 'sol kroşe'],
    ['lead_uppercut', 'sol aparkat', 'sağ aparkat'],
    ['rear_uppercut', 'sağ aparkat', 'sol aparkat'],
    ['lead_hook_body', 'sol kroşe gövde', 'sağ kroşe gövde'],
    ['jab_body', 'sol direkt gövde', 'sağ direkt gövde'],
    ['teep_lead', 'ön itme tekmesi', 'ön itme tekmesi'],
    ['knee_lead', 'ön diz', 'ön diz'],
    ['low_kick_lead', 'ön alçak tekme', 'ön alçak tekme'],
    ['low_kick_rear', 'arka alçak tekme', 'arka alçak tekme'],
    ['mid_kick_rear', 'arka orta tekme', 'arka orta tekme'],
    ['high_kick_lead', 'ön yüksek tekme', 'ön yüksek tekme'],
    ['leg_check', 'kalkan', 'kalkan'],
    ['roll', 'dalış', 'dalış'],
    ['parry', 'savuştur', 'savuştur'],
    ['switch', 'duruş değiştir', 'duruş değiştir'],
    ['slip', 'kafa kaçır', 'kafa kaçır'],
  ])('%s → orthodox "%s", southpaw "%s" (isim modu)', (id, ortho, south) => {
    expect(spokenPhrase(mv(id), 'orthodox', 'names')).toBe(ortho)
    expect(spokenPhrase(mv(id), 'southpaw', 'names')).toBe(south)
  })

  it('tam Türkçe: söylenen ve ekranda yazan hiçbir ifadede İngilizce terim yok', () => {
    const english = /(^|[\s(,.;:-])(jab|cross|hook|uppercut|low|middle|high|kick|teep|check|stance|pivot|guard|slip|roll|parry|switch|cab)(?=$|[\s),.;:-])/i
    const texts = [
      ...allPhrases(store.content.moves),
      ...store.content.moves.flatMap((m) => [m.nameTr, m.shortTr, ...m.steps, ...m.mistakes]),
      ...store.content.combos.flatMap((c) => [c.nameTr, c.description ?? '']),
      ...store.content.exercises.flatMap((e) => [e.nameTr, ...e.steps]),
    ]
    expect(texts.filter((x) => english.test(x))).toEqual([])
  })

  it('ön/arka adlandırma stili duruştan bağımsız', () => {
    expect(spokenPhrase(mv('lead_hook'), 'southpaw', 'names', 'frontRear')).toBe('ön kroşe')
    expect(spokenPhrase(mv('cross'), 'southpaw', 'names', 'frontRear')).toBe('arka direkt')
    expect(spokenPhrase(mv('rear_uppercut'), 'orthodox', 'names', 'frontRear')).toBe('arka aparkat')
  })

  it('M3 kabul (1): "1-2-3-LKR" sayı / isim / southpaw', () => {
    const m = combo('1-2-3-LKR')
    expect(comboPhrases(m, 'orthodox', 'numbers')).toEqual(['bir', 'iki', 'üç', 'arka alçak tekme'])
    expect(comboPhrases(m, 'orthodox', 'names')).toEqual(['sol direkt', 'sağ direkt', 'sol kroşe', 'arka alçak tekme'])
    expect(comboPhrases(m, 'southpaw', 'names')).toEqual(['sağ direkt', 'sol direkt', 'sağ kroşe', 'arka alçak tekme'])
  })

  it('her hareket × duruş × mod × stil için ifade boş değil (31 × 8 = 248 durum)', () => {
    let n = 0
    for (const m of store.content.moves)
      for (const st of ['orthodox', 'southpaw'] as const)
        for (const mo of ['numbers', 'names'] as const)
          for (const sy of ['leftRight', 'frontRear'] as const) {
            expect(spokenPhrase(m, st, mo, sy).trim().length).toBeGreaterThan(1)
            n++
          }
    expect(n).toBe(248)
  })

  it('sideOf', () => {
    expect(sideOf('lead', 'orthodox')).toBe('sol')
    expect(sideOf('rear', 'orthodox')).toBe('sağ')
    expect(sideOf('lead', 'southpaw')).toBe('sağ')
    expect(sideOf('none', 'southpaw')).toBeNull()
  })
})

describe('Telaffuz ve kelime listesi', () => {
  it('İngilizce terimler Türkçe okunuşa çevrilir', () => {
    expect(toSpeakText('arka low kick')).toBe('arka lo kik')
    expect(toSpeakText('ön teep')).toBe('ön tiip')
    expect(toSpeakText('arka high kick')).toBe('arka hay kik')
    expect(toSpeakText('check')).toBe('çek')
    expect(toSpeakText('sol kroşe')).toBe('sol kroşe')
  })

  it('dosya kimlikleri ASCII ve benzersiz', () => {
    expect(phraseId('sol kroşe gövde')).toBe('sol-krose-govde')
    expect(phraseId('antrenman bitti, harika iş')).toBe('antrenman-bitti-harika-is')
    const phrases = allPhrases(store.content.moves)
    const ids = phrases.map(phraseId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true)
  })

  it('kelime listesi makul boyutta', () => {
    const n = allPhrases(store.content.moves).length
    expect(n).toBeGreaterThan(50)
    expect(n).toBeLessThan(150)
  })
})
