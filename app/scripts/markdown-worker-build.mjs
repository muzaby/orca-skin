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
