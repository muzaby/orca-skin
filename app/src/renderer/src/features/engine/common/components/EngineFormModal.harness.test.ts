import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { EngineFormModal } from '../../components/EngineFormModal'

vi.mock('../../../../shared/ui/Modal', () => ({
  Modal: ({ children }: { children: ReactNode }) => children
}))
describe('engine form harness selection', () => {
  it('restores the fixed claude chip and provider when editing a Claude engine (0262 AC31)', () => {
    const $ = load(
      renderToStaticMarkup(
        createElement(EngineFormModal, {
          mode: 'edit',
          engine: 'claude',
          provider: 'fixture',
          initialSettingsJson: '{"env":{}}',
          onClose: () => {},
          onSubmit: async () => {}
        })
      )
    )
    expect($('select')).toHaveLength(0)
    const chip = $('span').filter((_, element) => $(element).text() === 'claude')
    expect(chip).toHaveLength(1)
    expect(chip.attr('class')).toBe('rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink')
    expect(chip.parent().text()).toBe('claude/fixture')
    expect($.text()).toContain('~/.claude/settings.json 불러오기')
    expect($('textarea').text()).toBe('{"env":{}}')
  })

  it('opens the selected Claude form with a fixed harness', () => {
    const $ = load(
      renderToStaticMarkup(
        createElement(EngineFormModal, {
          mode: 'add',
          engine: 'claude',
          onClose: () => {},
          onSubmit: async () => {}
        })
      )
    )
    expect($('select')).toHaveLength(0)
    expect($.text()).toContain('claude')
    expect($.text()).toContain('~/.claude/settings.json 불러오기')
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
    expect($('select')).toHaveLength(0)
    expect($.text()).toContain('OpenCode')
    expect($('textarea').text()).toContain('vendor/model')
    expect($.text()).not.toContain('~/.claude/settings.json')
    expect(
      $('button').filter((_, element) => $(element).text().includes('opencode.json 불러오기'))
    ).toHaveLength(1)
  })
})
