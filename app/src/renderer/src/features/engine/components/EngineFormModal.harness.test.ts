import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { EngineFormModal } from './EngineFormModal'

vi.mock('../../../shared/ui/Modal', () => ({
  Modal: ({ children }: { children: ReactNode }) => children
}))
describe('engine form harness selection', () => {
  it('offers both harnesses when adding an engine', () => {
    const $ = load(
      renderToStaticMarkup(
        createElement(EngineFormModal, { mode: 'add', onClose: () => {}, onSubmit: async () => {} })
      )
    )
    expect(
      $('select option')
        .map((_, element) => $(element).attr('value'))
        .get()
    ).toEqual(['claude', 'opencode'])
    expect($('select').attr('disabled')).toBeUndefined()
  })
  it('locks an existing OpenCode engine and uses its native settings', () => {
    const $ = load(
      renderToStaticMarkup(
        createElement(EngineFormModal, {
          mode: 'edit',
          engine: 'opencode',
          provider: 'local',
          initialSettingsJson: '{"model":"vendor/model"}',
          onClose: () => {},
          onSubmit: async () => {}
        })
      )
    )
    expect($('select option[selected]').attr('value')).toBe('opencode')
    expect($('select').attr('disabled')).toBeDefined()
    expect($('textarea').text()).toContain('vendor/model')
    expect($.text()).not.toContain('~/.claude/settings.json')
  })
})
