import { describe, expect, it } from 'vitest'
import { DEFAULT_PLUGIN_CATALOG_ICON, normalizePluginCatalogPresentation } from './plugin-catalog'

describe('plugin catalog presentation', () => {
  it('미설정 icon을 electrical_services로 한 번 정규화한다', () => {
    expect(DEFAULT_PLUGIN_CATALOG_ICON).toBe('electrical_services')
    expect(normalizePluginCatalogPresentation()).toEqual({
      icon: 'electrical_services'
    })
  })

  it('허용 icon과 ko/en 및 추가 locale를 보존한다', () => {
    expect(
      normalizePluginCatalogPresentation({
        icon: 'language',
        title: { ko: '제목', en: 'Title', 'pt-BR': 'Título' },
        body: { ko: '본문', en: 'Body' },
        attribution: {
          source: '@example/plugin',
          version: '1.2.3',
          githubUrl: 'https://github.com/example/plugin',
          license: 'MIT'
        }
      })
    ).toEqual({
      icon: 'language',
      title: { ko: '제목', en: 'Title', 'pt-BR': 'Título' },
      body: { ko: '본문', en: 'Body' },
      attribution: {
        source: '@example/plugin',
        version: '1.2.3',
        githubUrl: 'https://github.com/example/plugin',
        license: 'MIT'
      }
    })
  })

  it.each([
    [{ title: { ko: ' ', en: 'Title' } }, 'title.ko'],
    [{ body: { ko: '본문', en: '' } }, 'body.en'],
    [{ icon: 'unknown' }, 'icon']
  ])('공백 번역과 비허용 icon을 거부한다: %o', (input, field) => {
    expect(() => normalizePluginCatalogPresentation(input as never)).toThrow(field)
  })
})
