// 카탈로그 위생(0096) — ko/en 리프 키 패리티(en 은 typeof ko 로 컴파일 강제되지만,
// 런타임 스냅샷으로도 이중 확인) + 빈 값 금지 + 보간 플레이스홀더 일치.

import { describe, expect, it } from 'vitest'
import { ko } from './ko'
import { en } from './en'

type Catalog = { [key: string]: string | Catalog }

function leafPaths(node: Catalog, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : leafPaths(value, path)
  })
}

function leafValue(node: Catalog, path: string): string {
  const value = path.split('.').reduce<Catalog | string>((acc, key) => {
    if (typeof acc === 'string') throw new Error(`중간 경로가 문자열: ${path}`)
    return acc[key]
  }, node)
  if (typeof value !== 'string') throw new Error(`리프가 아님: ${path}`)
  return value
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
}

describe('i18n resources', () => {
  const koPaths = leafPaths(ko as Catalog)
  const enPaths = leafPaths(en as Catalog)

  it('ko↔en 리프 키 집합 일치', () => {
    expect(enPaths).toEqual(koPaths)
  })

  it('빈 문자열 값 없음', () => {
    for (const path of koPaths) {
      expect(leafValue(ko as Catalog, path), `ko:${path}`).not.toBe('')
      expect(leafValue(en as Catalog, path), `en:${path}`).not.toBe('')
    }
  })

  it('보간 플레이스홀더({{x}}) 일치', () => {
    for (const path of koPaths) {
      expect(placeholders(leafValue(en as Catalog, path)), path).toEqual(
        placeholders(leafValue(ko as Catalog, path))
      )
    }
  })
})
