import { describe, expect, it } from 'vitest'
import { assertOpenCodeProviderId, parseOpenCodeModelListing } from './model-listing'

// v1.18.27 `opencode models <provider> --verbose` 의 실제 형상 — 헤더 줄 다음 JSON.stringify(m, null, 2).
const VERBOSE = `corp/gpt-5
{
  "id": "gpt-5",
  "providerID": "corp",
  "name": "GPT-5 (사내)",
  "limit": {
    "context": 400000,
    "output": 128000
  },
  "variants": {
    "low": {},
    "high": {
      "reasoningEffort": "high"
    },
    "minimal": {
      "disabled": true
    }
  }
}
corp/plain
{
  "id": "plain"
}
`

describe('parseOpenCodeModelListing (0291 MD-02)', () => {
  it('reads header lines with their pretty JSON blocks', () => {
    expect(parseOpenCodeModelListing(VERBOSE, 'corp')).toEqual([
      { id: 'corp/gpt-5', name: 'GPT-5 (사내)', variants: ['low', 'high'] },
      { id: 'corp/plain' }
    ])
  })

  it('drops rows of other providers', () => {
    const mixed = `other/x\n{\n  "name": "X"\n}\ncorp/a\n`
    expect(parseOpenCodeModelListing(mixed, 'corp')).toEqual([{ id: 'corp/a' }])
  })

  it('keeps a header without JSON as id only (non-verbose form)', () => {
    expect(parseOpenCodeModelListing('corp/a\r\ncorp/b\r\n', 'corp')).toEqual([
      { id: 'corp/a' },
      { id: 'corp/b' }
    ])
  })

  it('throws on a broken JSON block instead of returning a partial list', () => {
    expect(() => parseOpenCodeModelListing('corp/a\n{\n  "name": \n}\n', 'corp')).toThrow(
      '모델 목록을 해석하지 못했습니다'
    )
    expect(() => parseOpenCodeModelListing('corp/a\n{\n  "name": "x"\n', 'corp')).toThrow(
      '모델 목록을 해석하지 못했습니다'
    )
  })

  it('returns an empty list for empty output', () => {
    expect(parseOpenCodeModelListing('', 'corp')).toEqual([])
    expect(parseOpenCodeModelListing('\n\n', 'corp')).toEqual([])
  })

  it('accepts only plain provider ids', () => {
    for (const ok of ['corp', 'open-ai', 'a.b_c-1']) {
      expect(() => assertOpenCodeProviderId(ok)).not.toThrow()
    }
    for (const bad of ['', '-x', '--pure', 'a/b', 'a b', '.hidden']) {
      expect(() => assertOpenCodeProviderId(bad)).toThrow('provider id')
    }
  })
})
