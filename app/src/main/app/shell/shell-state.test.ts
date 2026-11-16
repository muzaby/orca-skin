import { describe, expect, it, vi } from 'vitest'
import { ShellState, type ShellStateBackend, type ShellStateRecord } from './shell-state'

// 0324 EP-14 규칙 칸 — 분기마다 한 케이스.

const BOUNDS = { x: 11, y: 22, width: 1333, height: 777 }
const OTHER_BOUNDS = { x: 5, y: 6, width: 800, height: 600 }

function backend(initial?: unknown): ShellStateBackend & {
  written: ShellStateRecord[]
  read: ReturnType<typeof vi.fn>
} {
  let current = initial
  const written: ShellStateRecord[] = []
  return {
    written,
    read: vi.fn(() => current),
    write(record) {
      written.push(record)
      current = record
    }
  }
}

describe('ShellState', () => {
  it('셸 상태 파일에 값이 있으면 그 값을 쓰고 기존 설정 파일을 읽지 않는다', () => {
    const legacy = vi.fn(() => ({ windowBounds: OTHER_BOUNDS, uiLocale: 'ko' }))
    const file = backend({ windowBounds: BOUNDS, uiLocale: 'en' })
    const state = new ShellState(file, legacy)
    expect(state.windowBounds()).toEqual(BOUNDS)
    expect(state.getAll()).toEqual({ uiLocale: 'en' })
    expect(legacy).not.toHaveBeenCalled()
    expect(file.written).toEqual([])
  })

  it('셸 상태 파일이 없으면 기존 설정 파일의 창 위치와 언어를 이어받아 자기 파일에만 쓴다', () => {
    const settings = { windowBounds: BOUNDS, uiLocale: 'en', theme: 'dark' }
    const before = JSON.stringify(settings)
    const file = backend(undefined)
    const state = new ShellState(file, () => settings)
    expect(state.windowBounds()).toEqual(BOUNDS)
    expect(state.getAll()).toEqual({ uiLocale: 'en' })
    expect(file.written).toEqual([{ windowBounds: BOUNDS, uiLocale: 'en' }])
    expect(JSON.stringify(settings)).toBe(before)
  })

  it.each([
    ['설정 파일도 없다', () => undefined],
    [
      '설정 파일이 JSON 이 아니다',
      () => {
        throw new SyntaxError('Unexpected token')
      }
    ],
    ['설정 파일의 값이 형식에 맞지 않는다', () => ({ windowBounds: { x: 'a' }, uiLocale: 'fr' })]
  ])('이어받을 것이 없으면 기본값이고 쓰지 않는다 — %s', (_label, legacy) => {
    const file = backend(undefined)
    const state = new ShellState(file, legacy)
    expect(state.windowBounds()).toBeNull()
    expect(state.getAll()).toEqual({ uiLocale: 'ko' })
    expect(file.written).toEqual([])
  })

  it('창 위치 저장은 창 위치만 바꾼다', () => {
    const file = backend({ windowBounds: BOUNDS, uiLocale: 'en' })
    const state = new ShellState(file, () => undefined)
    state.saveWindowBounds(OTHER_BOUNDS)
    expect(file.written).toEqual([{ windowBounds: OTHER_BOUNDS, uiLocale: 'en' }])
    expect(state.windowBounds()).toEqual(OTHER_BOUNDS)
  })

  it('언어 알림은 값이 바뀔 때만 저장하고 구독자에게 알린다', () => {
    const file = backend({ windowBounds: BOUNDS, uiLocale: 'ko' })
    const state = new ShellState(file, () => undefined)
    const listener = vi.fn()
    state.onPatch(listener)

    state.mirrorUiLocale('ko')
    expect(file.written).toEqual([])
    expect(listener).not.toHaveBeenCalled()

    state.mirrorUiLocale('en')
    expect(file.written).toEqual([{ windowBounds: BOUNDS, uiLocale: 'en' }])
    expect(listener).toHaveBeenCalledExactlyOnceWith({ uiLocale: 'en' }, ['uiLocale'])
    expect(state.getAll()).toEqual({ uiLocale: 'en' })
  })
})
