// Kare kare duruştan olay çıkarır: yumruk, tekme/diz, gard düşmesi, çene kalkması, kafa kaçırma, blok.
// Saf TS: zaman (sn) ve Pose verilir, olaylar döner. Eşikler yorumlu; birim testlerle sabitlenir.

import {
  armExtension,
  dist,
  elbowAngle,
  guardDown,
  headOffset,
  headPitch,
  kickHeight,
  kneeHeight,
  leadFoot,
  LM,
  shoulderWidth,
  sideIdx,
  visible,
  type Pose,
  type Side,
} from './pose'

export type PunchKind = 'straight' | 'hook' | 'uppercut'

export type VisionEvent =
  | { type: 'punch'; t: number; side: Side; kind: PunchKind; speed: number; returnSec?: number }
  | { type: 'kick'; t: number; side: Side; height: number }
  | { type: 'knee'; t: number; side: Side }
  | { type: 'guardDown'; t: number; side: Side | 'both' }
  | { type: 'chinUp'; t: number }
  | { type: 'slip'; t: number; dir: 'left' | 'right' }
  | { type: 'block'; t: number }
  | { type: 'returned'; t: number; side: Side; sec: number }

/** Eşikler (dünya koordinatı metre, görüntü ölçüsü omuz genişliği). */
export const TH = {
  armedExt: 0.68, // bu altına inince kol "hazır" (gardda)
  punchExt: 0.86, // bu üstüne çıkınca yumruk
  minPunchSpeed: 1.1, // m/sn bilek hızı
  uppercutRise: 1.2, // yukarı hareket / yanal hareket oranı
  hookElbowMax: 100, // derece; kameraya uzanan direktte derinlik eksik ölçülür (gerçek fotoğrafta ≈124°)
  bentPunchSpeed: 2.2, // m/sn: kroşe/aparkat kol bükükken hızlı bilek hareketiyle algılanır
  rearmSpeed: 0.5,
  kickStart: 0.42,
  kneeUp: 0.75,
  guardDownSec: 1.0,
  chinDelta: 0.1,
  slipDelta: 0.33,
  calibrateSec: 2.5,
}

interface ArmState {
  armed: boolean
  start?: { x: number; y: number; t: number }
  peakSpeed: number
  peakT?: number
  awaitingReturn?: { t: number }
}

export class PoseTracker {
  private prev?: { t: number; pose: Pose }
  private arms: Record<Side, ArmState> = { left: { armed: true, peakSpeed: 0 }, right: { armed: true, peakSpeed: 0 } }
  private legs: Record<Side, { up: boolean; peak: number; kneeUp: boolean }> = {
    left: { up: false, peak: 0, kneeUp: false },
    right: { up: false, peak: 0, kneeUp: false },
  }
  private guardSince: Record<Side, number | null> = { left: null, right: null }
  private guardReported: Record<Side, boolean> = { left: false, right: false }
  private calib: { pitch: number[]; offset: number[]; until: number | null } = { pitch: [], offset: [], until: null }
  private base: { pitch: number; offset: number } | null = null
  private chinReported = false
  private slipCooldown = 0
  private blockCooldown = 0
  lead: Side | null = null

  /** Kalibrasyon: ilk saniyelerdeki duruş "normal" sayılır (çene, baş konumu). */
  get calibrated() {
    return this.base !== null
  }

  update(t: number, pose: Pose): VisionEvent[] {
    const out: VisionEvent[] = []
    const core = [LM.nose, LM.lSh, LM.rSh, LM.lHip, LM.rHip]
    if (!visible(pose, core, 0.4)) {
      this.prev = { t, pose }
      return out
    }
    const { img, world } = pose
    const dt = this.prev ? Math.max(1e-3, t - this.prev.t) : 0

    // Kalibrasyon
    if (!this.base) {
      this.calib.until ??= t + TH.calibrateSec
      this.calib.pitch.push(headPitch(img))
      this.calib.offset.push(headOffset(img))
      if (t >= this.calib.until && this.calib.pitch.length >= 5) {
        const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
        this.base = { pitch: med(this.calib.pitch), offset: med(this.calib.offset) }
      }
    }

    const lf = leadFoot(world)
    if (lf) this.lead = lf

    for (const side of ['left', 'right'] as Side[]) {
      // ---- Yumruk
      const s = sideIdx(side)
      const arm = this.arms[side]
      const ext = armExtension(world, side)
      const wr = world[s.wr]
      const speed = this.prev && dt ? dist(wr, this.prev.pose.world[s.wr]) / dt : 0
      // Kol bükükken yeniden hazır: el yüze yakın ve yavaş (kroşe/aparkat sonrası)
      const calmAtFace = speed < TH.rearmSpeed && !guardDown(img)[side] && ext < TH.punchExt
      if (ext < TH.armedExt || (!arm.armed && calmAtFace && t - (arm.awaitingReturn?.t ?? arm.peakT ?? 0) > 0.25)) {
        if (!arm.armed) arm.armed = true
        arm.start = { x: img[s.wr].x, y: img[s.wr].y, t }
        arm.peakSpeed = 0
        // Gard dönüşü: yumruktan sonra el tekrar gardda
        if (arm.awaitingReturn && !guardDown(img)[side]) {
          const sec = t - arm.awaitingReturn.t
          out.push({ type: 'returned', t, side, sec })
          arm.awaitingReturn = undefined
        }
      } else if (arm.armed) {
        arm.peakSpeed = Math.max(arm.peakSpeed, speed)
        // Yumruk baş–gövde yüksekliğinde biter; el aşağı sarkınca kol düzleşir ama yumruk değildir
        const shY = (img[LM.lSh].y + img[LM.rSh].y) / 2
        const hipY = (img[LM.lHip].y + img[LM.rHip].y) / 2
        const atHeight = img[s.wr].y < shY + 0.6 * (hipY - shY)
        const st = arm.start ?? { x: img[s.wr].x, y: img[s.wr].y, t }
        const sw = shoulderWidth(img)
        const rise = (st.y - img[s.wr].y) / sw // + yukarı
        const lateral = Math.abs(img[s.wr].x - st.x) / sw
        const angle = elbowAngle(world, side)
        const straight = ext > TH.punchExt && arm.peakSpeed >= TH.minPunchSpeed && atHeight
        // Bükük kol: hızlı ve belirgin yan (kroşe) ya da yukarı (aparkat) hareket
        const bent = !straight && atHeight && arm.peakSpeed >= TH.bentPunchSpeed && angle < 135 && (lateral > 0.35 || rise > 0.35)
        if (straight || bent) {
          const kind: PunchKind = rise > 0.25 && rise > TH.uppercutRise * lateral ? 'uppercut' : bent || angle < TH.hookElbowMax ? 'hook' : 'straight'
          out.push({ type: 'punch', t, side, kind, speed: Math.round(arm.peakSpeed * 100) / 100 })
          arm.armed = false
          arm.peakT = t
          arm.awaitingReturn = { t }
        }
      }

      // ---- Tekme / diz
      const leg = this.legs[side]
      const h = kickHeight(world, side)
      const kh = kneeHeight(world, side)
      if (!leg.up && h > TH.kickStart) {
        leg.up = true
        leg.peak = h
      } else if (leg.up) {
        leg.peak = Math.max(leg.peak, h)
        if (h < TH.kickStart * 0.7) {
          out.push({ type: 'kick', t, side, height: Math.round(leg.peak * 100) / 100 })
          leg.up = false
          leg.peak = 0
        }
      }
      if (!leg.kneeUp && kh > TH.kneeUp && h < 0.75) {
        leg.kneeUp = true
        out.push({ type: 'knee', t, side })
      } else if (leg.kneeUp && kh < TH.kneeUp * 0.6) leg.kneeUp = false

      // ---- Gard (yumruk atarken ya da tekmede sayılmaz)
      const down = guardDown(img)[side] && this.arms[side].armed && !leg.up
      if (down) {
        this.guardSince[side] ??= t
        if (!this.guardReported[side] && t - this.guardSince[side]! >= TH.guardDownSec) {
          this.guardReported[side] = true
          const other: Side = side === 'left' ? 'right' : 'left'
          out.push({ type: 'guardDown', t, side: this.guardReported[other] ? 'both' : side })
        }
      } else {
        this.guardSince[side] = null
        this.guardReported[side] = false
      }
    }

    if (this.base) {
      // ---- Çene kalkması
      const pitch = headPitch(img)
      if (!this.chinReported && pitch - this.base.pitch < -TH.chinDelta) {
        this.chinReported = true
        out.push({ type: 'chinUp', t })
      } else if (pitch - this.base.pitch > -TH.chinDelta / 2) this.chinReported = false

      // ---- Kafa kaçırma (baş kalçaya göre yana)
      const off = headOffset(img) - this.base.offset
      if (t > this.slipCooldown && Math.abs(off) > TH.slipDelta) {
        // Görüntü aynalı değil: x büyürse kişi KENDİ soluna kaçmıştır
        out.push({ type: 'slip', t, dir: off > 0 ? 'left' : 'right' })
        this.slipCooldown = t + 0.8
      }
    }

    // ---- Blok: iki bilek de yüz önünde
    const sw = shoulderWidth(img)
    const nose = img[LM.nose]
    const near = (i: number) => Math.abs(img[i].x - nose.x) < 0.75 * sw && img[i].y < (img[LM.lSh].y + img[LM.rSh].y) / 2
    if (t > this.blockCooldown && near(LM.lWr) && near(LM.rWr) && this.arms.left.armed && this.arms.right.armed) {
      const close = Math.abs(img[LM.lWr].x - img[LM.rWr].x) < 0.55 * sw
      if (close) {
        out.push({ type: 'block', t })
        this.blockCooldown = t + 1
      }
    }

    this.prev = { t, pose }
    return out
  }
}

