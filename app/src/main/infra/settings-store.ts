// Settings 영속화 (TRD §6.7, §10 "재시작 재개").
// electron-store 를 단일 객체 스토어로 사용하며, 모든 read/write 가 zod 검증을 통과한다.
// 깨진 디스크 데이터(수동 편집·옛 버전·partial 누락 등) 는 default 로 복원되어 부팅을 막지 않는다.
//
// 디스크 마이그레이션+쓰기는 최초 접근 1회와 patch() 뿐이다 — electron-store 의 `.store` 대입은
// 매번 동기 디스크 쓰기라, read 마다 수행하면 hot path(턴당 2회+)가 write-on-read 가 된다(0092).
// 트레이드오프: 앱 실행 중 설정 파일 수동 편집은 반영되지 않는다(쓰기는 앱 UI 단일 경로).

import Store from 'electron-store'
import {
  SettingsSchema,
  SettingsPatchSchema,
  type Settings,
  type SettingsPatch
} from '../../shared/protocol'
import { migrateRawSettings } from './settings-migration'
import { assertValidCron } from './cron'

type Raw = Record<string, unknown>

// SettingsStore 가 쓰는 electron-store 표면 — 테스트가 인메모리 구현으로 대체한다.
export interface RawSettingsBackend {
  store: Raw
}

export class SettingsStore {
  private readonly store: RawSettingsBackend
  private cached: Settings | null = null

  constructor(
    private readonly currentAppVersion = 'unknown',
    backend?: RawSettingsBackend
  ) {
    this.store =
      backend ??
      new Store<Raw>({
        name: 'orca-settings',
        defaults: SettingsSchema.parse({}) as Raw
      })
  }

  // 최초 접근 시 1회만 디스크 마이그레이션+쓰기, 이후 read 는 메모리 캐시.
  private load(): Settings {
    if (this.cached) return this.cached
    const migrated = migrateRawSettings(this.store.store, this.currentAppVersion)
    this.store.store = migrated.raw
    this.cached = migrated.settings
    return migrated.settings
  }

  getAll(): Settings {
    return this.load()
  }

  patch(input: unknown): Settings {
    const patch: SettingsPatch = SettingsPatchSchema.parse(input)
    const current = this.load()
    const next = mergeSettings(current, patch)
    assertValidCron(next.scheduler.usageRecompute.cron)
    const migrated = migrateRawSettings(next as unknown as Raw, this.currentAppVersion)
    this.store.store = migrated.raw
    this.cached = migrated.settings
    return migrated.settings
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
