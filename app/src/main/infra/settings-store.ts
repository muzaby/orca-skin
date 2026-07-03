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

type Raw = Record<string, unknown>

function readSafe(raw: Raw): Settings {
  const parsed = SettingsSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  // 일부 키만 깨졌어도 default 가 채워지도록 빈 객체로 fallback.
  return SettingsSchema.parse({})
}

export class SettingsStore {
  private readonly store = new Store<Raw>({
    name: 'orca-settings',
    defaults: SettingsSchema.parse({}) as Raw
  })

  getAll(): Settings {
    return readSafe(this.store.store)
  }

  patch(input: unknown): Settings {
    const patch: SettingsPatch = SettingsPatchSchema.parse(input)
    const current = this.getAll()
    const next = SettingsSchema.parse({ ...current, ...patch })
    this.store.store = next as Raw
    return next
  }
}
