import { describe, it, expect } from 'vitest'
import { MODE_LABELS, MODE_OPTIONS } from './modes'
import { NORMALIZED_MODES } from '../../../../../../shared/permission-mode'

describe('MODE_OPTIONS / MODE_LABELS', () => {
  it('정규화 6종 전부에 옵션과 라벨이 존재한다 (파생 완전성)', () => {
    expect(MODE_OPTIONS.map((o) => o.mode).sort()).toEqual([...NORMALIZED_MODES].sort())
    for (const mode of NORMALIZED_MODES) {
      expect(MODE_LABELS[mode]).toBeTruthy()
    }
  })
})
