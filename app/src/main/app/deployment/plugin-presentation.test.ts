import { describe, expect, it } from 'vitest'
import { DEFAULT_PLUGIN_ICON } from '../../../shared/plugin-catalog'
import { normalizePluginCatalogPresentation } from './plugins'

describe('normalizePluginCatalogPresentation', () => {
  it('유효 local icon과 own nonblank locale copy만 새 객체로 소유한다', () => {
    const inherited = { ja: { title: '継承', body: '継承本文' } }
    const copy = Object.assign(Object.create(inherited) as Record<string, unknown>, {
      ko: { title: '지라', body: '이슈를 조회하고 변경합니다.' },
      en: { title: 'Jira', body: 'Manage Jira issues.' },
      emptyTitle: { title: ' ', body: 'body' },
      emptyBody: { title: 'title', body: '' },
      invalid: null
    })
    const input = { icon: 'bolt', copy } as const

    const normalized = normalizePluginCatalogPresentation(input as never)

    expect(normalized).toEqual({
      icon: 'bolt',
      copy: {
        ko: { title: '지라', body: '이슈를 조회하고 변경합니다.' },
        en: { title: 'Jira', body: 'Manage Jira issues.' }
      }
    })
    expect(normalized.copy).not.toBe(copy)
    expect(normalized.copy.ko).not.toBe(copy.ko)
    expect(normalized.copy).not.toHaveProperty('ja')
  })

  it.each([undefined, 'unknown', 'https://example.com/icon.svg', '<svg/>'])(
    'icon=%s는 electricalServices로 fallback한다',
    (icon) => {
      expect(normalizePluginCatalogPresentation({ icon } as never)).toEqual({
        icon: DEFAULT_PLUGIN_ICON,
        copy: {}
      })
    }
  )
})
