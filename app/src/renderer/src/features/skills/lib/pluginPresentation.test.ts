import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import { pluginPresentation, resolveLocalizedPluginText } from './pluginPresentation'
import { providerPresentation, resolveLocalizedProviderText } from './providerPresentation'

const provider = (catalog?: ProviderInfo['catalog']): ProviderInfo => ({
  id: 'jira',
  label: 'Jira Auth',
  kind: 'service',
  origin: 'https://jira.example.com',
  auth: [],
  status: 'none',
  activeAuthKind: null,
  principal: null,
  expiresAt: null,
  tools: [],
  ...(catalog ? { catalog } : {})
})

describe('plugin presentation locale fallback', () => {
  const text = { ko: '한국어', en: 'English', pt: 'Português', 'pt-BR': 'Brasil' }

  it.each([
    ['pt-BR', 'Brasil'],
    ['pt-PT', 'Português'],
    ['fr-FR', '한국어'],
    ['en-US', 'English']
  ])('%s는 exact → base → ko → en 순서다', (locale, expected) => {
    expect(resolveLocalizedPluginText(text, locale)).toBe(expected)
  })

  it('canonical provider resolver와 기존 Plugin alias가 같은 결과를 낸다', () => {
    expect(resolveLocalizedProviderText(text, 'pt-PT')).toBe(
      resolveLocalizedPluginText(text, 'pt-PT')
    )
    expect(providerPresentation(provider(), 'ko')).toEqual(pluginPresentation(provider(), 'ko'))
  })

  it('catalog가 없으면 non-Plugin 표시를 유지한다', () => {
    expect(pluginPresentation(provider(), 'ko')).toEqual({
      icon: 'power',
      title: 'Jira Auth'
    })
  })

  it('localized title/body와 attribution을 표시 모델로 만든다', () => {
    expect(
      pluginPresentation(
        provider({
          icon: 'electrical_services',
          title: { ko: '지라', en: 'Jira' },
          body: { ko: '이슈 도구', en: 'Issue tools' },
          attribution: {
            source: '@atlassian-dc-mcp/jira',
            version: '0.34.0',
            githubUrl: 'https://github.com/b1ff/atlassian-dc-mcp',
            license: 'MIT'
          }
        }),
        'ko'
      )
    ).toMatchObject({
      icon: 'electricalServices',
      title: '지라',
      body: '이슈 도구',
      attribution: { version: '0.34.0' }
    })
  })
})
