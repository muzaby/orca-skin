import { describe, expect, it, vi } from 'vitest'
import { SettingsSchema } from '../../../shared/protocol'
import { SETTINGS_MIRROR_EMPTY_ERROR, createSettingsMirror } from './settings-mirror'

// 0324 EP-17 규칙 칸 4분기.
const base = SettingsSchema.parse({})
const korean = { ...base, language: '한국어-A', spendingLimitUsd: 11 }
const english = { ...base, language: 'English-B', spendingLimitUsd: 22 }

describe('설정 사본 (EP-17)', () => {
  it('사본 전 읽기는 던진다', () => {
    const mirror = createSettingsMirror({ requestWrite: vi.fn() })
    expect(mirror.ready()).toBe(false)
    expect(() => mirror.getAll()).toThrow(SETTINGS_MIRROR_EMPTY_ERROR)
  })

  it('연결 — 전체 사본을 받으면 읽기가 그 사본이다', () => {
    const mirror = createSettingsMirror({ requestWrite: vi.fn() })
    const listener = vi.fn()
    mirror.onPatch(listener)
    mirror.applySnapshot(korean)
    expect(mirror.ready()).toBe(true)
    expect(mirror.getAll()).toEqual(korean)
    // 전체 사본은 변경 통지가 아니다.
    expect(listener).not.toHaveBeenCalled()
  })

  it('패치 — 사본이 바뀌고 구독자가 바뀐 키 목록과 함께 한 번 불린다', () => {
    const mirror = createSettingsMirror({ requestWrite: vi.fn() })
    mirror.applySnapshot(korean)
    const listener = vi.fn()
    mirror.onPatch(listener)
    mirror.applyPatch({ settings: english, changedKeys: ['language'] })
    expect(mirror.getAll().language).toBe('English-B')
    expect(mirror.getAll().spendingLimitUsd).toBe(22)
    expect(listener).toHaveBeenCalledExactlyOnceWith(english, ['language'])
  })

  it('쓰기 — 데이터 호스트에 요청만 하고, 사본은 패치 통지 뒤에 바뀐다', async () => {
    const requestWrite = vi.fn().mockResolvedValue(undefined)
    const mirror = createSettingsMirror({ requestWrite })
    mirror.applySnapshot(korean)
    await mirror.patch({ language: 'English-B' })
    expect(requestWrite).toHaveBeenCalledExactlyOnceWith({ language: 'English-B' })
    expect(mirror.getAll().language).toBe('한국어-A')
    mirror.applyPatch({ settings: english, changedKeys: ['language'] })
    expect(mirror.getAll().language).toBe('English-B')
  })

  it('쓰기 요청이 실패하면 거부하고 사본은 그대로다', async () => {
    const mirror = createSettingsMirror({
      requestWrite: vi.fn().mockRejectedValue(new Error('disk'))
    })
    mirror.applySnapshot(korean)
    await expect(mirror.patch({ language: 'English-B' })).rejects.toThrow('disk')
    expect(mirror.getAll()).toEqual(korean)
  })
})
