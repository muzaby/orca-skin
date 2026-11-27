import { createRequire } from 'node:module'

// Vite normally selects the browser export, which decodes entities using document.
// This package's default and worker exports both select its DOM-free lookup table.
export function markdownWorkerBuild() {
  const resolver = createRequire(import.meta.url)
  return {
    name: 'markdown-worker-entities',
    enforce: /** @type {const} */ ('pre'),
    resolveId(id) {
      if (id === 'decode-named-character-reference') return resolver.resolve(id)
    }
  }
}

// The renderer resolves this package to its DOM-free file everywhere (0331 D-035). `worker.plugins` above
// only reach production worker bundles; the dev server serves workers through the main pipeline and
// pre-bundles markdown dependencies with the browser condition, so a worker that imports
// `remark-parse` evaluates `document.createElement` and dies on every start. An alias applies to the dev
// pipeline, the dependency pre-bundle and the build alike.
export function domFreeEntityDecoder() {
  return createRequire(import.meta.url).resolve('decode-named-character-reference')
}
