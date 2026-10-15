import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { HarnessSettingsTab } from '../../components/HarnessSettingsTab'

describe('harness settings initial loading state', () => {
  it.each(['claude', 'opencode'] as const)(
    'scopes the %s tab and waits for persisted settings',
    (backend) => {
      const $ = load(renderToStaticMarkup(createElement(HarnessSettingsTab, { backend })))
      expect($(`[data-harness-settings="${backend}"]`)).toHaveLength(1)
      expect($('[role="status"]')).toHaveLength(1)
      expect($('textarea')).toHaveLength(0)
      expect($.text().includes('OpenCode')).toBe(backend === 'opencode')
    }
  )
})
