// MCP 상세 헤더의 액션 구성을 **렌더 출력**으로 잠근다. 계약은 "활성 상태는 토글이 갖고,
// 그 밖의 동작은 케밥이 갖는다" 이고, 회귀는 조용하다 — 텍스트 버튼으로 되돌아가도
// typecheck·lint 는 통과한다.
//
// 케밥이 여는 메뉴 자체는 여기서 보지 못한다: `Popover` 는 열렸을 때만 `document.body` 로
// 포털하는데 vitest 환경이 node 라 DOM 이 없다(`vitest.config.ts`). 그래서 이 파일은
// **닫힌 상태에서 관측 가능한 것** — 토글의 존재·상태와 케밥 트리거 — 만 단언한다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다.
// useI18n 은 모듈 임포트 시 동기 초기화라 Provider 없이 렌더된다(shared/i18n/index.ts).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { McpServer } from '../../../../../../shared/ipc'
import { ko } from '../../../../shared/i18n/resources/ko'
import { McpDetail } from './McpDetail'

const server = (over: Partial<McpServer> = {}): McpServer => ({
  id: 'github',
  name: 'github',
  description: 'GitHub 도구',
  transport: 'stdio',
  enabled: true,
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  authEnvKey: 'GITHUB_TOKEN',
  url: null,
  hasAuth: true,
  ...over
})

const render = (over: Partial<McpServer> = {}): string =>
  renderToStaticMarkup(
    createElement(McpDetail, {
      server: server(over),
      onToggle: () => {},
      onEdit: () => {},
      onRemove: async () => {}
    })
  )

describe('McpDetail — 활성 상태는 토글이 갖는다', () => {
  it('토글이 서고 서버의 활성 상태를 그대로 말한다', () => {
    expect(render({ enabled: true })).toContain('role="switch" aria-checked="true"')
    expect(render({ enabled: false })).toContain('role="switch" aria-checked="false"')
  })

  it('옛 활성화/비활성화 텍스트 버튼이 없다', () => {
    // 술어는 **엘리먼트 텍스트**(`>…<`)를 본다 — 토글의 aria-label 이 "…활성화" 라
    // 부분 문자열로 재면 그것에 걸려 회귀와 구분하지 못한다.
    // 두 상태를 모두 본다: 한쪽만 보면 반대 상태에 남은 버튼을 놓친다.
    for (const enabled of [true, false]) {
      const html = render({ enabled })
      expect(html, `enabled=${enabled}`).not.toContain('>활성화<')
      expect(html, `enabled=${enabled}`).not.toContain('>비활성화<')
    }
    // 양성 짝 — 상태 문구(활성/비활성) 자체는 여전히 헤더에 남는다.
    expect(render({ enabled: true })).toContain(ko.skills.mcpDetail.active)
    expect(render({ enabled: false })).toContain(ko.skills.mcpDetail.inactive)
  })
})

describe('McpDetail — 그 밖의 동작은 케밥이 갖는다', () => {
  it('케밥 트리거가 서고 메뉴를 여는 버튼으로 표시된다', () => {
    const html = render()
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain(`aria-label="${ko.common.more}"`)
    // 닫힌 채로 렌더되므로 메뉴 항목은 아직 문서에 없다 — 열림 상태가 계약임을 함께 잠근다.
    expect(html).toContain('aria-expanded="false"')
  })

  it('제거 확인 모달은 닫힌 채로 시작한다', () => {
    expect(render()).not.toContain(ko.skills.mcpDetail.removeTitle)
  })
})
