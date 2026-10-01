import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffortLevel } from '../../../../../../shared/ipc'
import { i18n } from '../../../../shared/i18n'
import { ko } from '../../../../shared/i18n/resources/ko'
import { en } from '../../../../shared/i18n/resources/en'
import { EffortMenu } from './EffortMenu'
import { EFFORT_LABEL_KEYS } from './effort'

afterEach(async () => {
  await i18n.changeLanguage('ko')
})

describe('0246 AC12′ — recommended effort row', () => {
  it.each<EffortLevel>(['medium', 'xhigh', 'high'])(
    'recommends %s independently of the selected effort',
    (defaultEffort) => {
      const html = renderToStaticMarkup(
        createElement(EffortMenu, { effort: 'max', defaultEffort, onPick: vi.fn() })
      )
      const rows = html.split('role="menuitemradio"').slice(1)
      expect(rows.filter((row) => row.includes('추천'))).toHaveLength(1)
      const recommended = rows.find((row) => row.includes('추천'))!
      expect(recommended).toContain(i18n.t(EFFORT_LABEL_KEYS[defaultEffort]))
      expect(recommended).toContain('aria-checked="false"')
      expect(rows.find((row) => row.startsWith(' aria-checked="true"'))).not.toContain('추천')
      expect(html).not.toContain('기본값')
    }
  )

  it('translates the recommendation and removes static default descriptions in both locales', async () => {
    await i18n.changeLanguage('en')
    const html = renderToStaticMarkup(
      createElement(EffortMenu, { effort: 'medium', defaultEffort: 'medium', onPick: vi.fn() })
    )
    expect(html.match(/Recommended/g)).toHaveLength(1)
    expect(html).not.toContain('Default.')
    expect(ko.chat.composer.effort.high.desc).not.toContain('기본값')
    expect(en.chat.composer.effort.high.desc).not.toContain('Default.')
  })
})
