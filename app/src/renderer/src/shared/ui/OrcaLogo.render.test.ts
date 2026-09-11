import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PRODUCT_DISPLAY_NAME } from '../../../../shared/product'
import { OrcaLogo } from './OrcaLogo'

describe('OrcaLogo', () => {
  it('renders the PNG with its transparent canvas clipped and smooth scaling enabled', () => {
    const html = renderToStaticMarkup(createElement(OrcaLogo, { className: 'h-10 w-auto' }))

    expect(html).toContain('<span')
    expect(html).toContain(`aria-label="${PRODUCT_DISPLAY_NAME}"`)
    expect(html).toContain('aspect-[1023/776]')
    expect(html).toContain('overflow-hidden')
    expect(html).toContain('left-[-11.29%]')
    expect(html).toContain('top-[-30.80%]')
    expect(html).toContain('h-[161.60%]')
    expect(html).toContain('[image-rendering:auto]')
    expect(html).toContain('<img')
    expect(html).not.toContain('<svg')
  })
})
