// 에이전트 호스트의 설정 사본 (0324 AR-14 · EP-17 · F3).
//
// 설정 파일은 데이터 호스트가 연다. 에이전트 호스트는 피어가 연결될 때 전체를, 바뀔 때 패치 통지를
// 받아 이 사본을 읽는다. 쓰기는 데이터 호스트에 요청하고, 사본은 요청이 아니라 통지로만 바뀐다 —
// 그래야 두 프로세스가 본 값이 한 순서로 정해진다.
//
// 사본을 받기 전의 읽기는 던진다(fail-closed). 기본값으로 답하면 설정을 무시한 턴이 조용히 시작된다.

import { SettingsSchema, type Settings } from '../../../shared/protocol'
import type { SettingsPatchListener } from '../../infra/settings-store'

export const SETTINGS_MIRROR_EMPTY_ERROR = '설정 사본을 아직 받지 못했다'

export interface SettingsMirror {
  getAll(): Settings
  onPatch(listener: SettingsPatchListener): void
  // 데이터 호스트에 쓰기를 요청한다. 사본은 뒤따르는 패치 통지에서 바뀐다.
  patch(input: unknown): Promise<void>
  ready(): boolean
  // 피어 통지 `settings.snapshot` — 연결될 때마다 온다.
  applySnapshot(payload: unknown): void
  // 피어 통지 `settings.patch` — 바뀐 뒤의 전체와 바뀐 최상위 키.
  applyPatch(payload: unknown): void
}

export function createSettingsMirror(deps: {
  requestWrite(patch: unknown): Promise<unknown>
}): SettingsMirror {
  let current: Settings | null = null
  const listeners: SettingsPatchListener[] = []

  return {
    getAll() {
      if (!current) throw new Error(SETTINGS_MIRROR_EMPTY_ERROR)
      return current
    },
    onPatch(listener) {
      listeners.push(listener)
    },
    async patch(input) {
      await deps.requestWrite(input)
    },
    ready: () => current !== null,
    applySnapshot(payload) {
      current = SettingsSchema.parse(payload)
    },
    applyPatch(payload) {
      const { settings, changedKeys } = payload as { settings: unknown; changedKeys: unknown }
      const next = SettingsSchema.parse(settings)
      const keys = Array.isArray(changedKeys)
        ? changedKeys.filter((key): key is string => typeof key === 'string')
        : []
      current = next
      for (const listener of listeners) listener(next, keys)
    }
  }
}
