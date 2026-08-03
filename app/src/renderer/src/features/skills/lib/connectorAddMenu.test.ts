import { describe, expect, it } from 'vitest'
import { addMenuState, resolveTemplateLabel } from './connectorAddMenu'
import type { ConnectorTemplateInfoDto } from '../../../../../shared/ipc'

const CONFLUENCE: ConnectorTemplateInfoDto = {
  templateId: 'confluence',
  i18nKey: 'skills.templates.confluence',
  fields: [
    { name: 'label', required: true, i18nKey: 'skills.instance.label' },
    { name: 'baseUrl', required: true, i18nKey: 'skills.instance.baseUrl' }
  ]
}

// 카탈로그에 있는 키만 문구로 바꾸는 가짜 번역기 — i18next 처럼 없는 키는 키 자체를 돌려준다.
const translate = (key: string): string =>
  key === 'skills.templates.confluence' ? 'Confluence (Data Center)' : key

describe('addMenuState', () => {
  it('템플릿마다 한 행을 만든다', () => {
    const state = addMenuState([CONFLUENCE], translate)
    expect(state).toEqual({
      kind: 'rows',
      rows: [{ templateId: 'confluence', label: 'Confluence (Data Center)' }]
    })
  })

  it('현재 등록분은 Confluence 하나뿐이라 행이 정확히 1개다', () => {
    const state = addMenuState([CONFLUENCE], translate)
    expect(state.kind === 'rows' && state.rows.length).toBe(1)
  })

  it('템플릿이 없으면 빈 상태 사유를 낸다', () => {
    expect(addMenuState([], translate)).toEqual({ kind: 'empty' })
  })

  // 로딩과 빈 상태를 가른다 — 아직 안 온 것을 "없다" 로 보여주면 오보다.
  it('응답 전에는 로딩이다', () => {
    expect(addMenuState(null, translate)).toEqual({ kind: 'loading' })
  })
})

describe('resolveTemplateLabel', () => {
  it('카탈로그 문구를 쓴다', () => {
    expect(resolveTemplateLabel(CONFLUENCE, translate)).toBe('Confluence (Data Center)')
  })

  it('카탈로그에 키가 없으면 templateId 로 낮춘다', () => {
    const unknown: ConnectorTemplateInfoDto = { ...CONFLUENCE, i18nKey: 'skills.templates.jira' }
    expect(resolveTemplateLabel(unknown, translate)).toBe('confluence')
  })
})
