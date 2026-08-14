// AC9 앞부분 — 선택된 provider 의 자격증명이 subprocess env 로 물질화되고, 미인증이면
// **키가 드롭**된다. `buildTurnEnv` 배선까지의 확인은 `app/chat-turn/turn-setup.test.ts`.

import { describe, expect, it } from 'vitest'
import type { Provider, ProviderApi } from '../contracts/auth'
import { findLlmProvider, llmEnvFor, llmProviderKey } from './llm-env'

const GATEWAY: Provider = {
  id: 'corp-gateway',
  label: '사내 게이트웨이',
  kind: 'llm',
  origin: 'https://llm.example.corp',
  llm: { adapter: 'claude', provider: 'corp', envKey: 'ANTHROPIC_AUTH_TOKEN' },
  auth: []
}

function api(
  materialized: ReturnType<ProviderApi['materialize']>
): Pick<ProviderApi, 'materialize'> {
  return { materialize: () => materialized }
}

describe('LLM 조인', () => {
  it('디렉토리 열거의 합성 키로 선언을 찾는다', () => {
    // `sources/settings/<adapter>/<provider>/` 트리가 만드는 키와 같은 규칙이어야 한다.
    expect(llmProviderKey(GATEWAY)).toBe('claude-corp')
    expect(findLlmProvider([GATEWAY], 'claude-corp')).toBe(GATEWAY)
    expect(findLlmProvider([GATEWAY], 'claude-anthropic')).toBeUndefined()
    expect(findLlmProvider([GATEWAY], null)).toBeUndefined()
  })

  it('llm 선언이 없는 provider 는 조인 대상이 아니다', () => {
    const service: Provider = {
      id: 'wiki',
      label: 'Wiki',
      kind: 'service',
      origin: 'https://wiki.example.corp',
      auth: []
    }
    expect(llmProviderKey(service)).toBeNull()
    expect(findLlmProvider([service], 'wiki')).toBeUndefined()
  })

  it('선택된 provider 의 credential 이 env 로 물질화된다', () => {
    const env = llmEnvFor(api({ env: { ANTHROPIC_AUTH_TOKEN: 'tok-1' } }), [GATEWAY], 'claude-corp')
    expect(env).toEqual({ ANTHROPIC_AUTH_TOKEN: 'tok-1' })
  })

  it('미인증 provider 의 키는 드롭된다 (빈 문자열 치환 금지)', () => {
    const env = llmEnvFor(api(null), [GATEWAY], 'claude-corp')
    expect(env).toEqual({})
    expect(Object.keys(env)).not.toContain('ANTHROPIC_AUTH_TOKEN')
  })

  it('선언되지 않은 provider 로는 아무것도 주입하지 않는다', () => {
    expect(llmEnvFor(api({ env: { X: '1' } }), [GATEWAY], 'claude-anthropic')).toEqual({})
    expect(llmEnvFor(api({ env: { X: '1' } }), [], 'claude-corp')).toEqual({})
  })
})
