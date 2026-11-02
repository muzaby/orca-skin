import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it } from 'vitest'
import { ArcSpinner } from './ArcSpinner'

it('renders the agent popup arc spinner', () => {
  const $ = load(renderToStaticMarkup(createElement(ArcSpinner)))
  expect($('svg')).toHaveLength(1)
  expect($('svg').attr('width')).toBe('12')
  expect($('svg').attr('height')).toBe('12')
  expect($('svg').attr('class')?.split(' ').sort()).toEqual(
    ['text-ink3', 'animate-spin', 'motion-reduce:animate-none'].sort()
  )
  expect($('path').attr('d')).toBe('M480-880a400 400 0 1 1-400 400h80a320 320 0 1 0 320-320v-80Z')
})
