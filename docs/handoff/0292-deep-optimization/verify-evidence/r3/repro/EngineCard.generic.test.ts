// 0292 r3 verify 재현 — EP-03⁗ #15 "사유 없으면 일반 문구" 슬롯. 실행 때만
// app/src/renderer/src/features/engine/common/components/ 에 복사하고 지운다.
// HEAD 에서 통과, W03(`:37` 사유 선택 고정)·W04(`:39` 일반 키 교체)에서 실패해야 슬롯이 관측 가능하다.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it, vi } from 'vitest'
import { EngineCard } from '../../components/EngineCard'

it.each([
  ['external', 'external/x'],
  ['opencode', 'opencode/fixture']
])('shows the generic unsupported badge for an unsupported %s row without a reason', (adapter, key) => {
  const $ = load(
    renderToStaticMarkup(
      createElement(EngineCard, {
        agent: { key, adapter, supported: false, models: [] },
        onEdit: vi.fn(),
        onDelete: vi.fn()
      })
    )
  )
  expect($.text()).toContain('미지원 adapter')
  expect($.text()).not.toContain('harnessUnavailable')
  for (const text of [
    'OpenCode가 설치되어 있지 않습니다',
    '지원하지 않는 OpenCode 버전입니다',
    'OpenCode 설치 상태를 확인하지 못했습니다'
  ])
    expect($.text()).not.toContain(text)
})
