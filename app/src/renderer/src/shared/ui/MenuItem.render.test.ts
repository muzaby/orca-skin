import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { MenuTitle } from './MenuItem'

describe('MenuTitle display slots', () => {
  it('places afterLabel beside the title and preserves right-aligned trailing content', () => {
    const $ = load(
      renderToStaticMarkup(
        createElement(
          MenuTitle,
          {
            afterLabel: createElement('span', null, 'spinner'),
            trailing: createElement('span', null, 'action')
          } as unknown as ComponentProps<typeof MenuTitle>,
          'Agents'
        )
      )
    )
    const children = $('[data-menu-heading]').children()
    expect(children.map((_, node) => $(node).text()).get()).toEqual(['Agents', 'spinner', 'action'])
    expect(children.eq(1).hasClass('ml-auto')).toBe(false)
    expect(children.eq(2).hasClass('ml-auto')).toBe(true)
  })
  it('renders leading, label and trailing in order without creating keyboard targets', () => {
    const $ = load(
      renderToStaticMarkup(
        createElement(
          MenuTitle,
          {
            leading: createElement('span', { 'data-slot': 'leading' }, 'brand'),
            trailing: createElement('span', { 'data-slot': 'trailing' }, 'busy')
          } as ComponentProps<typeof MenuTitle>,
          'Agents'
        )
      )
    )
    const heading = $('[data-menu-heading]')
    expect(
      heading
        .children()
        .map((_, node) => $(node).text())
        .get()
    ).toEqual(['brand', 'Agents', 'busy'])
    expect(heading.children().eq(0).attr('data-slot')).toBe('leading')
    expect(heading.children().eq(2).find('[data-slot="trailing"]')).toHaveLength(1)
    expect(heading.children().eq(2).hasClass('ml-auto')).toBe(true)
    expect(heading.is('button, a, input, [tabindex]')).toBe(false)
    expect(heading.find('button, a, input, [tabindex], [role="menuitemradio"]')).toHaveLength(0)
  })

  it('preserves existing headings without optional slots', () => {
    const $ = load(renderToStaticMarkup(createElement(MenuTitle, null, 'Models')))
    const heading = $('[data-menu-heading]')
    expect(heading.text()).toBe('Models')
    expect(heading.children()).toHaveLength(1)
    expect(heading.children().first().hasClass('truncate')).toBe(true)
  })
})
