import { describe, it, expect } from 'vitest'
import { MODE_LABEL_KEYS, MODE_OPTIONS } from './modes'
import { NORMALIZED_MODES } from '../../../../../../shared/permission-mode'
import { ko } from '../../../../shared/i18n/resources/ko'

// ko 카탈로그 dot-path 리프 해석 — 키맵 완전성 검증용(toolMeta.test 와 동일 패턴).
function koLeaf(path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        typeof acc === 'object' && acc !== null ? (acc as Record<string, unknown>)[key] : undefined,
      ko
    )
  return typeof value === 'string' ? value : undefined
}

describe('MODE_OPTIONS / MODE_LABEL_KEYS', () => {
  it('정규화 6종 전부에 옵션과 라벨/설명 키가 존재한다 (파생 완전성)', () => {
    expect(MODE_OPTIONS.map((o) => o.mode).sort()).toEqual([...NORMALIZED_MODES].sort())
    for (const mode of NORMALIZED_MODES) {
      expect(MODE_LABEL_KEYS[mode]).toBeTruthy()
      expect(koLeaf(MODE_LABEL_KEYS[mode]), `label ${mode}`).toBeTruthy()
    }
    for (const opt of MODE_OPTIONS) {
      expect(koLeaf(opt.descKey), `desc ${opt.mode}`).toBeTruthy()
    }
  })

  it('ko 라벨은 마이그레이션 전과 동일하다', () => {
    expect(koLeaf(MODE_LABEL_KEYS.plan)).toBe('계획')
    expect(koLeaf(MODE_LABEL_KEYS.default)).toBe('기본')
    expect(koLeaf(MODE_LABEL_KEYS.bypass)).toBe('권한 우회')
  })
})
