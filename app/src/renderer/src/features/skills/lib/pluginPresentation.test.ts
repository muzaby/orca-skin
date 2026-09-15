import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import { pluginPresentation } from './pluginPresentation'

const provider = (copy: NonNullable<ProviderInfo['plugin']>['copy']): ProviderInfo => ({
  id: 'jira',
  label: 'Jira Auth',
  kind: 'service',
  origin: 'https://jira.example.corp',
  auth: [],
  activeAuthKind: null,
  status: 'valid',
  principal: null,
  expiresAt: null,
  tools: [],
  plugin: { icon: 'electricalServices', copy }
})

describe('pluginPresentation locale fallback', () => {
  const copies = {
    ko: { title: '한국어', body: '한국어 본문' },
    en: { title: 'English', body: 'English body' },
    'en-US': { title: 'US English', body: 'US body' },
    fr: { title: 'Français', body: 'Texte français' }
  }

  it.each([
    ['en-US', 'US English'],
    ['en_US', 'US English'],
    ['en-GB', 'English'],
    ['de-DE', '한국어'],
    ['ko-KR', '한국어']
  ])('%s에서 %s를 선택한다', (locale, title) => {
    expect(pluginPresentation(provider(copies), locale).title).toBe(title)
  })

  it('ko/en이 없으면 insertion order 첫 유효 copy를 사용한다', () => {
    expect(
      pluginPresentation(
        provider({
          fr: { title: 'Français', body: 'Texte français' },
          de: { title: 'Deutsch', body: 'Deutscher Text' }
        }),
        'es'
      )
    ).toMatchObject({ title: 'Français', body: 'Texte français' })
  })

  it('plugin copy가 없으면 auth label과 body null로 fallback한다', () => {
    expect(pluginPresentation(provider({}), 'ko')).toEqual({
      icon: 'electricalServices',
      title: 'Jira Auth',
      body: null
    })
  })

  it('non-plugin legacy row는 power icon과 auth label을 유지한다', () => {
    const legacy = provider({})
    delete legacy.plugin
    expect(pluginPresentation(legacy, 'ko')).toEqual({
      icon: 'power',
      title: 'Jira Auth',
      body: null
    })
  })
})
