import type { HighlighterCore } from 'shiki/core'

const LANGUAGES = [
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

// Markdown and diff share only the grammars and themes this app displays.
let highlighterPromise: Promise<HighlighterCore> | null = null
export function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [core, engine, light, dark, ...languages] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/jsx.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/markdown.mjs')
    ])
    return core.createHighlighterCore({
      engine: engine.createJavaScriptRegexEngine(),
      themes: [light.default, dark.default],
      langs: languages.map((language) => language.default)
    })
  })()
  return highlighterPromise
}

export function isLang(s: string): s is (typeof LANGUAGES)[number] {
  return (LANGUAGES as readonly string[]).includes(s)
}
