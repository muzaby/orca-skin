import { describe, it, expect } from 'vitest'
import { MODE_LABEL_KEYS, MODE_MENU_OPTIONS, MODE_OPTIONS } from './modes'
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
  it('정규화 6종 전부에 옵션과 라벨 키가 존재한다 (파생 완전성)', () => {
    expect(MODE_OPTIONS.map((o) => o.mode).sort()).toEqual([...NORMALIZED_MODES].sort())
    for (const mode of NORMALIZED_MODES) {
      expect(MODE_LABEL_KEYS[mode]).toBeTruthy()
      expect(koLeaf(MODE_LABEL_KEYS[mode]), `label ${mode}`).toBeTruthy()
    }
    for (const opt of MODE_OPTIONS) {
      if (opt.descKey) expect(koLeaf(opt.descKey), `desc ${opt.mode}`).toBeTruthy()
    }
  })

  it('메뉴는 5종을 이 순서로 내건다 — dont_ask 는 칩 라벨용 카탈로그에만 남는다', () => {
    expect(MODE_MENU_OPTIONS.map((o) => o.mode)).toEqual([
      'auto_classified',
      'default',
      'accept_edits',
      'plan',
      'bypass'
    ])
    expect(MODE_OPTIONS.find((o) => o.mode === 'dont_ask')?.hidden).toBe(true)
  })

  it('ko 라벨은 메뉴 사양과 일치한다', () => {
    expect(koLeaf(MODE_LABEL_KEYS.auto_classified)).toBe('자동')
    expect(koLeaf(MODE_LABEL_KEYS.default)).toBe('수동')
    expect(koLeaf(MODE_LABEL_KEYS.accept_edits)).toBe('편집 자동 수락')
    expect(koLeaf(MODE_LABEL_KEYS.plan)).toBe('계획')
    expect(koLeaf(MODE_LABEL_KEYS.bypass)).toBe('권한 무시')
  })

  it('권한 무시는 설명 없이 라벨만 갖는다 (경고는 2-스텝 확인이 진다)', () => {
    expect(MODE_OPTIONS.find((o) => o.mode === 'bypass')?.descKey).toBeUndefined()
    expect(MODE_OPTIONS.find((o) => o.mode === 'bypass')?.risky).toBe(true)
  })
})
