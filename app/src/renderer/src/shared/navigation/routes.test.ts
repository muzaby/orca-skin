import { describe, expect, it } from 'vitest'
import { en } from '../i18n/resources/en'
import { ko } from '../i18n/resources/ko'
import { ROUTES } from './routes'

const resolve = (catalog: object, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)[part]
          : undefined,
      catalog
    )
describe('route catalog', () => {
  it('모달인 플러그인 카탈로그는 ROUTES 에 없다', () =>
    expect(ROUTES.map((route) => String(route.pattern))).not.toContain('/plugins'))
  it('ROUTES 의 모든 labelKey·breadcrumbKey 가 ko·en 에서 해석된다', () => {
    for (const route of ROUTES)
      for (const key of [route.labelKey, route.breadcrumbKey])
        if (key)
          for (const catalog of [ko, en]) expect(resolve(catalog, key)).toEqual(expect.any(String))
  })
})
