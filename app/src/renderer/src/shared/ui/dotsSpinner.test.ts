import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { DotsSpinner } from './DotsSpinner'

describe('0254 dots spinner', () => {
  it.each([14, 20] as const)(
    'renders three staggered reduced-motion dots in a %ipx box',
    (size) => {
      const $ = load(renderToStaticMarkup(createElement(DotsSpinner, { size })))
      const spinner = $('[data-spinner="dots"]')
      expect(spinner.attr('aria-hidden')).toBe('true')
      expect(spinner.hasClass(size === 20 ? 'h-5' : 'h-[14px]')).toBe(true)
      expect(spinner.hasClass(size === 20 ? 'w-5' : 'w-[14px]')).toBe(true)
      const dots = spinner.children()
      expect(dots).toHaveLength(3)
      dots.each((index, dot) => {
        expect($(dot).hasClass('animate-dot-wave')).toBe(true)
        expect($(dot).hasClass('motion-reduce:animate-none')).toBe(true)
        expect($(dot).hasClass(`[animation-delay:${index * 160}ms]`)).toBe(true)
      })
    }
  )
  it('wires a single animation token to its keyframes inside @theme', () => {
    const css = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')
    expect(css.match(/--animate-dot-wave\s*:/g)).toHaveLength(1)
    expect(css).toMatch(/--animate-dot-wave:\s*dot-wave 1\.2s ease-in-out infinite;/)
    expect(css.match(/@keyframes\s+dot-wave\s*\{/g)).toHaveLength(1)
    expect(css.indexOf('--animate-dot-wave')).toBeGreaterThan(css.indexOf('@theme {'))
  })
})
