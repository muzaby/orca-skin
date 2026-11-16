// 채널 소유 표 (0324 EP-8′ · AC24′ · §7-F 채널 배치).

import { describe, expect, it } from 'vitest'
import { CHANNEL_OWNER, channelOwner } from './channel-owner'
import { CHANNELS } from './ipc'

describe('channelOwner', () => {
  it('모든 채널에 소유자가 하나 있다 (차집합 0)', () => {
    const channels = Object.keys(CHANNELS).sort()
    const owned = Object.keys(CHANNEL_OWNER).sort()
    expect(owned.filter((key) => !channels.includes(key))).toEqual([])
    expect(channels.filter((key) => !owned.includes(key))).toEqual([])
    for (const name of Object.values(CHANNELS))
      expect(['shell', 'agent', 'data']).toContain(channelOwner(name))
  })

  it('셸이 갖는 채널은 창 조작·부팅 대기·업데이트·로그 수신·알림뿐이다', () => {
    const shell = Object.entries(CHANNEL_OWNER)
      .filter(([, owner]) => owner === 'shell')
      .map(([key]) => key)
      .sort()
    expect(shell).toEqual(
      [
        'bootWhenReady',
        'logEmit',
        'notifyShow',
        'updateCheck',
        'updateDownload',
        'updateProgressEvent',
        'updateQuitAndInstall',
        'updateState',
        'updateStateEvent',
        'windowClose',
        'windowMaximize',
        'windowMinimize'
      ].sort()
    )
  })

  it('실행은 에이전트 호스트, 앱 상태는 데이터 호스트가 갖는다 (D-034 · D-036 · D-038 · D-042)', () => {
    const agent = [
      CHANNELS.chatSend,
      CHANNELS.chatEvent,
      CHANNELS.chatBackgroundState,
      CHANNELS.chatBackgroundEvent,
      CHANNELS.permissionRespond,
      CHANNELS.backendList,
      CHANNELS.engineAdd,
      CHANNELS.extensionCatalog,
      CHANNELS.composerCatalog,
      CHANNELS.gitSnapshot,
      CHANNELS.sessionNativeResources,
      CHANNELS.sessionTitleEvent,
      CHANNELS.concurrencyEvent
    ]
    const data = [
      CHANNELS.sessionLoad,
      CHANNELS.sessionRefresh,
      CHANNELS.projectList,
      CHANNELS.searchMessages,
      CHANNELS.filesReadAttachment,
      CHANNELS.artifactList,
      CHANNELS.settingsGet,
      CHANNELS.mcpList,
      CHANNELS.skillsList,
      CHANNELS.costUsage,
      CHANNELS.costUsageEvent,
      CHANNELS.scheduleList,
      CHANNELS.schedulePromptStart,
      CHANNELS.providerLogin,
      CHANNELS.providerState,
      CHANNELS.errorDrain,
      CHANNELS.errorReportEvent,
      CHANNELS.bootReport
    ]
    for (const name of agent) expect(channelOwner(name), name).toBe('agent')
    for (const name of data) expect(channelOwner(name), name).toBe('data')
    expect(channelOwner(CHANNELS.windowClose)).toBe('shell')
  })

  it('표에 없는 채널 이름은 던진다', () => {
    expect(() => channelOwner('oo:unknown:channel')).toThrow('oo:unknown:channel')
  })
})
