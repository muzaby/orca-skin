// SettingsStore 캐시 불변식 (0092) — read(getAll)는 디스크 쓰기를 유발하지 않는다.
// 실제 electron-store 는 electron 런타임이 필요하므로 mock 하고, 주입 backend 로
// `.store` 대입(=디스크 쓰기) 횟수를 계수한다.

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron-store', () => ({ default: class MockElectronStore {} }))

import { SettingsStore, type RawSettingsBackend } from './settings-store'

type Raw = Record<string, unknown>

function countingBackend(initial: Raw = {}): RawSettingsBackend & { writes: number } {
  let raw = initial
  return {
    writes: 0,
    get store(): Raw {
      return raw
    },
    set store(value: Raw) {
      raw = value
      this.writes += 1
    }
  }
}

describe('SettingsStore (0092 — write-on-read 제거)', () => {
  it('getAll 반복 호출은 최초 1회(마이그레이션)만 디스크에 쓴다', () => {
    const backend = countingBackend()
    const store = new SettingsStore('1.0.0', backend)

    const first = store.getAll()
    store.getAll()
    store.getAll()

    expect(backend.writes).toBe(1)
    // 캐시 반환이 매번 같은 내용(동일 참조)이다.
    expect(store.getAll()).toBe(first)
  })

  it('patch 는 쓰기 1회를 추가하고 이후 getAll 은 쓰기 없이 반영값을 돌려준다', () => {
    const backend = countingBackend()
    const store = new SettingsStore('1.0.0', backend)
    const before = store.getAll()
    expect(backend.writes).toBe(1)

    const patched = store.patch({ theme: before.theme })
    expect(backend.writes).toBe(2)

    expect(store.getAll()).toBe(patched)
    expect(backend.writes).toBe(2)
  })

  it('깨진 디스크 데이터는 기본값으로 복원된다 (기존 불변식 유지)', () => {
    const backend = countingBackend({ theme: 12345, garbage: true })
    const store = new SettingsStore('1.0.0', backend)

    const settings = store.getAll()
    expect(typeof settings.theme).toBe('string')
    expect(backend.store).not.toHaveProperty('garbage')
  })
})

// scheduler 는 손으로 쓴 그룹별 병합이라(settings-store.ts mergeSettings) 그룹이 늘 때마다
// 형제 보존이 깨질 수 있다. 0156(updateCheck) 이 그 회귀를 고정한다.
describe('SettingsStore — scheduler 중첩 병합 (0156)', () => {
  it('updateCheck 기본값은 켜짐 + 6시간이다', () => {
    const store = new SettingsStore('1.0.0', countingBackend())

    expect(store.getAll().scheduler.updateCheck).toEqual({ enabled: true, intervalHours: 6 })
  })

  it('updateCheck 부분 패치가 usageRecompute 와 자기 형제 필드를 보존한다', () => {
    const store = new SettingsStore('1.0.0', countingBackend())
    const before = store.getAll()

    const next = store.patch({ scheduler: { updateCheck: { intervalHours: 12 } } })

    expect(next.scheduler.updateCheck).toEqual({ enabled: true, intervalHours: 12 })
    expect(next.scheduler.usageRecompute).toEqual(before.scheduler.usageRecompute)
  })

  it('usageRecompute 패치가 updateCheck 를 되돌리지 않는다', () => {
    const store = new SettingsStore('1.0.0', countingBackend())
    store.patch({ scheduler: { updateCheck: { enabled: false, intervalHours: 24 } } })

    const next = store.patch({ scheduler: { usageRecompute: { enabled: true } } })

    expect(next.scheduler.updateCheck).toEqual({ enabled: false, intervalHours: 24 })
    expect(next.scheduler.usageRecompute.enabled).toBe(true)
  })

  it('허용되지 않는 intervalHours 가 디스크에 있으면 기본값으로 복원된다', () => {
    const backend = countingBackend({
      scheduler: {
        usageRecompute: { enabled: true, cron: '0 */1 * * *' },
        updateCheck: { enabled: true, intervalHours: 7 }
      }
    })
    const store = new SettingsStore('1.0.0', backend)

    expect(store.getAll().scheduler.updateCheck).toEqual({ enabled: true, intervalHours: 6 })
  })

  it('허용되지 않는 intervalHours 패치는 거부된다', () => {
    const store = new SettingsStore('1.0.0', countingBackend())

    expect(() => store.patch({ scheduler: { updateCheck: { intervalHours: 7 } } })).toThrow()
  })
})
