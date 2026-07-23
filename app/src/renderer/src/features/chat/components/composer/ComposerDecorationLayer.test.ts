import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ComposerDecorationLayer } from './ComposerDecorationLayer'
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
})
