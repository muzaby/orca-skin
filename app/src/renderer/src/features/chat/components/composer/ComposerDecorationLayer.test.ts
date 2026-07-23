import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ComposerDecorationLayer } from './ComposerDecorationLayer'
import { ComposerInputSurface } from './ComposerInputSurface'
import { composerDecorationTransform } from './composerScrollProjection'
import { createDraftSnapshot, setDraftComposition } from './draftSnapshot'

describe('ComposerDecorationLayer', () => {
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
