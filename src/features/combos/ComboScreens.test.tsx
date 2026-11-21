import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { getContentStore } from '../../core/content/contentStore'
import { settingsStore } from '../../core/settings/settings'
import { emptyFilter, filterCombos } from './comboModel'
import { ComboDetail } from './ComboDetail'
import { ComboList } from './ComboList'

const store = getContentStore()

describe('Kombo filtreleri', () => {
  const run = (f: Partial<typeof emptyFilter>) => filterCombos(store, store.content.combos, { ...emptyFilter, ...f })
  it('seviye, odak, kilitli, arama', () => {
    expect(run({})).toHaveLength(42)
    expect(run({ levels: [1] })).toHaveLength(16)
    expect(run({ levels: [2, 3] })).toHaveLength(26)
    expect(run({ lockedOnly: true })).toHaveLength(4)
    expect(run({ query: '1-2-3-LKR' }).map((c) => c.code)).toContain('1-2-3-LKR')
    // Hareket adıyla Türkçe arama (büyük/küçük İ/ı duyarsız)
    expect(run({ query: 'KROŞE' }).length).toBeGreaterThan(5)
    expect(run({ focus: 'savunma' }).every((c) => c.focus === 'savunma')).toBe(true)
  })
})

describe('Kombo listesi ve detay', () => {
  beforeEach(async () => {
    await act(() => settingsStore.update({ coachApproved: false, stance: 'orthodox', callMode: 'names', nameStyle: 'leftRight' }))
  })

  it('M3 kabul (4): kilitli 4 kombo listede 🔒 ile; seçim modunda onaysız seçilemez', () => {
    render(<ComboList mode="pick" coachApproved={false} selected={new Set()} onToggle={() => {}} />)
    const locked = screen.getAllByLabelText('Hoca onayı gerekli')
    expect(locked).toHaveLength(4)
    const row = screen.getByRole('checkbox', { name: /Arka yüksek/ })
    expect(row).toBeDisabled()
  })

  it('arama kutusu listeyi daraltır', () => {
    render(<ComboList mode="browse" coachApproved={false} onOpen={() => {}} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'teep' } })
    expect(screen.getByText(/kombinasyon$/).textContent).not.toBe('42 kombinasyon')
  })

  it('detay: adımlar duruşa göre adlandırılır (southpaw → sağ kroşe)', async () => {
    const combo = store.content.combos.find((c) => c.code === '1-2-3-LKR')!
    const { rerender } = render(<ComboDetail combo={combo} onBack={() => {}} />)
    const steps = screen.getByRole('list')
    expect(within(steps).getByText('“sol kroşe”')).toBeInTheDocument()
    expect(within(steps).getByText('“sol direkt”')).toBeInTheDocument()
    await act(() => settingsStore.update({ stance: 'southpaw' }))
    rerender(<ComboDetail combo={combo} onBack={() => {}} />)
    expect(within(steps).getByText('“sağ kroşe”')).toBeInTheDocument()
  })

  it('kilitli kombo detayında uyarı', () => {
    const combo = store.content.combos.find((c) => c.code === '1-2-HKR')!
    render(<ComboDetail combo={combo} onBack={() => {}} />)
    expect(screen.getByText(/antrenörünün onayından sonra/)).toBeInTheDocument()
  })
})
