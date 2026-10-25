import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it } from 'vitest'
import { transcriptAppearance as claude } from '../../claude/transcript/appearance'
import { transcriptAppearance as opencode } from '../../opencode/transcript/appearance'
import { surfaces as claudeSurfaces } from '../../claude/surfaces'
import { surfaces as opencodeSurfaces } from '../../opencode/surfaces'
import { OpenCodeText } from '../../opencode/transcript/Text'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { transcriptTypography } from './typography'
const typography = (value: string): string[] =>
  value.split(' ').filter((x) => /^(text-(body|\[)|font-|leading-|italic)/.test(x))
it('inherits shared bubble and body typography for both harnesses', () => {
  for (const key of ['userBubble', 'pendingBubble'] as const) {
    expect(typography(claude[key])).toEqual(typography(transcriptTypography[key]))
    expect(typography(opencode[key])).toEqual(typography(claude[key]))
  }
  expect(typography(opencodeSurfaces.message)).toEqual(typography(claudeSurfaces.message))
  expect(opencodeSurfaces.message).toContain('text-oc-ink')
  expect(claudeSurfaces.message).toContain('text-ink')
})
it('renders OpenCode prose with shared typography and its own colours', () => {
  const source = '# Heading\n\n**bold** and `code`\n\n- list\n- next'
  const original = load(renderToStaticMarkup(createElement(Markdown, { source })))
  for (const streaming of [false, true]) {
    const html = renderToStaticMarkup(createElement(OpenCodeText, { source, streaming }))
    const $ = load(html)
    for (const tag of ['h1', 'p', 'strong', 'code', 'ul', 'li'])
      expect($(tag).first().attr('class')).toEqual(original(tag).first().attr('class'))
    expect(html).not.toMatch(/font-\[440\]|leading-\[1.6\]|\[&_p\]:|\[&_h1\]:mt-/)
    expect(html).toContain('text-oc-ink')
    expect($('p').first().parent().attr('class')).toContain(transcriptTypography.prose)
  }
})
