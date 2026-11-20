import { describe, expect, it } from 'vitest'
import { reserveGap } from './reserve'

describe('viewport/reserve (EP-11 ② · p3, p4, p12)', () => {
  it('p3: computes max(0, 0.5*H - (total - lastUserStart)) so total + reserve stays constant while filling', () => {
    const H = 800
    const lastUserStart = 1000
    // User block is 60px tall → blocksTotal = 1060
    const gap1 = reserveGap(H, 1060, lastUserStart)
    expect(gap1).toBe(340)
    expect(1060 + gap1).toBe(1400)

    // Assistant grows by 140px → blocksTotal = 1200
    const gap2 = reserveGap(H, 1200, lastUserStart)
    expect(gap2).toBe(200)
    expect(1200 + gap2).toBe(1400)
  })

  it('p4: once gap reaches 0, further growth increases total height 1:1', () => {
    const H = 800
    const lastUserStart = 1000
    expect(reserveGap(H, 1400, lastUserStart)).toBe(0)
    expect(reserveGap(H, 1550, lastUserStart)).toBe(0)
  })

  it('p12: repeated calls with identical block measurements produce identical gap (zero oscillation)', () => {
    const first = reserveGap(900, 1250, 1000)
    const second = reserveGap(900, 1250, 1000)
    expect(reserveGap(801, 1250, 1000)).toBe(151)
    expect(reserveGap(801, 1250, undefined)).toBe(0)
    expect(first).toBe(200)
    expect(second).toBe(first)
  })
})
