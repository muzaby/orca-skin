import { describe, expect, it } from 'vitest'
import type { HostToShell } from '../../../shared/host-protocol'
import type { SettingsPatchListener } from '../../infra/settings-store'
import { watchShellLocale } from './shell-locale'

// 0324 EP-14 — 셸의 UI 언어 사본은 데이터 호스트의 설정 패치에서 온다.
describe('셸 UI 언어 사본 알림', () => {
  it('uiLocale 이 바뀐 패치만 셸에 알린다', () => {
    let listener!: SettingsPatchListener
    const sent: HostToShell[] = []
    watchShellLocale({ onPatch: (next) => (listener = next) }, (message) => sent.push(message))
    listener({ uiLocale: 'en' } as never, ['theme'])
    expect(sent).toEqual([])
    listener({ uiLocale: 'en' } as never, ['theme', 'uiLocale'])
    expect(sent).toEqual([{ type: 'shell.mirror', mirror: { uiLocale: 'en' } }])
  })
})
