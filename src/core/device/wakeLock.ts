// Ekranı uyanık tut (spec F-106). iOS ana ekran uygulamasında 18.4+ ile çalışır.
// Sayfa gizlenince sistem kilidi bırakır; görünür olunca yeniden alınır.

type Sentinel = { release(): Promise<void>; released?: boolean }

export class ScreenWake {
  private sentinel: Sentinel | null = null
  private wanted = false
  private onVis = () => {
    if (this.wanted && document.visibilityState === 'visible') void this.acquire()
  }

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator
  }

  async enable(): Promise<boolean> {
    this.wanted = true
    document.addEventListener('visibilitychange', this.onVis)
    return this.acquire()
  }

  private async acquire(): Promise<boolean> {
    if (!this.supported) return false
    try {
      this.sentinel = await (navigator as unknown as { wakeLock: { request(t: 'screen'): Promise<Sentinel> } }).wakeLock.request('screen')
      return true
    } catch {
      return false
    }
  }

  async disable() {
    this.wanted = false
    document.removeEventListener('visibilitychange', this.onVis)
    try {
      await this.sentinel?.release()
    } catch {
      /* yut */
    }
    this.sentinel = null
  }
}
