// AC9 — 선택된 provider 의 credential 이 **실제 subprocess env** 에 병합되고, 미인증이면 그
// 키가 드롭된다. `llm/index.ts` 단위 테스트가 조인 규칙을 보고, 여기서는 `buildTurnEnv` 가
// 그것을 실제로 부르는지를 본다(호출부가 안 부르면 조인은 아무 일도 하지 않는다).
//
// `turn-setup.ts` 는 `infra/ipc/send`(소유권 표시 발신)와 `infra/log`(중앙 로거)를 통해
// electron 을 문다 — 둘 다 이 판정과 무관하므로 모듈째 모킹한다(P29: electron 을 무는 파일은
// 테스트가 즉시 죽는다). `orca-config`(appEnv)도 파일을 읽으므로 모킹한다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '../../contracts/auth'

const appEnvMock = vi.hoisted(() => vi.fn<() => Record<string, string>>(() => ({})))
vi.mock('../../infra/config/orca-config', () => ({ appEnv: appEnvMock }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
// 중앙 로거는 `app.getPath` 로 로그 디렉토리를 잡는다 — 판정과 무관하므로 no-op 로 대체한다.
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) })
}))

const { buildTurnEnv } = await import('./turn-setup')
type Ctx = Parameters<typeof buildTurnEnv>[0]

const GATEWAY: Provider = {
  id: 'corp-gateway',
  label: '사내 게이트웨이',
  kind: 'llm',
  origin: 'https://llm.example.corp',
  llm: { adapter: 'claude', provider: 'corp', envKey: 'ANTHROPIC_AUTH_TOKEN' },
  auth: []
}

function ctx(materialized: { env?: Record<string, string> } | null): Ctx {
  return {
    mcp: { resolver: () => () => undefined },
    providers: {
      api: { materialize: () => materialized },
      declarations: () => [GATEWAY]
    }
  } as unknown as Ctx
}

describe('buildTurnEnv (AC9)', () => {
  beforeEach(() => {
    appEnvMock.mockReturnValue({})
  })

  it('선택된 provider 의 credential 이 env 에 병합된다', () => {
    const env = buildTurnEnv(ctx({ env: { ANTHROPIC_AUTH_TOKEN: 'tok-1' } }), 'claude-corp')
    expect(env?.ANTHROPIC_AUTH_TOKEN).toBe('tok-1')
    // subprocess env 는 process.env 를 베이스로 덮어쓴다(SDK 계약).
    expect(Object.keys(env ?? {}).length).toBeGreaterThan(1)
  })

  it('미인증 provider 의 키는 드롭된다', () => {
    const env = buildTurnEnv(ctx(null), 'claude-corp')
    // 빈 문자열로 치환하지 않는다 — 인증된 것처럼 보이는 요청이 나가면 진단이 어려워진다.
    expect(env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
  })

  it('다른 provider 를 고르면 주입하지 않는다', () => {
    const env = buildTurnEnv(ctx({ env: { ANTHROPIC_AUTH_TOKEN: 'tok-1' } }), 'claude-anthropic')
    expect(env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
  })

  it('provider 플랫폼이 없으면 orca.json env 만 남는다', () => {
    appEnvMock.mockReturnValue({ ORCA_APP_VALUE: 'plain' })
    const bare = { mcp: { resolver: () => () => undefined } } as unknown as Ctx
    const env = buildTurnEnv(bare, 'claude-corp')
    expect(env?.ORCA_APP_VALUE).toBe('plain')
    expect(env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
  })

  it('provider credential 이 orca.json 전역 env 를 덮어쓴다', () => {
    // 같은 키를 둘 다 선언하면 **인증된 값이 이긴다** — 전역 env 는 폴백이지 권위가 아니다.
    appEnvMock.mockReturnValue({ ANTHROPIC_AUTH_TOKEN: 'from-orca-json' })
    const env = buildTurnEnv(ctx({ env: { ANTHROPIC_AUTH_TOKEN: 'from-provider' } }), 'claude-corp')
    expect(env?.ANTHROPIC_AUTH_TOKEN).toBe('from-provider')
  })
})
