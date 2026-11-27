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

  it('세션 관측 전에 메타 사본을 채우고 하네스를 확인하며 선택 변경은 기존 런타임을 보존한다', () => {
    expect(agent).not.toContain('sessionRows')
    expect(agent).toContain('this.sessionMeta.get(request.sessionId)')
    const catalog = body(agent, '    registerExtensionCatalogHandlers(')
    expectOrder(catalog, [
      'const entries = supervisor.runtimeEntries()',
      'await this.sessionMeta.ensure(entries.map((entry) => entry.sessionId))',
      'this.sessionMeta.get(sessionId)?.backend === backend',
      'runtime.nativeResources?.()'
    ])
    expect(catalog).not.toMatch(/\.close(?:All)?\(/)
    expect(agent).toContain('await this.data.query.sessionAgentKind(sessionId)')
    // 사본이 바뀌면 그 사본을 읽는 동기 판정을 다시 돌린다.
    expect(agent).toContain('changed: () => this.projectResourceSync?.leasesChanged()')
  })

  it('리소스 요청의 세션 행은 데이터 호스트에서 다시 읽는다 — 사본만 읽지 않는다(EP-23 비동기 읽기)', () => {
    expect(body(agent, 'private sessionRow(sessionId: string)')).toContain(
      'return this.sessionMeta.refresh(sessionId)'
    )
    // 작업 폴더 해석 · 바뀜 확인 2 · 세션 범위 요청 전 채우기가 모두 그 읽기를 지난다.
    expect(agent.match(/await this\.sessionRow\(/g)).toHaveLength(4)
    expect(agent).toContain('await this.sessionRow(request.sessionId)')
  })

  it('백그라운드 기록의 동기 복원은 받아 둔 기록을 쓰고, 세션 폐기는 두 사본을 잊는다', () => {
    expect(agent).toContain(
      'loadBackgroundEvents: (sessionId) => backgroundRecords.load(sessionId)'
    )
    expect(agent).toContain(
      'prefetchBackgroundEvents: (sessionId) => backgroundRecords.prefetch(sessionId)'
    )
    const discard = body(agent, 'private discardSession(sessionId: string): void')
    expect(discard).toContain('this.sender.forgetProviderSession(sessionId)')
    expect(discard).toContain('this.sessionMeta.forget(sessionId)')
    expect(discard).toContain('this.backgroundRecords?.forget(sessionId)')
  })

  it('창 요청은 첫 설정 사본 뒤에 처리한다', () => {
    const serving = body(agent, 'serving(): Promise<void>')
    expect(serving).toContain('this.mirror.ready()')
    expect(serving).toContain('this.mirror.onReplaced(() => resolve())')
  })
})

// 0324 r1.16 sweep — 조립 안 배선 중 단계 모듈의 테스트가 닿지 않는 자리(B29). 동작은 각 모듈 테스트.
describe('에이전트 호스트 조립 — 수명 이벤트 · 깨어남 배선', () => {
  it('수명 이벤트 원천 넷이 각자의 진입점에 걸린다(EP-11)', () => {
    expect(body(agent, 'private discardSession(sessionId: string): void')).toContain(
      'this.lifecycle.sessionEnded(sessionId)'
    )
    expectOrder(agent, [
      'new ApprovalCoordinator((sessionId) =>',
      'this.lifecycle.approvalPending(sessionId)'
    ])
    expect(agent).toContain(
      'onHarnessExited: (sessionId) => this.lifecycle.harnessExited(sessionId)'
    )
  })

  it('창 포커스는 하네스 설치 재확인만 부른다 — 절전 해제는 원인이 아니다(EP-10)', () => {
    const raw = readFileSync(new URL('./agent-host/bootstrap.ts', import.meta.url), 'utf8')
    expect(raw).toContain("if (reason === 'window-focus') this.registry.focusRecheck()")
  })
})

describe('데이터 호스트 조립 — 셸 서비스 · 언어 사본 배선', () => {
  it('비밀 봉인·해제는 셸 서비스로 간다(EP-10)', () => {
    const raw = readFileSync(new URL('./data-host/bootstrap.ts', import.meta.url), 'utf8')
    expect(raw).toContain("isAvailable: () => shellServices().call('secrets.isAvailable')")
    expect(raw).toContain("encrypt: (plain) => shellServices().call('secrets.encrypt', plain)")
    expect(raw).toContain("decrypt: (cipher) => shellServices().call('secrets.decrypt', cipher)")
  })

  it('절전 해제·화면 잠금 해제마다 못 푼 비밀을 다시 푼다 — 창 포커스는 아니다(EP-10)', () => {
    const raw = readFileSync(new URL('./data-host/bootstrap.ts', import.meta.url), 'utf8')
    expect(raw).toContain("if (reason !== 'window-focus') void this.secrets.retryUndecryptable()")
  })

  it('셸의 UI 언어 사본은 설정 패치로 알린다(EP-14)', () => {
    expect(data).toContain(
      'watchShellLocale(this.settings, (message) => this.host.toShell(message))'
    )
  })
})

describe('셸 조립 — 셸 상태 파일 배선(EP-14)', () => {
  it('창 위치는 셸 상태 파일에서 읽고 닫을 때 저장하며, 호스트가 알린 언어를 그 파일에 둔다', () => {
    const entry = read('../index.ts')
    expect(entry).toContain('const saved = shellState.windowBounds()')
    expect(entry).toContain('shellState.saveWindowBounds(mainWindow.getBounds())')
    expect(entry).toContain('mirrorUiLocale: (uiLocale) => shellState.mirrorUiLocale(uiLocale)')
  })

  it('데이터 호스트의 준비 메시지가 UI 언어 사본을 싣는다', () => {
    expect(data).toContain('mirror: { uiLocale: this.settings.getAll().uiLocale }')
  })
})

// 0324 AC28 · VP-31 — 셸의 업데이트 재시작 게이트는 수명 이벤트로 만든 상태만 본다. 상태 계산은
// `shell/lifecycle-state.test.ts`, 게이트 판정은 `shared/update-restart.test.ts` 가 본다.
describe('셸 조립 — 재시작 게이트 배선', () => {
  it('생성 중 판정은 수명 상태의 활성 턴이고, 수명 상태가 바뀌면 게이트를 다시 계산한다', () => {
    const entry = read('../index.ts')
    expect(body(entry, 'restartGateState: () => ({')).toContain(
      'isGenerating: lifecycleState.hasActiveTurns()'
    )
    expect(entry).toContain('lifecycleState.onChange(() => updates.refreshGate())')
  })
})

// 0324 EP-24 ⑨⑩⑪ · AC50 — 준비 마감의 배선. 마감 규칙은 `shell/host-supervisor.test.ts`, 실제 번들의 알림
// 순서는 `scripts/smoke-hosts.mjs` 가 본다.
describe('준비 마감 배선(EP-24)', () => {
  it('셸의 두 감독자는 준비 마감 · 긴 단계 판정 · 만료 로그를 받는다', () => {
    const entry = read('../index.ts')
    const supervisor = body(entry, 'createHostSupervisor<MessagePortMain>({')
    expect(supervisor).toContain('readyTimeoutMs: HOST_READY_TIMEOUT_MS')
    expect(supervisor).toContain('startStep: hostStartStep')
    expect(supervisor).toContain('onReadyTimeout: () =>')
  })

  it('데이터 호스트는 DB 단계 앞에서 시작을 알리고 양보한 뒤 열고, 복구 뒤 끝을 알린다', () => {
    // 문자열 값이 판정이라 원문을 읽는다(시작·끝이 같은 꼴이다).
    const raw = readFileSync(new URL('./data-host/bootstrap.ts', import.meta.url), 'utf8')
    expectOrder(raw, [
      "this.host.toShell({ type: 'boot.step', state: 'begin' })",
      'await new Promise<void>((resolve) => setImmediate(resolve))',
      'initDb({',
      'recoverSessionHistory(db)',
      "this.host.toShell({ type: 'boot.step', state: 'end' })",
      "return { type: 'ready'"
    ])
  })
})

describe('셸 조립 — 창 포트의 신뢰 판정', () => {
  it('호스트에 넘기는 창의 신뢰 판정은 그 창의 최상위 앱 문서 판정이다(EP-9)', () => {
    const shell = read('./shell/electron-hosts.ts')
    expect(shell).toContain('trusted: () => isTrustedAppDocument(contents, rendererUrl)')
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
