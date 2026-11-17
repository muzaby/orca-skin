// 셸의 UI 언어 사본 알림 (0324 D-032 · F5 · EP-14). 설정은 데이터 호스트가 갖는다 — 트레이 메뉴처럼
// 셸이 그리는 문구는 셸 상태 파일의 사본으로 읽으므로, `uiLocale` 이 바뀔 때만 셸에 알린다. 기동 때의
// 사본은 준비 메시지(`ready.mirror`)가 싣는다.

import type { HostToShell } from '../../../shared/host-protocol'
import type { SettingsPatchListener } from '../../infra/settings-store'

export function watchShellLocale(
  settings: { onPatch(listener: SettingsPatchListener): void },
  toShell: (message: HostToShell) => void
): void {
  settings.onPatch((next, changedKeys) => {
    if (changedKeys.includes('uiLocale'))
      toShell({ type: 'shell.mirror', mirror: { uiLocale: next.uiLocale } })
  })
}
