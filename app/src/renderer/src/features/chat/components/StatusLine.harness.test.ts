import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it } from 'vitest'
import { StatusLine } from './StatusLine'

it('renders the OpenCode grid with stable animation and accessible status', () => {
  const render = (): string =>
    renderToStaticMarkup(
      createElement(StatusLine, { backend: 'opencode', turnStartedAt: Date.now() })
    )
  const $ = load(render())
  const spinner = $('[data-component="opencode-spinner"]')
  expect(spinner.attr('viewBox')).toBe('0 0 15 15')
  expect(spinner.attr('width')).toBe('18')
  expect(spinner.attr('height')).toBe('18')
  expect(spinner.attr('aria-hidden')).toBe('true')
  expect($('[aria-live="polite"]').attr('aria-label')).toBeTruthy()
  const squares = spinner.find('rect')
  expect(squares).toHaveLength(16)
  expect(squares.filter('.opacity-0')).toHaveLength(4)
  expect(squares.filter('.animate-oc-spinner-bright')).toHaveLength(4)
  expect(squares.filter('.animate-oc-spinner-dim')).toHaveLength(8)
  squares.each((index, element) => {
    const square = $(element)
    expect(square.attr('x')).toBe(String((index % 4) * 4))
    expect(square.attr('y')).toBe(String(Math.floor(index / 4) * 4))
    expect(square.attr('width')).toBe('3')
    expect(square.attr('height')).toBe('3')
    expect(square.attr('rx')).toBe('1')
    if ([0, 3, 12, 15].includes(index)) {
      expect(square.hasClass('opacity-0')).toBe(true)
      expect(square.attr('style')).toBeUndefined()
      return
    }
    expect(square.hasClass('motion-reduce:animate-none')).toBe(true)
    const duration = Number(square.attr('style')?.match(/animation-duration:([\d.]+)s/)?.[1])
    const delay = Number(square.attr('style')?.match(/animation-delay:([\d.]+)s/)?.[1])
    expect(duration).toBeGreaterThanOrEqual(1)
    expect(duration).toBeLessThan(2)
    expect(delay).toBeGreaterThanOrEqual(0)
    expect(delay).toBeLessThan(1.5)
  })
  expect(load(render())('[data-component="opencode-spinner"]').html()).toBe(spinner.html())
  expect(
    renderToStaticMarkup(createElement(StatusLine, { backend: 'opencode', turnStartedAt: null }))
  ).toBe('')
})
