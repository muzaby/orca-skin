import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffortLevel } from '../../../../../../../shared/ipc'
import { i18n } from '../../../../../shared/i18n'
import { ko } from '../../../../../shared/i18n/resources/ko'
import { en } from '../../../../../shared/i18n/resources/en'
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
    expect(ko.chat.composer.effort.high).not.toHaveProperty('desc')
    expect(en.chat.composer.effort.high).not.toHaveProperty('desc')
  })
})

describe('0257 AC13 — effort rows show labels only', () => {
  const REMOVED = [
    '빠른 응답을 우선합니다.',
    '속도와 사고 깊이를 균형 있게 사용합니다.',
    '충분한 사고 깊이로 작업합니다.',
    '복잡한 작업에 더 깊게 사고합니다.',
    '가장 깊은 사고 예산을 사용합니다.',
    'Prioritizes fast responses.',
    'Balances speed and thinking depth.',
    'Works with sufficient thinking depth.',
    'Thinks more deeply for complex tasks.',
    'Uses the deepest thinking budget.'
  ]
  it.each(['ko', 'en'] as const)('%s rows carry no description sentence', async (locale) => {
    await i18n.changeLanguage(locale)
    const html = renderToStaticMarkup(
      createElement(EffortMenu, { effort: 'high', defaultEffort: 'medium', onPick: vi.fn() })
    )
    for (const sentence of REMOVED) expect(html).not.toContain(sentence)
    const rows = html.split('role="menuitemradio"').slice(1)
    expect(rows).toHaveLength(5)
    for (const [index, level] of (['low', 'medium', 'high', 'xhigh', 'max'] as const).entries()) {
      // 행 = 여는 태그 뒤부터 그 버튼의 닫는 태그까지. 태그를 지운 텍스트가 라벨(+태그)뿐이다.
      const row = rows[index].slice(rows[index].indexOf('>') + 1, rows[index].indexOf('</button>'))
      const text = row
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const label = i18n.t(EFFORT_LABEL_KEYS[level])
      const tag = level === 'medium' ? ' ' + i18n.t('chat.composer.effort.recommendedTag') : ''
      expect(text).toBe(label + tag)
    }
  })
})
