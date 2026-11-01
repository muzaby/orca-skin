import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SourceHeading } from './SourceHeading'

it.each([
  ['native:claude', '0 0 248 248', 'text-spinner'],
  ['native:opencode', '0 0 16 20', 'text-oc-ink']
])('preserves the %s source mark and color', (source, viewBox, tone) => {
  const html = renderToStaticMarkup(createElement(SourceHeading, { source, label: source }))
  expect(html).toContain(`viewBox="${viewBox}"`)
  expect(html).toContain(tone)
})
