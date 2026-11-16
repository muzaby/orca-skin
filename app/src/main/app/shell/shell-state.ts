// 셸 상태 (0324 D-029·D-032) — main(셸)이 쓰는 값은 main 이 소유하는 파일 하나에 둔다.
//
// 설정 파일은 에이전트 호스트만 연다. 두 프로세스가 같은 파일을 열면 메모리 캐시 + 통째 쓰기라
// 서로의 쓰기를 덮는다. 셸이 실제로 쓰는 값은 둘이다 — 창 위치(셸이 정본)와 UI 언어(정본은
// 호스트의 설정, 여기는 호스트가 뜨기 전 트레이 라벨에 쓰는 사본).
//
// 이 파일은 electron·electron-store 를 물지 않는다 — 파일 배선은 `shell-state-file.ts`.

import { z } from 'zod'
import { WindowBoundsSchema } from '../../../shared/protocol'
import type { WindowBounds } from '../../../shared/ipc'

export type ShellLocale = 'ko' | 'en'
const DEFAULT_LOCALE: ShellLocale = 'ko'
const LocaleSchema = z.enum(['ko', 'en'])

const RecordSchema = z.object({
  windowBounds: WindowBoundsSchema.nullable(),
  uiLocale: LocaleSchema
})
export type ShellStateRecord = z.infer<typeof RecordSchema>

export interface ShellStateBackend {
  // 파일이 없거나 읽을 수 없으면 undefined.
  read(): unknown
  write(record: ShellStateRecord): void
}

type LocaleListener = (next: { uiLocale: ShellLocale }, changedKeys: readonly string[]) => void

export class ShellState {
  private cached: ShellStateRecord | null = null
  private readonly listeners: LocaleListener[] = []

  constructor(
    private readonly backend: ShellStateBackend,
    // 셸 상태 파일이 없는 첫 실행에만 부른다 — 기존 설정 파일의 내용(읽기 전용). 던져도 된다.
    private readonly readLegacySettings: () => unknown
  ) {}

  private load(): ShellStateRecord {
    if (this.cached) return this.cached
    const own = RecordSchema.safeParse(this.backend.read())
    if (own.success) return (this.cached = own.data)
    this.cached = this.inherit()
    return this.cached
  }

  // 기존 설정 파일에서 창 위치와 언어를 이어받는다. 이어받은 것이 있을 때만 쓴다 — 아무것도
  // 못 읽은 실행은 다음 실행이 다시 시도한다.
  private inherit(): ShellStateRecord {
    let legacy: unknown
    try {
      legacy = this.readLegacySettings()
    } catch {
      legacy = undefined
    }
    const source = (typeof legacy === 'object' && legacy !== null ? legacy : {}) as Record<
      string,
      unknown
    >
    const bounds = WindowBoundsSchema.safeParse(source.windowBounds)
    const locale = LocaleSchema.safeParse(source.uiLocale)
    const record: ShellStateRecord = {
      windowBounds: bounds.success ? bounds.data : null,
      uiLocale: locale.success ? locale.data : DEFAULT_LOCALE
    }
    if (bounds.success || locale.success) this.backend.write(record)
    return record
  }

  windowBounds(): WindowBounds | null {
    return this.load().windowBounds
  }

  saveWindowBounds(bounds: WindowBounds): void {
    this.cached = { ...this.load(), windowBounds: bounds }
    this.backend.write(this.cached)
  }

  // `tray-residency` 의 설정 포트(`getAll`·`onPatch`)를 구조적으로 만족한다.
  getAll(): { uiLocale: ShellLocale } {
    return { uiLocale: this.load().uiLocale }
  }

  onPatch(listener: LocaleListener): void {
    this.listeners.push(listener)
  }

  // 호스트가 알린 UI 언어. 같은 값이면 쓰지도 알리지도 않는다.
  mirrorUiLocale(uiLocale: ShellLocale): void {
    const current = this.load()
    if (current.uiLocale === uiLocale) return
    this.cached = { ...current, uiLocale }
    this.backend.write(this.cached)
    for (const listener of this.listeners) listener({ uiLocale }, ['uiLocale'])
  }
}
