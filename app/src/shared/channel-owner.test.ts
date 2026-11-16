// 채널 소유 표 (0324 EP-8 · AC24).

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
      expect(['shell', 'host']).toContain(channelOwner(name))
  })

  it('셸이 갖는 채널은 창 조작·부팅 대기·업데이트·로그 수신뿐이다', () => {
    const shell = Object.entries(CHANNEL_OWNER)
      .filter(([, owner]) => owner === 'shell')
      .map(([key]) => key)
      .sort()
    expect(shell).toEqual(
      [
        'bootWhenReady',
        'logEmit',
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

  it('채널 이름으로 소유자를 찾는다', () => {
    expect(channelOwner(CHANNELS.chatSend)).toBe('host')
    expect(channelOwner(CHANNELS.chatEvent)).toBe('host')
    expect(channelOwner(CHANNELS.windowClose)).toBe('shell')
  })

  it('표에 없는 채널 이름은 던진다', () => {
    expect(() => channelOwner('oo:unknown:channel')).toThrow('oo:unknown:channel')
  })
})
