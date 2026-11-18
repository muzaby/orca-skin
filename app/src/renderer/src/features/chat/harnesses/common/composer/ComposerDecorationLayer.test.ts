import { composerHarness } from '../../registries/composer'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ComposerDecorationLayer } from './ComposerDecorationLayer'
import { ComposerInputSurface } from './ComposerInputSurface'
import { composerDecorationTransform } from './composerScrollProjection'
import { createDraftSnapshot, setDraftComposition } from './draftSnapshot'

describe('ComposerDecorationLayer', () => {
  // 0325 VP-22 — 상한(20,000자)을 넘는 초안은 chip span 을 만들지 않는다.
  it('renders no decoration spans for a draft over the cap', () => {
    const render = (text: string): string =>
      renderToStaticMarkup(
        createElement(ComposerDecorationLayer, {
          snapshot: createDraftSnapshot(text),
          knownSkillNames: new Set(['build']),
          validFilePaths: new Set(['file.ts']),
          typographyClassName: 'typography'
        })
      )
    const within = '/build @file.ts '.repeat(1_250)
    expect(render(within).match(/bg-blue-500\/15/g)).toHaveLength(1_250)
    expect(render(`${within}x`).match(/bg-(blue|emerald)-500\/15/g)).toBeNull()
  })

  it('uses the reference background for native plugin tokens while preserving skill styling', () => {
    const html = renderToStaticMarkup(
      createElement(ComposerDecorationLayer, {
        snapshot: createDraftSnapshot('/review @native @src/a.ts'),
        knownSkillNames: new Set(['review']),
        validPluginIds: new Set(['native']),
        validFilePaths: new Set(['src/a.ts']),
        typographyClassName: 'typography'
      })
    )
    expect(html.match(/bg-emerald-500\/15/g)).toHaveLength(2)
    expect(html).toContain('bg-blue-500/15')
    expect(html).not.toContain('bg-violet-500/15')
  })
  it('한글 IME 조합 중에도 마지막 skill decoration을 숨기지 않는다', () => {
    const snapshot = setDraftComposition(createDraftSnapshot('/build 한'), true)
    const html = renderToStaticMarkup(
      createElement(ComposerDecorationLayer, {
        snapshot,
        knownSkillNames: new Set(['build']),
        validFilePaths: new Set<string>(),
        typographyClassName: 'typography'
      })
    )

    expect(html).toContain('bg-blue-500/15')
    expect(html).not.toContain('opacity-0')
  })

  it('textarea와 decoration이 같은 scrollbar gutter를 사용한다', () => {
    const html = renderToStaticMarkup(
      createElement(ComposerInputSurface, {
        appearance: composerHarness('claude').appearance,
        snapshot: createDraftSnapshot('/build'),
        onTextChange: () => undefined,
        onSelectionChange: () => undefined,
        onCompositionChange: () => undefined,
        knownSkillNames: new Set(['build']),
        validFilePaths: new Set<string>()
      })
    )

    expect(html.match(/\[scrollbar-gutter:stable\]/g)).toHaveLength(2)
  })

  it('decoration을 독립 scroll container가 아닌 viewport projection으로 렌더한다', () => {
    const html = renderToStaticMarkup(
      createElement(ComposerDecorationLayer, {
        snapshot: createDraftSnapshot('/build'),
        knownSkillNames: new Set(['build']),
        validFilePaths: new Set<string>(),
        typographyClassName: 'typography'
      })
    )

    expect(html).toContain('data-composer-decoration-viewport')
    expect(html).toContain('data-composer-decoration-projection')
    expect(composerDecorationTransform(12, 240)).toBe('translate3d(-12px, -240px, 0)')
    expect(composerDecorationTransform(0, 0)).toBe('translate3d(0px, 0px, 0)')
  })
})
