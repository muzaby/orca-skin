// ID 규칙 SSOT 회귀 (0158 verify r1 D4).
//
// shared 의 IPC 스키마와 main 의 manifest 스키마가 **같은 상수**를 쓰는지 실제 입력으로 고정한다.
// 이 테스트는 main 쪽에 둔다 — shared 는 features 를 import 할 수 없다(main DAG, boundaries).
import { describe, expect, it } from 'vitest'
import {
  PLUGIN_ID_PATTERN,
  PluginConnectionDisconnectRequestSchema,
  PluginConnectorInfoSchema
} from '../../../shared/protocol'
import { parsePluginManifest } from './manifest'
describe('plugin ID 규칙 SSOT', () => {
  const CANDIDATES = [
    'alpha-service',
    'beta-team',
    'alpha2',
    '3rd-party-service',
    '2024-archive',
    'a-1',
    'Alpha-Service',
    'alpha_service',
    'alpha--service',
    '-alpha',
    'alpha-',
    ''
  ]

  function manifestAccepts(id: string): boolean {
    return parsePluginManifest({
      schemaVersion: 1,
      id,
      version: '1.0.0',
      contributes: {}
    }).ok
  }

  function ipcAccepts(id: string): boolean {
    return PluginConnectionDisconnectRequestSchema.safeParse({ connectorId: id }).success
  }

  it.each(CANDIDATES)('manifest 와 IPC 가 같은 판정을 내린다: %j', (id) => {
    expect(ipcAccepts(id)).toBe(manifestAccepts(id))
  })

  it('숫자 선두 ID 도 양쪽 모두 허용한다 (한쪽만 거부하면 등록 후 목록이 죽는다)', () => {
    expect(PLUGIN_ID_PATTERN.test('3rd-party-service')).toBe(true)
    expect(manifestAccepts('3rd-party-service')).toBe(true)
    expect(ipcAccepts('3rd-party-service')).toBe(true)
    expect(
      PluginConnectorInfoSchema.array().safeParse([
        {
          connectorId: '3rd-party-service',
          label: '3rd Party Service',
          origin: 'https://service.example.invalid',
          pluginId: '3rd-party-service',
          acceptedAuthProviders: ['dept-pat'],
          connected: false
        }
      ]).success
    ).toBe(true)
  })
})
