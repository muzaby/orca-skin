import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { HarnessLogo } from './HarnessLogo'

it.each([
  ['claude', '0 0 248 248', 'text-spinner'],
  ['opencode', '0 0 16 20', 'text-oc-ink']
] as const)('preserves %s artwork and default or explicit tone', (backend, viewBox, tone) => {
  const render = (override?: string): string => renderToStaticMarkup(createElement(HarnessLogo, { backend, className: 'size-4 shrink-0', tone: override }))
  expect(render()).toContain(`viewBox="${viewBox}"`)
  expect(render()).toContain(`class="size-4 shrink-0 ${tone}"`)
  expect(render('text-ink')).toContain('class="size-4 shrink-0 text-ink"')
  expect(render('text-ink')).not.toContain(tone)
})
