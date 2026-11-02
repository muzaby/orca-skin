import { expect, it } from 'vitest'
import { createHighlighter, createJavaScriptRegexEngine } from 'shiki'
import { getHighlighter, isLang } from './syntax'
const languages = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'json',
  'yaml',
  'html',
  'css',
  'markdown'
] as const
it('preserves the original grammar/theme output for all supported languages and memoizes the shared highlighter', async () => {
  const original = await createHighlighter({
    engine: createJavaScriptRegexEngine(),
    themes: ['github-light', 'github-dark'],
    langs: [...languages]
  })
  const current = await getHighlighter()
  try {
    expect(await getHighlighter()).toBe(current)
    for (const lang of languages)
      for (const theme of ['github-light', 'github-dark']) {
        const code = 'const value = "example"; // comment\n<div class="note">Hello</div>\n# heading'
        expect(isLang(lang)).toBe(true)
        // Compare grammar output without the default wall-clock tokenization cutoff under CI load.
        const options = { lang, theme, tokenizeTimeLimit: 0 }
        expect(current.codeToHtml(code, options), `${lang}/${theme}`).toBe(
          original.codeToHtml(code, options)
        )
      }
    expect(isLang('unused-language')).toBe(false)
  } finally {
    original.dispose()
  }
})
