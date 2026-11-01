import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { composerHarness } from './composer'
import { harnessLanding } from './landing'

it.each(['claude', 'opencode'] as const)(
  'carries each source brand through the %s composer',
  (backend) => {
    for (const [source, viewBox, tone] of [
      ['native:claude', '0 0 248 248', 'text-spinner'],
      ['native:opencode', '0 0 16 20', 'text-oc-ink']
    ]) {
    const html = renderToStaticMarkup(composerHarness(backend).sourceIcon!(source))
      expect(html).toContain(`viewBox="${viewBox}"`)
      expect(html).toContain(tone)
    }
  }
)

it('keeps the context location in the landing presentation', () => {
  expect(harnessLanding('claude').composer.contextLayout).toBe('inline')
  expect(harnessLanding('opencode').composer.contextLayout).toBe('below')
})
