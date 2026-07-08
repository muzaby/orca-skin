// Settings 영속화 (TRD §6.7, §10 "재시작 재개").
// electron-store 를 단일 객체 스토어로 사용하며, 모든 read/write 가 zod 검증을 통과한다.
// 깨진 디스크 데이터(수동 편집·옛 버전·partial 누락 등) 는 default 로 복원되어 부팅을 막지 않는다.

import Store from 'electron-store'
import {
  SettingsSchema,
  SettingsPatchSchema,
  type Settings,
  type SettingsPatch
} from '../../shared/protocol'
import { migrateRawSettings } from './settings-migration'

type Raw = Record<string, unknown>

export class SettingsStore {
  constructor(private readonly currentAppVersion = 'unknown') {}
  private readonly store = new Store<Raw>({
    name: 'orca-settings',
    defaults: SettingsSchema.parse({}) as Raw
  })

  private migrate(): Settings {
    const migrated = migrateRawSettings(this.store.store, this.currentAppVersion)
    this.store.store = migrated.raw
    return migrated.settings
  }

  getAll(): Settings {
    return this.migrate()
  }

  patch(input: unknown): Settings {
    const patch: SettingsPatch = SettingsPatchSchema.parse(input)
    const current = this.getAll()
    const next = SettingsSchema.parse({ ...current, ...patch })
    this.store.store = migrateRawSettings(next as Raw, this.currentAppVersion).raw
    return next
  }
}
