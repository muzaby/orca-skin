import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { ArtifactPreviewContent } from './ArtifactPreviewContent'
import type { ArtifactPreviewResult } from '../../../../../../shared/artifacts'

type Ready = Extract<ArtifactPreviewResult, { state: 'ready' }>
function render(result: Ready, mode: 'preview' | 'code' = 'preview'): ReturnType<typeof load> {
  return load(
    renderToStaticMarkup(createElement(ArtifactPreviewContent, { result, mode, title: 'Selected' }))
  )
}

describe('artifact preview rendering boundaries', () => {
  it('uses only the sanitized full HTML document inside an opaque scriptless iframe', () => {
    const previewContent =
      '<!doctype html><html lang="ko" class="report"><head><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;"></head><body class="paper" style="color: red"><h1>Safe document</h1></body></html>'
    const result: Ready = {
      state: 'ready',
      format: 'html',
      content: '<script>unsafe()</script><h1>Original</h1>',
      previewContent,
      mimeType: 'text/html'
    }
    const $ = render(result)
    expect($('iframe').attr('srcdoc')).toBe(previewContent)
    expect($('iframe').attr('sandbox')).toBe('')
    expect($('iframe').attr('referrerpolicy')).toBe('no-referrer')
    expect($('script').length).toBe(0)
    const code = render(result, 'code')
    expect(code('iframe').length).toBe(0)
    expect(code('pre').text()).toContain('<script>unsafe()</script><h1>Original</h1>')
    expect(code('script').length).toBe(0)
  })
  it('does not fall back to browsing raw HTML if the safe preview is missing', () => {
    const result: Ready = {
      state: 'ready',
      format: 'html',
      content: '<img src="https://example.invalid/private">',
      mimeType: 'text/html'
    }
    const $ = render(result)
    expect($('iframe, img').length).toBe(0)
    expect($('[role=alert]').text()).toContain('미리보기')
    expect(render(result, 'code')('pre').text()).toContain('https://example.invalid/private')
  })
  it('renders Markdown as a document, plain text as numbered code, and images as images', () => {
    expect(
      render({
        state: 'ready',
        format: 'markdown',
        content: '# Heading',
        mimeType: 'text/markdown'
      })('h1').text()
    ).toBe('Heading')
    const text = render({
      state: 'ready',
      format: 'text',
      content: 'first\nsecond',
      mimeType: 'text/plain',
      language: 'text'
    })
    expect(text('pre').text()).toContain('first\nsecond')
    expect(text('pre [aria-hidden=true]').text()).toBe('1\n2')
    const image = render({
      state: 'ready',
      format: 'image',
      content: 'data:image/png;base64,aA==',
      mimeType: 'image/png'
    })
    expect(image('img').attr('src')).toBe('data:image/png;base64,aA==')
    expect(image('img').attr('alt')).toBe('Selected')
    expect(image('pre, iframe').length).toBe(0)
  })
})
