import { describe, expect, it } from 'vitest'
import { en } from '../i18n/resources/en'
import { ko } from '../i18n/resources/ko'
import { LEGACY_ROUTE_REDIRECTS, ROUTES } from './routes'

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
  it("'/plugins' 패턴이 ROUTES 에 있다", () =>
    expect(ROUTES.some((route) => route.pattern === '/plugins')).toBe(true))
  it('ROUTES 의 모든 labelKey·breadcrumbKey 가 ko·en 에서 해석된다', () => {
    for (const route of ROUTES)
      for (const key of [route.labelKey, route.breadcrumbKey])
        if (key)
          for (const catalog of [ko, en]) expect(resolve(catalog, key)).toEqual(expect.any(String))
  })
  it('레거시 리다이렉트는 구 경로→현 경로만 담는다', () => {
    const patterns = ROUTES.map((route) => route.pattern)
    for (const [from, to] of Object.entries(LEGACY_ROUTE_REDIRECTS)) {
      expect(patterns).not.toContain(from)
      expect(patterns).toContain(to)
    }
  })
})
