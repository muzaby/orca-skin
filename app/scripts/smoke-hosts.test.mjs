// `smoke-hosts.mjs` 의 판정 (0324). 실제 기동은 번들(`out/main`)이 있어야 해서 CI 의 스모크 단계가 돌린다 —
// 여기서는 관측 → 실패 목록 판정과 진입점 인자 이름의 일치를 본다.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { evaluate, HOST_ENVIRONMENT_ARG } from './smoke-hosts.mjs'

const passing = () => ({
  ready: { data: { type: 'ready', mirror: { uiLocale: 'ko' } }, agent: { type: 'ready' } },
  steps: { data: ['begin', 'end', 'ready'], agent: ['ready'] },
  results: {
    'data oo:settings:get': { ok: true, value: { theme: 'white' } },
    'data oo:session:list': { ok: true, value: [] },
    'agent oo:backend:list': { ok: true, value: { backends: [] } },
    'agent oo:agent:list': { ok: true, value: [] },
    'agent early oo:extensions:catalog': { ok: true, value: { state: 'disconnected', items: [] } },
    'agent oo:settings:get': { ok: false, error: "No handler registered for 'oo:settings:get'" }
  },
  exits: { agent: 0, data: 0 },
  exitOrder: ['agent', 'data'],
  errors: []
})

describe('smoke-hosts 판정', () => {
  it('두 호스트가 뜨고 요청이 맞게 답하고 에이전트 → 데이터로 내려가면 실패 0', () => {
    assert.deepEqual(evaluate(passing()), [])
  })

  const broken = [
    ['에이전트 호스트가 준비를 알리지 않음', (o) => delete o.ready.agent, /에이전트 호스트가 준비/],
    ['데이터 호스트가 준비를 알리지 않음', (o) => delete o.ready.data, /데이터 호스트가 준비/],
    ['UI 언어 사본 없음', (o) => delete o.ready.data.mirror, /UI 언어 사본/],
    [
      '데이터 호스트가 DB 단계 시작을 알리지 않음',
      (o) => (o.steps.data = ['end', 'ready']),
      /데이터 호스트의 기동 단계/
    ],
    [
      '데이터 호스트가 DB 단계 끝을 알리지 않음',
      (o) => (o.steps.data = ['begin', 'ready']),
      /데이터 호스트의 기동 단계/
    ],
    [
      '데이터 호스트가 DB 단계 끝보다 준비를 먼저 알림',
      (o) => (o.steps.data = ['begin', 'ready', 'end']),
      /데이터 호스트의 기동 단계/
    ],
    [
      '에이전트 호스트가 기동 단계를 알림',
      (o) => (o.steps.agent = ['begin', 'end', 'ready']),
      /에이전트 호스트의 기동 단계/
    ],
    [
      '설정 조회 오류',
      (o) => (o.results['data oo:settings:get'] = { ok: false, error: 'x' }),
      /settings:get: 오류/
    ],
    [
      '세션 목록이 배열 아님',
      (o) => (o.results['data oo:session:list'] = { ok: true, value: {} }),
      /배열이 아니다/
    ],
    [
      '하네스 목록 없음',
      (o) => (o.results['agent oo:backend:list'] = { ok: true, value: {} }),
      /하네스 목록/
    ],
    [
      '피어 조회 응답 없음',
      (o) => delete o.results['agent oo:agent:list'],
      /agent:list: 응답 없음/
    ],
    [
      '피어 포트보다 먼저 온 요청이 사본 전 읽기로 실패',
      (o) =>
        (o.results['agent early oo:extensions:catalog'] = {
          ok: false,
          error: 'Error: 설정 사본을 아직 받지 못했다'
        }),
      /early oo:extensions:catalog: 오류/
    ],
    [
      '소유하지 않은 채널을 처리',
      (o) => (o.results['agent oo:settings:get'] = { ok: true, value: {} }),
      /소유하지 않은 채널/
    ],
    ['에이전트 비정상 종료', (o) => (o.exits.agent = 1), /에이전트 호스트 종료 코드 1/],
    ['데이터 비정상 종료', (o) => (o.exits.data = 1), /데이터 호스트 종료 코드 1/],
    ['종료 순서 뒤집힘', (o) => (o.exitOrder = ['data', 'agent']), /종료 순서/],
    ['제한 시간 초과', (o) => o.errors.push('제한 시간 60000ms 초과'), /제한 시간/]
  ]
  for (const [name, breakIt, expected] of broken) {
    it(`${name} → 실패`, () => {
      const observed = passing()
      breakIt(observed)
      const failures = evaluate(observed)
      assert.ok(
        failures.some((failure) => expected.test(failure)),
        JSON.stringify(failures)
      )
    })
  }

  it('진입점 인자 이름이 호스트 런타임과 같다', () => {
    const source = readFileSync(new URL('../src/main/app/host-runtime.ts', import.meta.url), 'utf8')
    assert.ok(source.includes(`HOST_ENVIRONMENT_ARG = '${HOST_ENVIRONMENT_ARG}'`))
  })
})
