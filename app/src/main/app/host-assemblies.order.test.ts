// 두 호스트 조립의 순서 불변식 (0324 SD-05′ · AC30′ · AC32′ · 0244).
//
// 조립은 Electron·하네스·DB 를 한꺼번에 세워 테스트에서 통째로 띄우지 못한다. 순서가 계약인 자리만
// 소스에서 읽어 잠근다 — 각 단계의 동작은 그 단계의 테스트가 본다(저장 스트림·복구·예약 작업).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripCommentsAndStrings } from '../infra/source-scan'

const read = (path: string): string =>
  stripCommentsAndStrings(readFileSync(new URL(path, import.meta.url), 'utf8'))
const agent = read('./agent-host/bootstrap.ts')
const data = read('./data-host/bootstrap.ts')

// `text` 안에서 `needles` 가 이 순서로, 각각 한 번씩만 나온다.
function expectOrder(text: string, needles: readonly string[]): void {
  const positions = needles.map((needle) => {
    const first = text.indexOf(needle)
    expect(first, `없다: ${needle}`).toBeGreaterThanOrEqual(0)
    expect(text.indexOf(needle, first + 1), `둘 이상: ${needle}`).toBe(-1)
    return first
  })
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
}

function body(text: string, signature: string): string {
  const start = text.indexOf(signature)
  expect(start, `없다: ${signature}`).toBeGreaterThanOrEqual(0)
  const next = text.indexOf('\n  }\n', start)
  return text.slice(start, next)
}

describe('에이전트 호스트 조립', () => {
  it('턴 이벤트 구독은 저장 송신(critical) → 제목 → 화면 중계 순서이고 셋뿐이다', () => {
    expect(agent.match(/bus\.on\(/g)).toHaveLength(3)
    expectOrder(agent, [
      'this.sender.onTurnEvent(turn, ev), { critical: true })',
      'titles.maybeStart(turn)',
      'this.sender.relay(turn, ev))'
    ])
  })

  it('종료는 런타임 정지 하나로 모이고, 부팅 보고는 끝난 뒤에 데이터 호스트로 보낸다', () => {
    expect(body(agent, 'async shutdown(): Promise<void>')).toContain('await this.prepareShutdown()')
    expectOrder(agent, [
      'this.bootReport.finish()',
      'this.reports.bootFinished(this.bootReport.getReport())'
    ])
  })
})

// 0324 r1.16 — 에이전트 쪽 동기 판정이 읽는 사본과 창 요청 보류의 배선. 각 모듈의 동작은
// `session-meta.test.ts`·`background-records.test.ts`·`host-port-server.test.ts` 가 본다.
describe('에이전트 호스트 조립 — 사본과 보류의 배선', () => {
  it('lease 가 바뀌면 세션 메타 사본을 먼저 따라가고 그 뒤 리소스 동기화를 돌린다', () => {
    expectOrder(body(agent, 'supervisor.subscribeLeases(() => {'), [
      'this.lifecycle.leasesChanged()',
      'this.sessionMeta.track(this.heldSessions())',
      'this.projectResourceSync?.leasesChanged()'
    ])
  })

  it('동기 판정 3자리는 사본을 읽고, 세션 종류는 데이터 호스트에 묻고, Claude 리셋 계획 전에 사본을 채운다', () => {
    expect(agent).not.toContain('sessionRows')
    expect(agent).toContain('this.sessionMeta.get(request.sessionId)')
    expect(agent).toContain('backendOf: (sessionId) => this.sessionMeta.get(sessionId)?.backend')
    expect(agent).toContain('prepare: () => this.sessionMeta.ensure(this.heldSessions())')
    expect(agent).toContain('await this.data.query.sessionAgentKind(sessionId)')
    // 사본이 바뀌면 그 사본을 읽는 동기 판정을 다시 돌린다.
    expect(agent).toContain('changed: () => this.projectResourceSync?.leasesChanged()')
  })

  it('백그라운드 기록의 동기 복원은 받아 둔 기록을 쓰고, 세션 폐기는 두 사본을 잊는다', () => {
    expect(agent).toContain(
      'loadBackgroundEvents: (sessionId) => backgroundRecords.load(sessionId)'
    )
    expect(agent).toContain(
      'prefetchBackgroundEvents: (sessionId) => backgroundRecords.prefetch(sessionId)'
    )
    const discard = body(agent, 'private discardSession(sessionId: string): void')
    expect(discard).toContain('this.sessionMeta.forget(sessionId)')
    expect(discard).toContain('this.backgroundRecords?.forget(sessionId)')
  })

  it('창 요청은 첫 설정 사본 뒤에 처리한다', () => {
    const serving = body(agent, 'serving(): Promise<void>')
    expect(serving).toContain('this.mirror.ready()')
    expect(serving).toContain('this.mirror.onReplaced(() => resolve())')
  })
})

describe('데이터 호스트 조립', () => {
  // 0324 EP-21′ — 교차 요청 5자리는 `agent-requests.ts` 가 갖는다(동작은 그 테스트).
  it('예약 셸 명령 · 로그인 프리 하네스 능력 · 확장 배포는 교차 요청 모듈로 간다', () => {
    expect(data).toContain('runShell: createRemoteShellRunner(() => this.requireAgentLink())')
    expect(data).toContain('loginFreeHost: createRemoteHarnessHost(() => this.requireAgentLink())')
    expectOrder(data, [
      'createRemoteExtensionDeploy(',
      '() => this.requireAgentLink(),\n    () => this.managedMcp?.source.refresh()'
    ])
  })

  it('설정 읽기 핸들러 등록이 시작의 첫 문장이다 — 창이 붙자마자 설정을 읽는다', () => {
    const start = body(data, 'async start(): Promise<')
    const firstStatement = start.slice(start.indexOf('{\n') + 1).trim()
    expect(firstStatement.startsWith('registerSettingsReadHandler(this.settings)')).toBe(true)
    expect(start.indexOf('await ')).toBeGreaterThan(start.indexOf('registerErrorHandlers()'))
  })

  it('DB 초기화 → 복구 → 부팅 보고 마감 순서로 선다 — 준비는 그 뒤에 알린다', () => {
    expectOrder(body(data, 'async start(): Promise<'), [
      'initDb({',
      'recoverSessionHistory(db)',
      'this.bootReport.finish()'
    ])
  })

  it('종료는 예약 작업 → 스케줄러 → DB 닫기 순서다', () => {
    expectOrder(body(data, 'async shutdown(): Promise<void>'), [
      'this.scheduledTasks?.dispose()',
      'this.scheduler?.stopAll()',
      'closeDb()'
    ])
  })

  it('부팅 보고는 에이전트 호스트의 단계를 합쳐 준다', () => {
    expect(data).toContain(
      'getBootReport: () => this.agentReports.bootReport(this.bootReport.getReport())'
    )
  })
})
