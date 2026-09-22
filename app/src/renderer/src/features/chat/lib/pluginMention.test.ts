import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import { pluginMentionCandidates } from './pluginMention'

function provider(overrides: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    id: 'jira-dc',
    label: 'Jira Data Center',
    kind: 'service',
    origin: 'builtin',
    auth: [],
    status: 'none',
    activeAuthKind: null,
    principal: null,
    expiresAt: null,
    tools: ['mcp__jira-dc-tools__jira_searchIssues'],
    catalog: {
      icon: 'electrical_services',
      title: { ko: '지라', en: 'Jira' },
      body: { ko: '이슈', en: 'Issues' },
      attribution: {
        source: 'fixture',
        version: '1.0.0',
        githubUrl: 'https://example.com/plugin'
      }
    },
    ...overrides
  }
}

describe('pluginMentionCandidates', () => {
  it('catalog와 tool이 있는 provider를 인증 상태와 무관하게 id 토큰으로 투영한다', () => {
    const candidates = pluginMentionCandidates([
      provider({ status: 'none' }),
      provider({ id: 'expired-plugin', status: 'expired' }),
      provider({ id: 'unknown-plugin', status: 'unknown' }),
      provider({ id: 'no-catalog', catalog: undefined }),
      provider({ id: 'no-tools', tools: [] })
    ])

    expect(candidates).toEqual([
      { kind: 'plugin', id: 'jira-dc', label: 'Jira Data Center' },
      { kind: 'plugin', id: 'expired-plugin', label: 'Jira Data Center' },
      { kind: 'plugin', id: 'unknown-plugin', label: 'Jira Data Center' },
      { kind: 'plugin', id: 'no-catalog', label: 'Jira Data Center' }
    ])
  })

  it('catalog가 있어도 main이 도구를 싣지 않은 non-Plugin row는 후보가 아니다', () => {
    expect(
      pluginMentionCandidates([
        provider({
          id: 'gate-with-presentation',
          kind: 'gate',
          tools: [],
          catalog: { icon: 'language', title: { ko: '게이트', en: 'Gate' } }
        }),
        provider({ id: 'harness-with-presentation', kind: 'llm', tools: [] })
      ])
    ).toEqual([])
  })

  it('검색은 표시 label이 아니라 provider id와 대소문자 무시 prefix를 사용한다', () => {
    expect(pluginMentionCandidates([provider({ label: 'Issues' })], 'JIRA')).toEqual([
      { kind: 'plugin', id: 'jira-dc', label: 'Issues' }
    ])
    expect(pluginMentionCandidates([provider({ label: 'Jira Data Center' })], 'data')).toEqual([])
  })
})
