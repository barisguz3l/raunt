import { useSyncExternalStore } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { Combo, Move } from '../../core/content/types'
import { getRepo } from '../../core/persistence/db'

/** Kullanıcı kombolarını IndexedDB'den yükleyip içerik deposuna ekler (açılışta bir kez). */
export async function loadUserCombos() {
  const list = await getRepo().all<Combo>('userCombos')
  getContentStore().setUserCombos(list.sort((a, b) => a.nameTr.localeCompare(b.nameTr, 'tr')))
}

export function validateSteps(moves: Move[]): string | null {
  if (moves.length < 2) return 'En az 2 adım gerekli.'
  if (moves.length > 8) return 'En fazla 8 adım olabilir.'
  return null
}

/** Otomatik kod: yumruk numaraları + kısa etiketler ("1-2-3-Arka alçak"). */
export function autoName(moves: Move[]): string {
  return moves.map((m) => m.shortTr).join(' · ')
}

export async function saveUserCombo(input: { id?: string; nameTr: string; moves: Move[]; description?: string }): Promise<Combo> {
  const moves = input.moves
  const level = Math.min(3, Math.max(1, Math.max(...moves.map((m) => m.level))))
  const focus: Combo['focus'] = moves.some((m) => m.category === 'defense')
    ? 'savunma'
    : moves.some((m) => m.category === 'kick')
      ? 'tekme'
      : moves.some((m) => m.category === 'knee')
        ? 'diz'
        : moves.length >= 4
          ? 'kombinasyon'
          : 'teknik'
  const combo: Combo = {
    id: input.id ?? `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    nameTr: input.nameTr.trim() || autoName(moves),
    level,
    code: moves.map((m) => m.id).join('-'),
    steps: moves.map((m) => ({ move: m.id })),
    description: input.description ?? 'Kendi kombinasyonun',
    focus,
    // Hoca onayı adımlardan türetilir (spec §5.2)
    requiresCoachApproval: moves.some((m) => m.coachApproval),
    isSystem: false,
  }
  await getRepo().put('userCombos', combo)
  await loadUserCombos()
  return combo
}

export async function deleteUserCombo(id: string) {
  await getRepo().delete('userCombos', id)
  await loadUserCombos()
}

/** Kullanıcı kombosu değişince yeniden çiz. */
export function useCombosVersion(): number {
  const store = getContentStore()
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.userCombos().length + store.userCombos().map((c) => c.id + c.nameTr).join('').length,
  )
}

/** Paylaşım bağlantısı: kombo adımları URL'ye kodlanır (sunucu yok). */
export function shareLink(combo: Combo): string {
  const base = location.href.split('#')[0]
  const payload = encodeURIComponent(`${combo.nameTr.replace(/\|/g, '')}|${combo.steps.map((s) => s.move).join(',')}`)
  return `${base}#/kombo/${payload}`
}

export function parseShare(hash: string): { nameTr: string; moveIds: string[] } | null {
  const m = /^#\/kombo\/(.+)$/.exec(hash)
  if (!m) return null
  try {
    const raw = decodeURIComponent(m[1])
    const cut = raw.lastIndexOf('|')
    const nameTr = cut >= 0 ? raw.slice(0, cut) : ''
    const ids = cut >= 0 ? raw.slice(cut + 1) : raw
    const moveIds = (ids ?? '').split(',').filter(Boolean)
    return moveIds.length ? { nameTr, moveIds } : null
  } catch {
    return null
  }
}
