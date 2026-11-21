// Ekranda yazılan ifade ≠ sese verilen yazım. Türkçe ses motorları İngilizce terimleri yanlış okur;
// seed/tts_pronunciations_tr.json'daki yazımlar + ek kurallar uygulanır (spec §4.1).

/** Uzun ifadeler önce (ör. "low kick" → "lo kik", "kick" tek başına değil). */
const RULES: [RegExp, string][] = [
  [/\blow kick\b/g, 'lo kik'],
  [/\bmiddle kick\b/g, 'midıl kik'],
  [/\bhigh kick\b/g, 'hay kik'],
  [/\bteep\b/g, 'tiip'],
  [/\bcheck\b/g, 'çek'],
  [/\bstance\b/g, 'stens'],
  [/\bburpee\b/g, 'börpi'],
  [/\bjab\b/g, 'cab'],
]

export function toSpeakText(phrase: string): string {
  let s = phrase.toLocaleLowerCase('tr-TR')
  for (const [re, rep] of RULES) s = s.replace(re, rep)
  return s
}

/** Dosya adı için güvenli kimlik: "sol kroşe gövde" → "sol-krose-govde". */
export function phraseId(phrase: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }
  return phrase
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıiöşüâîû]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
