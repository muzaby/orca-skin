import { describe, expect, it } from 'vitest'
import type { AgentEnvironment, AgentModelView } from '../../../../../shared/ipc'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import { modelKey } from '../components/composer/modelSelection'
import {
  executionAgentKinds,
  executionForKind,
  executionForModel,
  executionModelOptions,
  executionOptionValue,
  executionPermissionModes,
  withExecutionEffort,
  type ExecutionModelOption
} from './executionSettings'

const model = (alias: string, isDefault = false): AgentModelView => ({
  alias,
  model: `${alias}-model`,
  isCustom: false,
  oneMillionContext: false,
  isDefault
})

const agents: AgentEnvironment[] = [
  {
    key: 'claude:team',
    adapter: 'claude',
    supported: true,
    models: [model('sonnet'), model('opus', true)]
  },
  { key: 'opencode:local', adapter: 'opencode', supported: true, models: [model('qwen')] },
  { key: 'claude:off', adapter: 'claude', supported: false, models: [model('haiku')] },
  { key: 'other:x', adapter: 'not-a-harness', supported: true, models: [model('x')] }
]

const claudeWork: PromptExecution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'sonnet-family',
  effort: 'low',
  permissionMode: 'bypass'
}

const option = (providerKey: string): ExecutionModelOption =>
  executionModelOptions(agents).find((item) => item.execution.providerKey === providerKey)!

describe('executionModelOptions', () => {
  it('지원되는 하네스의 모델만, provider 와 함께 식별되게 낸다', () => {
    const options = executionModelOptions(agents)
    expect(options.map((item) => [item.execution.providerKey, item.execution.backend])).toEqual([
      ['claude:team', 'claude'],
      ['claude:team', 'claude'],
      ['opencode:local', 'opencode']
    ])
    expect(options.map((item) => item.isDefault)).toEqual([false, true, false])
    expect(options[0]!.execution.modelFamily).toBe(modelKey(agents[0]!.models[0]!))
    expect(new Set(options.map((item) => item.value)).size).toBe(3)
    expect(options.every((item) => item.label.length > 0)).toBe(true)
  })

  it('선택지 값은 저장된 실행 설정과 같은 식으로 만든다', () => {
    const first = executionModelOptions(agents)[0]!
    expect(executionOptionValue({ ...claudeWork, ...first.execution })).toBe(first.value)
    expect(executionOptionValue(null)).toBe('')
    // provider 만 다른 같은 모델은 다른 선택지다.
    expect(executionOptionValue({ ...claudeWork, ...first.execution, providerKey: 'x' })).not.toBe(
      first.value
    )
  })
})

describe('executionForModel', () => {
  it('처음 고르면 그 하네스의 첫 작업 종류와 그 종류의 첫 권한으로 채운다', () => {
    expect(executionForModel(option('claude:team'), null)).toEqual({
      ...option('claude:team').execution,
      agentKind: 'code',
      permissionMode: executionPermissionModes({ ...claudeWork, agentKind: 'code' })[0]
    })
  })

  it('같은 하네스 안에서 모델만 바꾸면 종류·노력·권한을 유지한다', () => {
    const next = executionForModel(option('claude:team'), claudeWork)
    expect(next).toEqual({ ...claudeWork, ...option('claude:team').execution })
  })

  it('작업 종류를 지원하지 않는 하네스로 바꾸면 종류와 권한을 그 하네스에 맞춘다', () => {
    const next = executionForModel(option('opencode:local'), claudeWork)
    expect(next.backend).toBe('opencode')
    expect(next.agentKind).toBe('code')
    expect(executionAgentKinds(next)).toEqual(['code'])
    // work 의 bypass 는 code 메뉴에도 있어 유지된다.
    expect(next.permissionMode).toBe('bypass')
    expect(next.effort).toBe('low')
  })
})

describe('executionForKind', () => {
  it('새 종류의 메뉴에 있는 권한은 유지한다', () => {
    expect(executionForKind({ ...claudeWork, agentKind: 'code' }, 'bypass').permissionMode).toBe(
      'bypass'
    )
  })

  it('새 종류의 메뉴에 없는 권한은 그 종류의 대응 값으로 바꾼다', () => {
    // code 의 plan 은 work 메뉴에 없다 — work 는 plan 을 default 로 읽는다.
    const next = executionForKind({ ...claudeWork, agentKind: 'work' }, 'plan')
    expect(next.permissionMode).toBe('default')
    expect(executionPermissionModes(next)).toContain(next.permissionMode)
  })

  it('권한이 없으면 그 종류의 첫 메뉴 권한이다', () => {
    const next = executionForKind({ ...claudeWork, agentKind: 'work' }, undefined)
    expect(next.permissionMode).toBe(executionPermissionModes(next)[0])
  })
})

describe('withExecutionEffort', () => {
  it('노력을 바꾸고, 미지정이면 키를 지운다', () => {
    expect(withExecutionEffort(claudeWork, 'max')).toEqual({ ...claudeWork, effort: 'max' })
    const cleared = withExecutionEffort(claudeWork, undefined)
    expect(cleared).not.toHaveProperty('effort')
    expect(cleared).toEqual({
      backend: 'claude',
      agentKind: 'work',
      providerKey: 'claude:team',
      modelFamily: 'sonnet-family',
      permissionMode: 'bypass'
    })
  })
})
