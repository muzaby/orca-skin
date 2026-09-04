import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import type { DiffRequirementItem } from '../../../../../../shared/ipc'
import { i18n } from '../../../../shared/i18n'
import { RequirementTray } from './RequirementTray'

const requirement = (id: string, located = true): DiffRequirementItem => ({
  id,
  located,
  anchor: {
    sessionId: 'session-a',
    baselineCommit: 'base-oid',
    filePath: 'src/a.ts',
    oldLine: null,
    newLine: 2,
    hunkHeader: '@@ -1,2 +1,3 @@',
    contextBefore: ['before'],
    contextAfter: ['after'],
    comment: `comment ${id}`,
    createdAt: 10
  }
})

describe('RequirementTray SSR', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko')
  })

  it('컴포저 인용 타일의 파일·본문 정보와 제거 a11y를 렌더한다', () => {
    const html = renderToStaticMarkup(
      createElement(RequirementTray, {
        requirements: [requirement('req-1'), requirement('req-2', false)],
        onRemove: () => undefined
      })
    )

    expect(html).toContain('data-diff-requirement-tray="true"')
    expect(html).toContain('aria-label="Diff 요구사항"')
    expect(html).toContain('data-diff-requirement-chip="req-1"')
    expect(html).toContain('src/a.ts')
    expect(html).toContain('+2')
    expect(html).toContain('comment req-1')
    expect(html).toContain('위치 확인 필요')
    expect(html).toContain('aria-label="Diff 요구사항 제거: comment req-1"')
  })

  it('비어 있으면 컴포저 입력에 빈 표면을 남기지 않는다', () => {
    expect(
      renderToStaticMarkup(
        createElement(RequirementTray, { requirements: [], onRemove: () => undefined })
      )
    ).toBe('')
  })

  it('ko/en label parity를 유지한다', async () => {
    await i18n.changeLanguage('en')
    const en = renderToStaticMarkup(
      createElement(RequirementTray, {
        requirements: [requirement('req-1', false)],
        onRemove: () => undefined
      })
    )
    expect(en).toContain('aria-label="Diff requirements"')
    expect(en).toContain('Relocate before sending')
    expect(en).toContain('aria-label="Remove diff requirement: comment req-1"')
  })
})
