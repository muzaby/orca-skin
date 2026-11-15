// 세션 밖 실행 설정 — 네이티브 select 없이 한 묶음 안의 칩(모델·종류·노력·권한)이고,
// 하네스가 갖지 않는 설정의 칩은 없다. 코드 종류는 nav 세션과 같은 아이콘이다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'

const agents: AgentEnvironment[] = [
  {
    key: 'claude:team',
    adapter: 'claude',
    supported: true,
    models: [
      {
        alias: 'sonnet',
        model: 'sonnet-m',
        isCustom: false,
        oneMillionContext: false,
        isDefault: true
      }
    ]
  },
  {
    key: 'opencode:local',
    adapter: 'opencode',
    supported: true,
    models: [
      {
        alias: 'qwen',
        model: 'qwen-m',
        isCustom: false,
        oneMillionContext: false,
        isDefault: false
      }
    ]
  }
]
vi.mock('../../../shared/hooks/useAgents', () => ({ useAgents: () => agents }))
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
import { ExecutionSettingsPicker } from './ExecutionSettingsPicker'

// terminal_2 — nav 세션 행의 코드 글리프(`agentPresentation.code.navIcon`).
const CODE_NAV_PATH =
  'M480-160v-80h320v80H480ZM220-320l-56-56 183-184-183-184 56-56 240 240-240 240Z'

const render = (value: PromptExecution): string =>
  renderToStaticMarkup(createElement(ExecutionSettingsPicker, { value, onChange: () => undefined }))
const chips = (html: string): string[] =>
  [...html.matchAll(/data-menu-chip=""[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]!)

const claude: PromptExecution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'sonnet',
  effort: 'low',
  permissionMode: 'default'
}

describe('ExecutionSettingsPicker', () => {
  it('Claude 는 모델·작업 종류·노력·권한 칩 넷을 한 묶음에 낸다', () => {
    const html = render(claude)
    expect(html).not.toContain('<select')
    expect(html).toMatch(/^<div data-execution-settings=""/)
    expect(chips(html)).toEqual([
      'schedules.modal.model',
      'schedules.modal.agentKind',
      'schedules.modal.effort',
      'schedules.modal.permission'
    ])
  })

  it('OpenCode 는 작업 종류·노력·권한이 없어 모델 칩만 낸다', () => {
    const html = render({
      backend: 'opencode',
      agentKind: 'code',
      providerKey: 'opencode:local',
      modelFamily: 'qwen',
      permissionMode: 'default'
    })
    expect(chips(html)).toEqual(['schedules.modal.model'])
  })

  it('코드 작업 종류는 nav 세션과 같은 아이콘이다', () => {
    expect(render({ ...claude, agentKind: 'code' })).toContain(CODE_NAV_PATH)
    expect(render(claude)).not.toContain(CODE_NAV_PATH)
  })
})
