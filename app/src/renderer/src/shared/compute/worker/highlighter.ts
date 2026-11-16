// 워커 안의 shiki 하이라이터 (0324). Markdown 과 diff 가 쓰는 문법·테마만 싣는다. 엔진은 JS
// 정규식 엔진이라 WASM 이 없고 CSP 를 바꾸지 않는다. 이 파일은 워커 번들에만 들어간다 —
// UI 스레드는 `shiki` 를 값으로 import 하지 않는다(가드 `check-ui-thread` 규칙 (b)).

import type { HighlighterCore } from 'shiki/core'

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
