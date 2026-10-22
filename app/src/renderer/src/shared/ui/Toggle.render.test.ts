import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it } from 'vitest'
import { ToggleIndicator } from './Toggle'

it.each([false, true])(
  'preserves the 200ms switch transitions and reduced motion when on=%s',
  (on) => {
    for (const busy of [false, true]) {
      const $ = load(renderToStaticMarkup(createElement(ToggleIndicator, { on, busy })))
      const track = $('[data-toggle-track]')
      const thumb = track.children('[data-toggle-thumb]')
      expect(track.hasClass('transition-colors')).toBe(true)
      expect(thumb.hasClass('transition-transform')).toBe(true)
      for (const node of [track, thumb]) {
        expect(node.hasClass('duration-200')).toBe(true)
        expect(node.hasClass('motion-reduce:transition-none')).toBe(true)
      }
      expect(track.hasClass(on ? 'bg-toggle-on' : 'bg-border-strong')).toBe(true)
      expect(thumb.hasClass(on ? 'translate-x-3' : 'translate-x-0')).toBe(true)
      expect(thumb.children('[data-toggle-spinner]')).toHaveLength(busy ? 1 : 0)
      if (busy) {
        expect(thumb.children().hasClass('animate-spin')).toBe(true)
        expect(thumb.children().hasClass('motion-reduce:animate-none')).toBe(true)
      }
    }
  }
)
