import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenizeComposerDecoration, type ComposerDecorationSegment } from './composerDecoration'
import * as skillIndex from './skillIndex'

afterEach(() => vi.restoreAllMocks())

describe('tokenizeComposerDecoration', () => {
  it('preserves complete skill identities with case, underscores, namespaces and punctuation', () => {
    const text = '/Session-B:Review_test /문서.검토 /build, /unknown /build-extra'
    const result = tokenizeComposerDecoration(
      text,
      new Set(['Session-B:Review_test', '문서.검토', 'build']),
      new Set()
    )
    expect(result.filter((item) => item.kind === 'chip').map((item) => item.text)).toEqual([
      '/Session-B:Review_test',
      '/문서.검토',
      '/build'
    ])
    expect(result.map((item) => item.text).join('')).toBe(text)
  })

  it.each(['plugin:docs', '@org/package', 'server with spaces', 'server"quoted'])(
    'recognizes the full native @ identity %j without claiming a path prefix',
    (id) => {
      const token = `@${/[\s"]/.test(id) ? JSON.stringify(id) : id}`
      const text = `${token} @unknown @plugin:docs/path.md`
      const result = tokenizeComposerDecoration(
        text,
        new Set(),
        new Set(['plugin:docs/path.md']),
        new Set([id])
      )
      expect(result.filter((item) => item.kind === 'chip')).toEqual([
        { kind: 'chip', chip: 'plugin', text: token },
        { kind: 'chip', chip: 'file', text: '@plugin:docs/path.md' }
      ])
      expect(result.map((item) => item.text).join('')).toBe(text)
    }
  )

  it('leaves malformed quoted @ identifiers as ordinary text', () => {
    const text = '@"bad\\x" @"unterminated'
    expect(tokenizeComposerDecoration(text, new Set(), new Set(), new Set(['bad']))).toEqual([
      { kind: 'text', text }
    ])
  })
  it('검증된 skill/file 토큰만 장식하고 원문 순서를 보존한다', () => {
    const segments = tokenizeComposerDecoration(
      'run /build with @"src/a b.ts" and /missing',
      new Set(['build']),
      new Set(['src/a b.ts'])
    )

    expect(segments.filter((segment) => segment.kind === 'chip')).toEqual([
      { kind: 'chip', chip: 'skill', text: '/build' },
      { kind: 'chip', chip: 'file', text: '@"src/a b.ts"' }
    ])
    expect(segments.map((segment) => segment.text).join('')).toBe(
      'run /build with @"src/a b.ts" and /missing'
    )
  })

  it('검증된 Plugin id는 label이 아닌 @id 토큰으로 별도 장식한다', () => {
    const segments = tokenizeComposerDecoration(
      '@jira-dc @unknown',
      new Set(),
      new Set(),
      new Set(['jira-dc'])
    )

    expect(segments).toEqual([
      { kind: 'chip', chip: 'plugin', text: '@jira-dc' },
      { kind: 'text', text: ' @unknown' }
    ])
  })

  it('draft 끝의 Plugin id도 chip으로 칠한다 — 끝 경계는 공백과 문자열 끝 둘 다다', () => {
    expect(
      tokenizeComposerDecoration('확인 @jira-dc', new Set(), new Set(), new Set(['jira-dc']))
    ).toEqual([
      { kind: 'text', text: '확인 ' },
      { kind: 'chip', chip: 'plugin', text: '@jira-dc' }
    ])
  })

  it('경로 토큰의 앞부분이 Plugin id와 같아도 Plugin chip으로 칠하지 않는다', () => {
    expect(
      tokenizeComposerDecoration(
        '@jira-dc/notes.md @jira-dc/missing',
        new Set(),
        new Set(['jira-dc/notes.md']),
        new Set(['jira-dc'])
      )
    ).toEqual([
      { kind: 'chip', chip: 'file', text: '@jira-dc/notes.md' },
      { kind: 'text', text: ' @jira-dc/missing' }
    ])
  })
})

// ── 0325 VP-23 · EP-6 — 장식 상한 · 스킬 판정 기저 색인 ───────────────────────────────
// 현행(AS-IS) 스킬 판정 — 끝 문자를 하나씩 자르며 등록 집합을 조회한다. 새 판정의 결과가 이것과 같은지 본다
// (`git show 5923d9a:app/src/renderer/src/features/chat/harnesses/common/composer/composerDecoration.ts`).
function legacySkillChips(value: string, known: ReadonlySet<string>): string[] {
  const chips: string[] = []
  for (const match of value.matchAll(/(?<=^|\s)\/[^\s]+/g)) {
    let text = match[0]
    while (!known.has(text.slice(1)) && /[.,!?;:)\]}]$/.test(text)) text = text.slice(0, -1)
    if (known.has(text.slice(1))) chips.push(text)
  }
  return chips
}
const chips = (segments: ComposerDecorationSegment[]): string[] =>
  segments.flatMap((segment) => (segment.kind === 'chip' ? [segment.text] : []))
const skills = (value: string, known: ReadonlySet<string>): string[] =>
  chips(tokenizeComposerDecoration(value, known, new Set()))

// `has` 호출을 센다 — 판정이 등록 집합을 조회하지 않는지 본다.
class CountingSet extends Set<string> {
  hasCalls = 0
  override has(value: string): boolean {
    this.hasCalls++
    return super.has(value)
  }
}
const dots = (count: number): string => '.'.repeat(count)
const steps = (): ReturnType<typeof vi.spyOn> => vi.spyOn(skillIndex, 'trieChild')

describe('장식 상한 · 스킬 기저 색인 (0325)', () => {
  it('d1 `/z` + 마침표 19,999개(20,001자) → [] · 정규식 0회', () => {
    const matchAll = vi.spyOn(String.prototype, 'matchAll')
    const value = `/z${dots(19_999)}`
    expect(value).toHaveLength(20_001)
    expect(tokenizeComposerDecoration(value, new Set(['z']), new Set())).toEqual([])
    expect(matchAll).not.toHaveBeenCalled()
  })

  it('d2 20,000자(`/build @file.ts ` 1,250회) → chip 2,500', () => {
    const value = '/build @file.ts '.repeat(1_250)
    expect(value).toHaveLength(20_000)
    const result = tokenizeComposerDecoration(value, new Set(['build']), new Set(['file.ts']))
    expect(chips(result)).toHaveLength(2_500)
    expect(result.map((item) => item.text).join('')).toBe(value)
  })

  it('d3 빈 문자열 → []', () => {
    expect(tokenizeComposerDecoration('', new Set(['build']), new Set())).toEqual([])
  })

  it('d4 등록 {build} · `/z` + 마침표 19,998개(20,000자) → chip 0 · 걸음 0 · `has` 0', () => {
    const known = new CountingSet(['build'])
    const walk = steps()
    const value = `/z${dots(19_998)}`
    expect(value).toHaveLength(20_000)
    expect(skills(value, known)).toEqual([])
    expect(walk).not.toHaveBeenCalled()
    expect(known.hasCalls).toBe(0)
    expect(skills(value, known)).toEqual(legacySkillChips(value, new Set(['build'])))
  })

  it('d5 구두점으로 끝나는 등록 스킬 · 뒤 구두점 떼기는 그대로다', () => {
    const known = new Set(['deploy.', 'v1.2', 'build'])
    const value = '/deploy. /deploy.. /v1.2. /build.)'
    expect(skills(value, known)).toEqual(['/deploy.', '/deploy.', '/v1.2', '/build'])
    expect(skills(value, known)).toEqual(legacySkillChips(value, known))
  })

  it('d6 길이 1~2,000 이름 2,000개 → 걸음 ≤ 토큰들의 끝 구두점 길이 합', () => {
    const known = new Set(Array.from({ length: 2_000 }, (_, index) => `n${dots(index)}`))
    const tokens = [`/n${dots(1_999)}`, `/n${dots(2_500)}`, `/m${dots(800)}`, `/n${dots(3)},)`]
    let value = tokens.join(' ')
    value += ` /n${dots(20_000 - value.length - 3)}`
    expect(value).toHaveLength(20_000)
    const trailing = value
      .split(' ')
      .reduce(
        (sum, token) =>
          sum + token.length - 1 - skillIndex.trailingPunctuationStart(token.slice(1)),
        0
      )
    const walk = steps()
    const result = skills(value, known)
    expect(walk.mock.calls.length).toBeLessThanOrEqual(trailing)
    expect(result).toEqual(legacySkillChips(value, known))
    // 상한 밖(20,100자)은 장식이 없다 — 걸음도 0.
    walk.mockClear()
    expect(skills(value + 'x'.repeat(100), known)).toEqual([])
    expect(walk).not.toHaveBeenCalled()
  })

  it('d7 관계없는 20,000자 이름을 더해도 걸음·`has` 가 d4 와 같다(0·0)', () => {
    const known = new CountingSet(['build', 'q'.repeat(20_000)])
    const walk = steps()
    const value = `/z${dots(19_998)}`
    expect(skills(value, known)).toEqual([])
    expect(walk).not.toHaveBeenCalled()
    expect(known.hasCalls).toBe(0)
  })

  it('d8 이모지·한글 이름(UTF-16 코드 단위)', () => {
    const known = new Set(['🚀deploy', 'a🚀', '배포'])
    const value = '/🚀deploy. /a🚀. /배포.'
    expect(skills(value, known)).toEqual(['/🚀deploy', '/a🚀', '/배포'])
    expect(skills(value, known)).toEqual(legacySkillChips(value, known))
  })

  it('d9 같은 등록 집합 → 같은 색인 · 새 집합 → 새 색인', () => {
    const known = new Set(['build'])
    expect(skillIndex.skillIndexFor(known)).toBe(skillIndex.skillIndexFor(known))
    expect(skillIndex.skillIndexFor(new Set(['build']))).not.toBe(skillIndex.skillIndexFor(known))
  })

  it('d12 등록 {z, z + 마침표 19,998} · d4 입력 → 걸음 19,998 · chip = 토큰 전체', () => {
    const known = new Set(['z', `z${dots(19_998)}`])
    const walk = steps()
    const value = `/z${dots(19_998)}`
    expect(skills(value, known)).toEqual([value])
    expect(walk).toHaveBeenCalledTimes(19_998)
    expect(skills(value, known)).toEqual(legacySkillChips(value, known))
  })

  // §8 V5·W3·X6 표본 — 등록 집합마다 현행 판정과 결과가 같다.
  it.each([
    [
      ['build'],
      '/build. /build...) /z.................................................. /a.b.c /: /build /build,x'
    ],
    [['deploy.'], '/deploy. /deploy..'],
    [['v1.2'], '/v1.2 /v1.2.'],
    [['a', 'ab'], '/ab.'],
    [['a', 'ab.'], '/ab.'],
    [['a', 'a.'], '/a..'],
    [['build'], '/build:now'],
    [[''], '/.'],
    [['x', 'x.'], '/x.'],
    [['🚀deploy', 'a🚀', '배포', '문서.검토'], '/🚀deploy.) /a🚀 /배포!? /문서.검토. /문서.']
  ])('표본: 등록 %j', (names, value) => {
    const known = new Set(names)
    expect(skills(value, known)).toEqual(legacySkillChips(value, known))
  })

  it('무작위 토큰 2,000건 — 현행 판정과 같다', () => {
    let seed = 7
    const random = (): number => (seed = (seed * 48_271) % 2_147_483_647) / 2_147_483_647
    const alphabet = ['a', 'b', '.', ',', ')', ':', '🚀']
    const word = (max: number): string =>
      Array.from(
        { length: 1 + Math.floor(random() * max) },
        () => alphabet[Math.floor(random() * alphabet.length)]
      ).join('')
    const known = new Set(Array.from({ length: 30 }, () => word(4)))
    for (let index = 0; index < 2_000; index++) {
      const value = `/${word(8)}`
      expect(skills(value, known)).toEqual(legacySkillChips(value, known))
    }
  })
})
