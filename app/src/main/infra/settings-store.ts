// Settings 영속화 (TRD §6.7, §10 "재시작 재개").
// electron-store 를 단일 객체 스토어로 사용하며, 모든 read/write 가 zod 검증을 통과한다.
// 깨진 디스크 데이터(수동 편집·옛 버전·partial 누락 등) 는 default 로 복원되어 부팅을 막지 않는다.
//
// 디스크 마이그레이션+쓰기는 최초 접근 1회와 patch() 뿐이다 — electron-store 의 `.store` 대입은
// 매번 동기 디스크 쓰기라, read 마다 수행하면 hot path(턴당 2회+)가 write-on-read 가 된다(0092).
// 트레이드오프: 앱 실행 중 설정 파일 수동 편집은 반영되지 않는다(쓰기는 앱 UI 단일 경로).

import Store from 'electron-store'
import type { Backend } from '../../shared/ipc'
import {
  SettingsSchema,
  SettingsPatchSchema,
  type Settings,
  type SettingsPatch
} from '../../shared/protocol'
import { migrateRawSettings, SETTINGS_VERSION, SETTINGS_VERSION_KEY } from './settings-migration'
import { assertValidCron } from './cron'
import { PRODUCT_SLUG } from '../../shared/product'

type Raw = Record<string, unknown>

// SettingsStore 가 쓰는 electron-store 표면 — 테스트가 인메모리 구현으로 대체한다.
export interface RawSettingsBackend {
  store: Raw
}

// 설정이 **다른 상태의 입력**일 때 그 상태를 소유한 쪽이 다시 밀어 주도록 하는 통지.
// `changedKeys` 는 이번 patch 가 실제로 건드린 최상위 키다.
export type SettingsPatchListener = (next: Settings, changedKeys: readonly string[]) => void

export class SettingsStore {
  private readonly store: RawSettingsBackend
  private cached: Settings | null = null
  private readonly listeners: SettingsPatchListener[] = []

  // `source` 는 파일을 둘 디렉토리(`cwd`) 또는 테스트용 인메모리 backend 다. 경로를 생략할 수
  // 없다 — `electron-store` 는 `app` 이 없는 프로세스에서 `cwd` 없이 열면 예외 없이 다른
  // 디렉토리에 쓴다(0324 D-031).
  constructor(
    private readonly currentAppVersion: string,
    source: RawSettingsBackend | { cwd: string }
  ) {
    this.store =
      'cwd' in source
        ? new Store<Raw>({
            name: `${PRODUCT_SLUG}-settings`,
            cwd: source.cwd,
            defaults: SettingsSchema.parse({}) as Raw
          })
        : source
  }

  // 최초 접근 시 1회만 디스크 마이그레이션+쓰기, 이후 read 는 메모리 캐시.
  private load(): Settings {
    if (this.cached) return this.cached
    const migrated = migrateRawSettings(this.store.store, this.currentAppVersion)
    this.store.store = migrated.raw
    this.cached = migrated.settings
    return migrated.settings
  }

  setNativeExtensionChoices(choices: NonNullable<Settings['nativeExtensionChoices']>): void {
    const next = SettingsSchema.parse({ ...this.load(), nativeExtensionChoices: choices })
    this.save(next)
  }

  setNativeExtensionChoice(backend: Backend, key: string, enabled: boolean): number {
    this.load()
    const raw = this.store.store
    const current = migrateRawSettings(raw, this.currentAppVersion).settings
    const choices = current.nativeExtensionChoices ?? {}
    const revision = (current.nativeExtensionRevision ?? 0) + 1
    const next = {
      ...current,
      nativeExtensionChoices: { ...choices, [backend]: { ...choices[backend], [key]: enabled } },
      nativeExtensionRevision: revision
    }
    this.store.store = {
      ...raw,
      nativeExtensionChoices: next.nativeExtensionChoices,
      nativeExtensionRevision: revision
    }
    this.cached = next
    for (const listener of this.listeners)
      listener(next, ['nativeExtensionChoices', 'nativeExtensionRevision'])
    return revision
  }

  private save(next: Settings): Settings {
    const migrated = migrateRawSettings(
      { ...next, [SETTINGS_VERSION_KEY]: SETTINGS_VERSION },
      this.currentAppVersion
    )
    this.store.store = migrated.raw
    this.cached = migrated.settings
    return migrated.settings
  }

  getAll(): Settings {
    return this.load()
  }

  // 파생 상태를 소유한 쪽이 부팅에서 한 번 등록한다 — IPC 핸들러가 "이 키가 바뀌면 저 feature
  // 를 깨워야 한다" 를 알 필요가 없어진다(모르면 다음 파생 설정에서 같은 누락이 반복된다).
  onPatch(listener: SettingsPatchListener): void {
    this.listeners.push(listener)
  }

  patch(input: unknown, movedChoice?: { from: string; to?: string }): Settings {
    const patch: SettingsPatch = SettingsPatchSchema.parse(input)
    const current = this.load()
    const next = mergeSettings(current, patch)
    const changedKeys = Object.keys(patch)
    if (movedChoice && next.nativeExtensionChoices) {
      let changed = false
      for (const choices of Object.values(next.nativeExtensionChoices)) {
        if (!Object.hasOwn(choices, movedChoice.from)) continue
        if (movedChoice.to) choices[movedChoice.to] = choices[movedChoice.from]
        delete choices[movedChoice.from]
        changed = true
      }
      if (changed) {
        next.nativeExtensionRevision = (current.nativeExtensionRevision ?? 0) + 1
        changedKeys.push('nativeExtensionChoices', 'nativeExtensionRevision')
      }
    }
    assertValidCron(next.scheduler.usageRecompute.cron)
    const saved = this.save(next)
    // 키 목록은 **입력 patch** 에서 뽑는다 — 병합 결과와 비교하면 값이 같은 재지정이 빠진다.
    for (const listener of this.listeners) listener(saved, changedKeys)
    return saved
  }
}

// scheduler 하위는 한 겹 그룹이라 top-level spread 로는 부분 패치가 형제 그룹을 통째로 덮어쓴다.
// 그룹 단위로 병합해야 한 그룹만 보내도 나머지가 살아남는다.
function mergeGroup<T>(current: T, patch: Partial<T> | undefined): T {
  return patch ? { ...current, ...patch } : current
}

function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  return SettingsSchema.parse({
    ...current,
    ...patch,
    harnesses: {
      ...current.harnesses,
      ...Object.fromEntries(
        Object.entries(patch.harnesses ?? {}).map(([id, preferences]) => [
          id,
          { ...current.harnesses?.[id as keyof NonNullable<Settings['harnesses']>], ...preferences }
        ])
      )
    },
    scheduler: patch.scheduler
      ? {
          usageRecompute: mergeGroup(
            current.scheduler.usageRecompute,
            patch.scheduler.usageRecompute
          ),
          updateCheck: mergeGroup(current.scheduler.updateCheck, patch.scheduler.updateCheck)
        }
      : current.scheduler
  })
}
