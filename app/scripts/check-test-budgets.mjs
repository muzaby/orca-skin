#!/usr/bin/env node
// 실-git 테스트의 **파일 레벨 시간 예산** 게이트.
//
// 0218 러너에서 12건이 죽었는데 기능 결함은 0건이었다. 전부 한 연쇄였다 — 케이스가 전역
// 20초 예산을 넘겨 끊기고, 그때 떠 있던 git 자식이 임시 저장소를 잡은 채 남아 정리 `rm` 이
// EBUSY/EPERM 으로 또 실패하고, 그 두 번째 실패가 스위트 전체를 무너뜨렸다.
//
// 조치(파일마다 `vi.setConfig` 예산 + `removeTempRoots` 정리)는 옳았지만 **새 스위트에
// 자동으로 따라붙지 않는다**. 실제로 첫 조치에서 네 파일이 조용히 빠졌고(`git-cli` ·
// `git-diff-commit` · `queue-entry` · `repository`), `service.test.ts` 는 198초 예산을 받고도
// 케이스에 남은 30초 인라인 캡이 그 예산을 이겨 그대로 죽었다. 사람이 세는 한 또 빠진다.
//
// 그래서 다섯 가지를 강제한다.
//
// (A) **대상 판정** — `git` 바이너리를 직접 띄우거나, 프로덕션 `runGit` 을 (가짜 주입 없이)
//     부르거나, 공용 픽스처를 쓰는 `*.test.ts` 가 실-git 스위트다. 저장소를 세우려면 반드시
//     이 셋 중 하나를 지나므로 문이 닫힌다. 모듈 이름으로 넓히면 mock 한 단위 테스트가
//     무더기로 걸린다 — 실측으로 이 세 신호가 10/10 이고 오탐 0 이다.
// (B) **예산** — 최상위 `vi.setConfig` 에 `testTimeout` 과 `hookTimeout` 이 **둘 다** 있어야
//     한다. 훅 기본값 10초는 실제 저장소를 세우는 `beforeAll` 을 애초에 담지 못한다.
// (C) **인라인 캡 금지** — 케이스별 타임아웃은 파일 예산보다 작을 때 조용히 이긴다. 값이
//     지금 충분한지와 무관하게 형태 자체를 막는다. 예산의 소유자는 파일 하나여야 한다.
// (D) **정리 경로** — `removeTempRoots` 를 지나야 한다. 직접 `rm` 하면 끊긴 케이스가 남긴
//     고아 git 자식을 밟아 (A) 가 막으려던 두 번째 실패가 그대로 돌아온다.
// (E) **프로세스 상한** — 테스트가 `runGit` 을 픽스처로 쓸 때 프로덕션 기본 10s 를 상속하면
//     안 된다. 그 캡은 앱이 멈춘 git 을 보고하기까지의 값이지 테스트의 예산이 아니고, (C) 가
//     막은 "더 작은 캡이 파일 예산을 조용히 이긴다" 가 한 층 아래에서 그대로 일어난다 —
//     `prepare-progress` 의 `worktree add` 가 병렬 부하에서 10s 를 넘겨 죽었고 99s 파일
//     예산은 닿지도 않았다. 값을 직접 적는 것도 막고 픽스처 상수 하나만 받는다.
//
// 0294 부터는 **모든** 테스트 소스에 세 가지를 더 강제한다 — 기준 PC 가 5년 전 사무용
// 데스크톱이라 예산은 언제나 `기준값 × 배율`(`scripts/test-time.mjs`)이어야 한다.
//
// (F) **배율 경유** — `vi.setConfig` 인자는 `scaledBudget({...})`, 케이스·훅 타임아웃 인자는
//     `scaleMs(...)` 여야 한다. 리터럴로 남은 예산은 배율을 무시하고, 전역(×배율)보다 작아져
//     "더 작은 캡이 이긴다" 를 다시 만든다.
// (G) **픽스처 상한 > 최대 파일 예산** — 둘 다 같은 배율을 받으므로 기준값으로 비교한다.
// (H′) **테스트 소유 실시간 마감** — 테스트가 고른 시간 값이 실제 경과의 상한이 되는 7형태
//     (타이머 지연 · `x.setTimeout(N)` · `AbortSignal.timeout(N)` · `now()` 마감 산술·비교 ·
//     경과 상한 단언 · `/timeout/i` 옵션(중첩 `timeouts` 객체·자식 프로세스·production 시간 인자) ·
//     `/timeout/i` 매개변수 기본값). 값은 같은 파일 상수·`??`/`||`·리터럴 산술까지 따라간다.
//     임계 1000ms, 단 abort·자식 프로세스 timeout 은 임계 없이 본다. 예산은 `scaleMs` 를 지나고,
//     시간 초과 자체를 시험하거나 데이터·하한인 **의미 값**은 `SEMANTIC_DELAYS` 에
//     `{file, value, count, reason}` 으로 등록한다 — 게이트가 자리 수를 count 와 대조한다.
//     `vi.waitFor` 옵션 안의 `scaleMs` 는 이중 배율이라 막는다. (F)(H′) 범위는 `*.test.ts` 와
//     `*.testfixture.ts(x)` 다 — (A)~(E) 는 `*.test.ts` 만 본다.
//     0294 ΔV2 — 판정이 읽는 식은 전부 같은 파일 바인딩 해석기(`test-budget-bindings.mjs`)를 지난다:
//     단축 속성·대입·클래스 필드·구조 분해 기본값·`/timeout/i` 이름 변수(named) 슬롯, now 변수·`+=`,
//     같은 파일 함수의 인자·반환, 변수에 담은 `vi.waitFor` 옵션까지. 문법 노드만 보면 같은 계약을
//     다른 문법으로 쓴 자리가 조용히 지난다. (F) 는 그대로 인라인 형태만 통과시킨다(fail-closed).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import ts from 'typescript'
import { createBindings, keyOf } from './test-budget-bindings.mjs'

const TEST_ROOT = 'src'
const FIXTURE = 'temp-repo.testfixture'
/** (E) 가 요구하는 픽스처 상수 이름. 값이 아니라 **이름** 으로 받는다 — 숫자를 직접 적으면
 *  그 자리마다 다시 작아질 수 있고, 상한의 근거는 픽스처 한 곳이 갖는다. */
const FIXTURE_CAP = 'FIXTURE_GIT_TIMEOUT_MS'

// `git` 바이너리를 직접 띄우는 형태. `promisify(execFile)` 로 감싼 별칭은 잡지 못하지만,
// 그 경로는 (D) 가 요구하는 픽스처를 지나므로 `FIXTURE` 신호에 걸린다.
const SPAWN_GIT = /(?:execFile|execFileSync|spawn|spawnSync|exec)\s*\(\s*['"]git['"]/

// 프로덕션 러너를 통한 간접 spawn. **이 신호가 없으면 문이 새어 있었다** —
// `git-diff-commit.test.ts` 와 `prepare-progress.test.ts` 는 임시 저장소를 `runGit(dir,
// ['init', …])` 으로 세워서 리터럴 `'git'` 이 한 번도 나오지 않는다. 0218 조치 전 트리에
// 게이트를 돌려 보고서야 드러났다(10개 중 8개만 대상으로 잡혔다).
const RUN_GIT = /\brunGit\s*\(/
// 러너 자체의 단위 테스트는 가짜 구현을 주입하므로 실제로 띄우지 않는다 — 유일한 예외이고,
// 이름이 아니라 **주입한다는 사실**로 가른다.
const INJECTS_RUNNER = /execFileImpl/

// 실제 `runGit` 호출의 시작. `/\brunGit\s*\(/` 같은 **정규식 리터럴 본문은 잡지 않는다** —
// 거기서는 `runGit` 다음이 백슬래시라 이 패턴이 요구하는 공백·`(` 가 아니다
// (`ipc-integration.test.ts` 가 그 형태를 값으로 들고 있다).
const RUN_GIT_CALL = /\brunGit\s*\(/g

// 케이스/훅의 세 번째 인자 형태 — `  }, 30000)` · `  }, 30_000)`.
const INLINE_TRAILING = /^\s*\}\s*,\s*(\d[\d_]*)\s*\)/gm
// 옵션 객체 형태 — `it('x', { timeout: 30000 }, fn)` · `describe('x', { timeout: 30000 })`.
const INLINE_OPTION = /\{\s*timeout:\s*(\d[\d_]*)/g

/**
 * 줄 전체가 주석인 줄과 블록 주석만 지운다.
 *
 * **문자열 안의 `//` 를 건드리지 않는 것이 요점이다** — `git-cli.test.ts` 는
 * `'https://github.com/owner/repo'` 를 단언 값으로 들고 있어서, 흔한 "`//` 뒤를 자른다" 식
 * 제거는 그 줄의 뒷부분을 통째로 날린다. 신호가 그 줄에 있으면 게이트가 무음으로 통과한다.
 */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * 최상위 `vi.setConfig(scaledBudget({ … }))`(또는 리터럴 `vi.setConfig({ … })`)의 두 **기준값**.
 * 없으면 null. `scaled` 는 배율 경유 여부 — 리터럴 형태는 규칙 (F) 위반이다.
 */
export function parseBudget(text) {
  const call = /vi\.setConfig\(\s*(scaledBudget\(\s*)?\{([^}]*)\}\s*\)/.exec(text)
  if (!call) return null
  const body = call[2]
  const read = (key) => {
    const hit = new RegExp(`${key}\\s*:\\s*(\\d[\\d_]*)`).exec(body)
    return hit ? Number(hit[1].replace(/_/g, '')) : null
  }
  return { testTimeout: read('testTimeout'), hookTimeout: read('hookTimeout'), scaled: !!call[1] }
}

/** 케이스별 인라인 타임아웃 값 목록. */
export function findInlineTimeouts(text) {
  const found = []
  for (const re of [INLINE_TRAILING, INLINE_OPTION]) {
    re.lastIndex = 0
    let hit
    while ((hit = re.exec(text)) !== null) found.push(hit[1])
  }
  return found
}

/**
 * `text[open]` 의 `(` 와 짝이 맞는 `)` 안쪽. 문자열 리터럴 속 괄호는 깊이로 세지 않는다 —
 * `throw new Error(\`git ${args.join(' ')}\`)` 같은 인자가 흔하다.
 */
function readCallArgs(text, open) {
  let depth = 0
  let quote = null
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  return text.slice(open + 1)
}

/** 픽스처 상한을 넘기지 않는 `runGit` 호출 목록. 통과면 빈 배열. */
export function findUncappedRunGit(text) {
  const found = []
  RUN_GIT_CALL.lastIndex = 0
  let hit
  while ((hit = RUN_GIT_CALL.exec(text)) !== null) {
    const open = text.indexOf('(', hit.index)
    if (open === -1) continue
    const args = readCallArgs(text, open)
    if (!args.includes(FIXTURE_CAP)) {
      found.push(`runGit(${args.replace(/\s+/g, ' ').trim().slice(0, 60)})`)
    }
  }
  return found
}

/** 실-git 스위트인가. */
export function isRealGitSuite(text) {
  if (text.includes(FIXTURE)) return true
  if (SPAWN_GIT.test(text)) return true
  return RUN_GIT.test(text) && !INJECTS_RUNNER.test(text)
}

/** 대상이 아니면 null, 대상이면 위반 목록(빈 배열이면 통과). */
export function analyze(relPath, source) {
  const text = stripComments(source)
  if (!isRealGitSuite(text)) return null
  const errors = []

  const budget = parseBudget(text)
  if (!budget) {
    errors.push('파일 예산이 없다 — 최상위에 `vi.setConfig({ testTimeout, hookTimeout })` 을 둔다')
  } else {
    if (budget.testTimeout == null) errors.push('`vi.setConfig` 에 testTimeout 이 없다')
    if (budget.hookTimeout == null) errors.push('`vi.setConfig` 에 hookTimeout 이 없다')
  }

  const inline = findInlineTimeouts(text)
  if (inline.length > 0) {
    errors.push(
      `케이스별 인라인 타임아웃(${inline.join(', ')}) — 파일 예산보다 작으면 조용히 이긴다. 예산은 파일이 소유한다`
    )
  }

  const uncapped = findUncappedRunGit(text)
  if (uncapped.length > 0) {
    errors.push(
      `프로덕션 기본 상한을 상속하는 runGit 호출(${uncapped.join(' · ')}) — 10s 가 파일 예산보다 먼저 끊는다. \`{ timeoutMs: ${FIXTURE_CAP} }\` 을 넘긴다`
    )
  }

  if (!text.includes('removeTempRoots')) {
    errors.push(
      '정리가 `removeTempRoots` 를 지나지 않는다 — 끊긴 케이스가 남긴 고아 git 자식을 밟아 rm 이 EBUSY/EPERM 으로 실패한다'
    )
  }

  return { path: relPath, errors }
}

// ── 0294 (F)(G)(H′) — 모든 테스트 소스, TypeScript AST ─────────────────────────────

/**
 * production 계약을 시험하는 **의미 값** — 배율하면 시험 대상이 바뀐다(가짜 시계·데이터·하한 대기).
 * `value` 는 리터럴 원문, `count` 는 같은 파일·같은 값의 (H′) 자리 수다. 게이트가 수를 대조하므로
 * 같은 값의 새 자리(새 예산일 수 있다)도, 지운 자리(낡은 항목)도 걸린다.
 */
export const SEMANTIC_DELAYS = [
  {
    file: 'main/adapters/opencode/v1/adapter.persistent.test.ts',
    value: '2700',
    count: 1,
    reason: 'SDK transport 의 실제 AbortSignal.timeout(2.5s) 을 넘겨야 하는 대기'
  },
  {
    file: 'main/app/handlers/session-resources.claude-assembly.test.ts',
    value: '1000',
    count: 1,
    reason: '설정 파일 mtime 을 구별하기 위한 1초 간격'
  },
  {
    file: 'main/features/plugins/mail/sync-manager.test.ts',
    value: '25_000',
    count: 1,
    reason: '가짜 타이머 아래의 느린 서버 응답 자극 — 명령 타임아웃보다 늦어야 한다'
  },
  {
    file: 'main/adapters/opencode/v1/adapter.test.ts',
    value: '5_001',
    count: 1,
    reason: 'vi.setSystemTime 으로 신선도 만료 직후를 만든다'
  },
  {
    file: 'main/adapters/opencode/v1/adapter.test.ts',
    value: '5000',
    count: 1,
    reason: 'vi.setSystemTime 으로 신선도 만료 경계를 만든다'
  },
  {
    file: 'main/infra/git/git-snapshot.test.ts',
    value: '60_000',
    count: 1,
    reason: '미래 시각 데이터(bornAt) — 대기가 아니다'
  },
  {
    file: 'main/app/chat-turn/background.monitor.test.ts',
    value: '5000',
    count: 2,
    reason: 'Monitor 도구 입력·출력 데이터 — production 은 이 값으로 타이머를 걸지 않는다'
  },
  {
    file: 'main/app/chat-turn/background.monitor.test.ts',
    value: '9000',
    count: 2,
    reason: '같은 데이터 + 가짜 타이머로 요청 마감 경과를 만드는 값(advanceTimersByTimeAsync(9001))'
  },
  {
    file: 'main/app/handlers/engine.opencode.integration.test.ts',
    value: '8000',
    count: 1,
    reason: 'OpenCode provider 설정 문서의 데이터 — 왕복 보존을 시험한다, 대기가 아니다'
  },
  {
    file: 'main/features/approvals/broker.test.ts',
    value: '1000',
    count: 3,
    reason: '가짜 타이머 아래 승인 만료 계약값 — advanceTimersByTime 과 짝이다'
  },
  {
    file: 'main/features/plugins/mail/sync-manager.test.ts',
    value: '15_000',
    count: 1,
    reason: '가짜 타이머 아래 연결 시간 초과 계약값(파일 전체 useFakeTimers)'
  },
  {
    file: 'main/features/plugins/mail/sync-manager.test.ts',
    value: '30_000',
    count: 1,
    reason:
      "가짜 타이머 아래 명령 시간 초과 계약값 — 'slow' 응답(25_000)은 이보다 짧고 'command-timeout' 은 이것을 넘긴다"
  },
  {
    file: 'main/infra/test-environment.test.ts',
    value: '1_500',
    count: 1,
    reason: 'vi.waitFor 가 vitest 기본 1초보다 오래 재시도함을 보이는 하한 — 마감이 아니다'
  },
  {
    file: 'renderer/src/features/chat/lib/taskBoard.test.ts',
    value: '30_000',
    count: 1,
    reason: 'TaskOutput 도구 입력 데이터'
  },
  {
    file: 'renderer/src/features/engine/harnesses/opencode/ProviderForm.interaction.test.ts',
    value: '3000',
    count: 1,
    reason: 'provider 설정 데이터(가져오기 보존)'
  },
  {
    file: 'renderer/src/features/engine/harnesses/opencode/v1/customProvider.test.ts',
    value: '1200',
    count: 1,
    reason: 'provider 설정 데이터'
  },
  // ΔV2 — now 식 바인딩 해석과 `+=` 형태가 새로 센 자리. 전부 가짜·주입 시계와 데이터다.
  {
    file: 'main/adapters/opencode/v1/discovery-cache.poll-race.test.ts',
    value: '1001',
    count: 9,
    reason: '`Date.now` mock 시계(now)를 캐시 신선도 1초 너머로 진행하는 값 — 실시간 대기가 아니다'
  },
  {
    file: 'main/adapters/opencode/v1/discovery-cache.poll-race.test.ts',
    value: '5000',
    count: 1,
    reason: '`utimes` 로 쓰는 파일 mtime 데이터 — 대기가 아니다'
  },
  {
    file: 'main/adapters/opencode/v1/discovery-cache.test.ts',
    value: '1001',
    count: 1,
    reason: '`Date.now` mock 시계 진행(캐시 만료)'
  },
  {
    file: 'main/app/deployment/mail.integration.test.ts',
    value: '299_000',
    count: 1,
    reason: '동기화 관리자에 주입한 시계(`now: () => now`)를 신선도 5분 직전까지 진행'
  },
  {
    file: 'main/app/deployment/mail.integration.test.ts',
    value: '2_000',
    count: 1,
    reason: '같은 주입 시계로 신선도 5분 경계를 넘긴다'
  },
  {
    file: 'main/app/deployment/mail.integration.test.ts',
    value: '301_000',
    count: 4,
    reason: '같은 주입 시계로 신선도 5분을 넘긴다'
  },
  {
    file: 'main/app/deployment/mail.integration.test.ts',
    value: '15 * 86400_000',
    count: 1,
    reason: '같은 주입 시계로 보존 기간 경계를 넘긴다'
  }
]

const TEST_CALLS = new Set(['it', 'test', 'describe', 'bench', 'suite'])
const HOOK_CALLS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach'])
/** (H′) 임계 — 1초 미만 자리는 실측상 전부 시간 초과 유발값·순서용 하한 대기다. */
const DEADLINE_MIN_MS = 1000
/** 옵션의 `timeout` 이 임계 없이 상한인 자식 프로세스 호출. */
const CHILD_PROCESS = new Set([
  'execFile',
  'execFileSync',
  'spawn',
  'spawnSync',
  'exec',
  'execSync',
  'fork'
])
const TIMEOUT_NAME = /timeout/i
const SK = ts.SyntaxKind
const COMPARE = new Set([
  SK.LessThanToken,
  SK.LessThanEqualsToken,
  SK.GreaterThanToken,
  SK.GreaterThanEqualsToken
])
const SLOT_ASSIGN = new Set([SK.EqualsToken, SK.QuestionQuestionEqualsToken, SK.BarBarEqualsToken])
const UPPER_MATCHERS = new Set(['toBeLessThan', 'toBeLessThanOrEqual'])
const UPPER_MATCHERS_FLIPPED = new Set(['toBeGreaterThan', 'toBeGreaterThanOrEqual'])

function rootName(expr) {
  let e = expr
  while (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e)) e = e.expression
  return ts.isIdentifier(e) ? e.text : null
}
const isFn = (node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node)
const isCallTo = (node, name) =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name

/**
 * (H′) 테스트 소유 실시간 마감 — 테스트가 고른 시간 값이 실제 경과 시간의 **상한**이 되는 자리.
 * 각 자리는 `{ form, line, node, value, valueLine, scaled }`. `value` 는 리터럴 원문(배율이면 null).
 *
 * 식은 전부 `createBindings` 해석기를 지난다(D-015) — 형태의 호출 대상 · now 식 · 값 · 옵션 객체 · 맥락.
 * 형태 8(D-016) — timer(`setTimeout`·`setInterval` 전역·`globalThis.`·`window.` · `timers/promises`
 * 의 `setTimeout` 첫 인자) · method(`x.setTimeout(N)`) · abort(`AbortSignal.timeout`) · deadline
 * (now 식 `+ N` · `N +` · `+= N` · now 식과 N 의 비교 — now 식끼리는 아님) · elapsed(`expect(now 식)
 * .toBeLessThan(OrEqual)(N)` · `expect(N).toBeGreaterThan(OrEqual)(now 식)`) · option(`/timeout/i`
 * 이름의 객체 속성·단축 속성·대입·클래스 필드 · `/timeout/i` 이름에 담긴 객체의 숫자 속성) ·
 * param(`/timeout/i` 매개변수·구조 분해 기본값) · named(`/timeout/i` 이름 변수 초기값·식별자 대입).
 * 임계 1000ms — 단 abort 와 자식 프로세스 옵션의 timeout 은 임계 없이 센다.
 * 제외 — `scaleMs`·`scaledBudget`·`vi.setConfig` 인자 · `vi.waitFor` 옵션(setup 이 배율, 이중 배율은
 * 별도 위반) · it/test/describe/훅 타임아웃 인자((F) 몫) · matcher 피연산자. 단 `expect(x)` 의 x 와
 * elapsed 의 상한 인자는 센다. 맥락은 사용 자리에서 본다 — 변수에 담긴 슬롯은 그 변수의 참조가
 * 전부 제외 자리일 때만 제외, 자식 프로세스·`timeouts` 소유는 참조 하나라도.
 * 한 리터럴은 한 자리 — 소스 전위 순회에서 처음 센 슬롯이 그 자리다.
 */
export function scanDeadlineSites(relPath, source) {
  const b = createBindings(relPath, source)
  const { src } = b
  const lineOf = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1
  const timerAliases = new Set(
    [...b.importAliases(/^(node:)?timers\/promises$/)]
      .filter(([, original]) => original === 'setTimeout')
      .map(([local]) => local)
  )
  const childAliases = new Map(
    [...b.importAliases(/^(node:)?child_process$/)].filter(([, original]) =>
      CHILD_PROCESS.has(original)
    )
  )
  const calleeOf = (call) => {
    const name = b.calleeName(call)
    return childAliases.get(name) ?? name
  }

  // keepMatcher: elapsed 형태는 상한 자체가 matcher 인자라 그 제외를 건너뛴다.
  const excludedHere = (node, keepMatcher) => {
    for (let child = node, p = node.parent; p; child = p, p = p.parent) {
      if (!ts.isCallExpression(p)) continue
      const argIndex = p.arguments.indexOf(child)
      if (argIndex < 0) continue
      const callee = calleeOf(p)
      if (callee === 'scaleMs' || callee === 'scaledBudget' || callee === 'vi.setConfig')
        return true
      if (callee === 'vi.waitFor' && argIndex >= 1) return true
      const root = rootName(p.expression)
      if (root && (TEST_CALLS.has(root) || HOOK_CALLS.has(root))) {
        const afterFn = p.arguments.slice(0, argIndex).some(isFn)
        if (afterFn || ts.isObjectLiteralExpression(child)) return true
      }
      // matcher 의 인자 · expect.<helper>(…) 의 인자. expect(x) 의 x 는 실제 호출이라 센다.
      if (!keepMatcher && root === 'expect' && !isCallTo(p, 'expect')) return true
    }
    return false
  }
  const excluded = (slot, keepMatcher) => {
    const uses = b.usesOf(slot)
    return uses.length > 0 && uses.every((use) => excludedHere(use, keepMatcher))
  }
  /** 객체 사용 자리 하나가 자식 프로세스 호출의 인자인가(전개·괄호 사이 포함). */
  const usedByChildProcess = (objectExpression) =>
    b.objectUses(objectExpression).some((use) => {
      let at = use
      while (
        at.parent &&
        (ts.isSpreadAssignment(at.parent) ||
          ts.isObjectLiteralExpression(at.parent) ||
          ts.isParenthesizedExpression(at.parent))
      )
        at = at.parent
      const call = at.parent
      if (!call || !ts.isCallExpression(call) || !call.arguments.includes(at)) return false
      return CHILD_PROCESS.has(calleeOf(call).split('.').pop())
    })
  /** 객체 리터럴이 `/timeout/i` 이름의 속성·단축 속성·변수에 담겼는가(바인딩 참조 하나라도). */
  const ownedByTimeoutName = (object, depth = 0) => {
    if (!object || depth > 8 || !ts.isObjectLiteralExpression(object)) return false
    for (const use of b.objectUses(object)) {
      let owner = use.parent
      while (owner && (ts.isParenthesizedExpression(owner) || ts.isAsExpression(owner)))
        owner = owner.parent
      if (!owner) continue
      const named =
        ts.isPropertyAssignment(owner) ||
        ts.isShorthandPropertyAssignment(owner) ||
        ts.isVariableDeclaration(owner)
      if (named && TIMEOUT_NAME.test(keyOf(owner.name))) return true
      if (
        (ts.isPropertyAssignment(owner) || ts.isShorthandPropertyAssignment(owner)) &&
        ownedByTimeoutName(owner.parent, depth + 1)
      )
        return true
    }
    return false
  }

  const seen = new Set()
  const sites = []
  const push = (form, slot, valueNode, options = {}) => {
    if (!valueNode || excluded(slot, form === 'elapsed')) return
    const noThreshold = form === 'abort' || !!options.childProcess
    for (const v of b.values(valueNode)) {
      if (!v.scaled && !noThreshold && v.value < DEADLINE_MIN_MS) continue
      const key = v.literal.getStart(src)
      if (seen.has(key)) continue
      seen.add(key)
      sites.push({
        form,
        node: slot,
        line: lineOf(slot),
        valueLine: lineOf(v.literal),
        value: v.scaled ? null : v.literal.getText(src),
        scaled: v.scaled
      })
    }
  }
  const optionSlot = (slot, valueNode, objectExpression) =>
    push('option', slot, valueNode, {
      childProcess: !!objectExpression && usedByChildProcess(objectExpression)
    })

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = calleeOf(node)
      const access = ts.isPropertyAccessExpression(node.expression) ? node.expression : null
      if (/^(globalThis\.|window\.)?(setTimeout|setInterval)$/.test(callee))
        push('timer', node, node.arguments[1])
      else if (timerAliases.has(callee)) push('timer', node, node.arguments[0])
      else if (/\.setTimeout$/.test(callee)) push('method', node, node.arguments[0])
      else if (callee === 'AbortSignal.timeout') push('abort', node, node.arguments[0])
      else if (access && isCallTo(access.expression, 'expect')) {
        const subject = access.expression.arguments[0]
        const bound = node.arguments[0]
        if (UPPER_MATCHERS.has(access.name.text) && b.isNow(subject)) push('elapsed', node, bound)
        else if (
          UPPER_MATCHERS_FLIPPED.has(access.name.text) &&
          b.isNow(bound) &&
          !b.isNow(subject)
        )
          push('elapsed', node, subject)
      }
    }
    if (ts.isBinaryExpression(node)) {
      const k = node.operatorToken.kind
      const leftNow = b.isNow(node.left)
      const rightNow = b.isNow(node.right)
      if ((k === SK.PlusToken || k === SK.PlusEqualsToken) && leftNow && !rightNow)
        push('deadline', node, node.right)
      else if (k === SK.PlusToken && rightNow && !leftNow) push('deadline', node, node.left)
      else if (COMPARE.has(k) && leftNow && !rightNow) push('deadline', node, node.right)
      else if (COMPARE.has(k) && rightNow && !leftNow) push('deadline', node, node.left)
      if (SLOT_ASSIGN.has(k)) {
        const target = node.left
        if (ts.isIdentifier(target)) {
          if (TIMEOUT_NAME.test(target.text)) push('named', node, node.right)
        } else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
          const name = ts.isPropertyAccessExpression(target)
            ? target.name.text
            : ts.isStringLiteralLike(target.argumentExpression)
              ? target.argumentExpression.text
              : ''
          const owner = rootName(target.expression) ?? ''
          if (TIMEOUT_NAME.test(name) || TIMEOUT_NAME.test(owner))
            optionSlot(node, node.right, target.expression)
        }
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      (TIMEOUT_NAME.test(keyOf(node.name)) || ownedByTimeoutName(node.parent))
    )
      optionSlot(node, node.initializer, node.parent)
    if (
      ts.isShorthandPropertyAssignment(node) &&
      (TIMEOUT_NAME.test(node.name.text) || ownedByTimeoutName(node.parent))
    )
      optionSlot(node, node.name, node.parent)
    if (ts.isPropertyDeclaration(node) && node.initializer && TIMEOUT_NAME.test(keyOf(node.name)))
      push('option', node, node.initializer)
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && TIMEOUT_NAME.test(node.name.text))
      push('param', node, node.initializer)
    if (
      ts.isBindingElement(node) &&
      node.initializer &&
      TIMEOUT_NAME.test(keyOf(node.propertyName ?? node.name))
    )
      push('param', node, node.initializer)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      TIMEOUT_NAME.test(node.name.text)
    )
      push('named', node, node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(src)
  return { src, bindings: b, sites }
}

/**
 * 한 테스트 소스의 예산·마감 자리. 각 자리는 `{ kind, line, text, ok, form?, reason? }`.
 * kind = setConfig | case | hook | deadline | waitFor. `ok` 는 배율 경유(또는 의미 값 등록) 여부.
 * waitFor 는 `vi.waitFor` 옵션 안의 `scaleMs` — setup 이 이미 배율하므로 언제나 위반(이중 배율).
 */
export function scanBudgetSites(relPath, source, entries = SEMANTIC_DELAYS) {
  const { src, bindings, sites: deadlines } = scanDeadlineSites(relPath, source)
  const sites = []
  const at = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1
  const text = (node) => node.getText(src).replace(/\s+/g, ' ').slice(0, 80)
  const push = (kind, node, ok, extra = {}) =>
    sites.push({ kind, line: at(node), text: text(node), ok, ...extra })
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(src)
      const name = rootName(node.expression)
      if (callee === 'vi.setConfig') {
        const arg = node.arguments[0]
        push('setConfig', node, !!arg && isCallTo(arg, 'scaledBudget'))
      } else if (bindings.calleeName(node) === 'vi.waitFor') {
        // P7′ — 옵션이 바인딩(식별자·단축 속성·전개·멤버·반환)을 거쳐 scaleMs 에 닿아도 이중 배율.
        for (const option of node.arguments.slice(1))
          if (bindings.reachesScale(option)) push('waitFor', option, false)
      } else if (name && (TEST_CALLS.has(name) || HOOK_CALLS.has(name))) {
        const kind = HOOK_CALLS.has(name) ? 'hook' : 'case'
        node.arguments.forEach((arg, index) => {
          const afterFn = node.arguments.slice(0, index).some(isFn)
          if (afterFn && !isFn(arg)) push(kind, arg, isCallTo(arg, 'scaleMs'))
          if (ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop) && prop.name.getText(src) === 'timeout')
                push(kind, prop, isCallTo(prop.initializer, 'scaleMs'))
            }
          }
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  for (const site of deadlines) {
    const entry = site.scaled
      ? null
      : entries.find((item) => item.file === relPath && item.value === site.value)
    push('deadline', site.node, site.scaled || !!entry, {
      form: site.form,
      value: site.value,
      valueLine: site.valueLine,
      ...(entry ? { reason: entry.reason } : {})
    })
  }
  return sites.sort((a, b) => a.line - b.line)
}

const SCALE_HINT = {
  setConfig:
    '`vi.setConfig(scaledBudget({ … }))` 로 감싼다 — 리터럴 예산은 배율(ORCA_TEST_TIME_SCALE)을 무시한다',
  case: '케이스 타임아웃은 `scaleMs(기준값)` 이다 — 리터럴은 전역 예산(× 배율)보다 작아져 조용히 이긴다',
  hook: '훅 타임아웃은 `scaleMs(기준값)` 이다',
  deadline:
    '테스트 소유 마감은 `scaleMs(기준값)` 이다 — 시간 초과 자체를 시험하거나 데이터·하한이라면 SEMANTIC_DELAYS 에 count·사유와 등록한다',
  waitFor:
    '`vi.waitFor` 옵션에 `scaleMs` 를 쓰지 않는다 — setup 이 이미 배율한다(이중 배율). 기준값만 적는다'
}

/**
 * 한 파일의 의미 값 항목 대조 — 항목마다 count = 그 파일·그 값의 미배율 마감 자리 수, reason 필수.
 * 자리가 하나도 없는 파일(지워진 파일)의 항목도 여기서 0 으로 걸린다.
 */
export function checkSemanticEntries(relPath, sites, entries = SEMANTIC_DELAYS) {
  const errors = []
  for (const entry of entries.filter((item) => item.file === relPath)) {
    const found = sites.filter(
      (site) => site.kind === 'deadline' && site.value === entry.value
    ).length
    if (found !== entry.count)
      errors.push(
        ` SEMANTIC_DELAYS { value: ${entry.value}, count: ${entry.count} } — 실제 자리 ${found} 개. 새 자리는 예산일 수 있으니 분류하고 count 를 맞춘다`
      )
    if (!entry.reason || !entry.reason.trim())
      errors.push(` SEMANTIC_DELAYS { value: ${entry.value} } — reason 이 비었다`)
  }
  return errors
}

/** (F)(H′) 위반 목록. */
export function analyzeScale(relPath, source, entries = SEMANTIC_DELAYS) {
  const sites = scanBudgetSites(relPath, source, entries)
  return [
    ...sites
      .filter((site) => !site.ok)
      .map(
        (site) =>
          `:${site.line}${site.valueLine && site.valueLine !== site.line ? ` (값 :${site.valueLine})` : ''} ${site.text} — ${SCALE_HINT[site.kind]}`
      ),
    ...checkSemanticEntries(relPath, sites, entries)
  ]
}

/** (G) 픽스처 상한 기준값 > 실-git 파일 기준 예산 최대값. 통과면 null. */
export function checkFixtureCap(fixtureSource, budgets) {
  const hit = /FIXTURE_GIT_TIMEOUT_MS\s*=\s*scaleMs\(\s*(\d[\d_]*)\s*\)/.exec(fixtureSource)
  if (!hit) return '`FIXTURE_GIT_TIMEOUT_MS = scaleMs(기준값)` 형태를 찾지 못했다'
  const cap = Number(hit[1].replace(/_/g, ''))
  const max = Math.max(0, ...budgets.flatMap((b) => [b.testTimeout ?? 0, b.hookTimeout ?? 0]))
  return cap > max
    ? null
    : `픽스처 상한 기준값 ${cap} 이 실-git 파일 기준 예산 최대값 ${max} 보다 크지 않다 — 상한이 먼저 끊는다`
}

const TEST_FILE = /\.test\.ts$/
/** (F)(H′) 범위 — 테스트 파일과 테스트가 import 하는 지원 파일(`*.testfixture.ts(x)`). */
const BUDGET_FILE = /\.test\.ts$|\.testfixture\.tsx?$/

/** `dir` 아래의 `*.test.ts`(또는 `pattern`) 를 `/` 구분자 상대경로로 모은다. */
export function listTestFiles(dir, base = dir, pattern = TEST_FILE) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listTestFiles(full, base, pattern))
    } else if (pattern.test(entry)) {
      out.push(
        full
          .slice(base.length + 1)
          .split(/[\\/]/)
          .join('/')
      )
    }
  }
  return out.sort()
}

/** (F)(H′) 대상 — `*.test.ts` · `*.testfixture.ts` · `*.testfixture.tsx`. */
export const listBudgetFiles = (dir) => listTestFiles(dir, dir, BUDGET_FILE)

const FIXTURE_PATH = 'main/infra/git/temp-repo.testfixture.ts'

export function runCli(appDir = process.cwd(), argv = [], entries = SEMANTIC_DELAYS) {
  const root = join(appDir, TEST_ROOT)
  const results = []
  const scaleErrors = []
  const report = []
  for (const rel of listTestFiles(root)) {
    const source = readFileSync(join(root, rel), 'utf8')
    const verdict = analyze(rel, source)
    if (verdict) results.push({ ...verdict, budget: parseBudget(stripComments(source)) })
  }
  const budgetFiles = listBudgetFiles(root)
  for (const rel of budgetFiles) {
    const source = readFileSync(join(root, rel), 'utf8')
    for (const error of analyzeScale(rel, source, entries))
      scaleErrors.push(`${TEST_ROOT}/${rel}${error}`)
    if (argv.includes('--report'))
      for (const site of scanBudgetSites(rel, source, entries))
        report.push(
          `${site.kind}\t${TEST_ROOT}/${rel}:${site.line}\t${site.ok ? (site.reason ? 'semantic' : 'scaled') : 'LITERAL'}\t${site.form ?? '-'}\t${site.kind === 'deadline' ? (site.value ?? 'scaleMs') : '-'}\t${site.text}`
        )
  }
  // 대상 파일이 사라진 의미 값 항목 — 낡은 허용은 다음 예산 자리의 우회로가 된다.
  for (const entry of entries)
    if (!budgetFiles.includes(entry.file))
      scaleErrors.push(
        `${TEST_ROOT}/${entry.file} SEMANTIC_DELAYS { value: ${entry.value} } — 대상 파일이 없다`
      )
  if (argv.includes('--report')) for (const line of report) console.log(line)
  let fixtureError = null
  let fixtureSource = null
  try {
    fixtureSource = readFileSync(join(root, FIXTURE_PATH), 'utf8')
  } catch {
    fixtureSource = null
  }
  if (fixtureSource !== null && results.length > 0)
    fixtureError = checkFixtureCap(
      fixtureSource,
      results.map((r) => r.budget ?? {})
    )
  const failed = results.filter((r) => r.errors.length > 0)
  for (const { path, errors } of failed) {
    for (const error of errors) console.error(`[test-budgets] ${TEST_ROOT}/${path}: ${error}`)
  }
  for (const error of scaleErrors) console.error(`[test-budgets] ${error}`)
  if (fixtureError) console.error(`[test-budgets] ${TEST_ROOT}/${FIXTURE_PATH}: ${fixtureError}`)
  if (failed.length > 0 || scaleErrors.length > 0 || fixtureError) {
    console.error(
      `[test-budgets] ${failed.length}/${results.length} real-git suites violate the budget contract · ${scaleErrors.length} unscaled budget sites${fixtureError ? ' · fixture cap' : ''}`
    )
    return 1
  }
  console.log(`[test-budgets] ${results.length} real-git suites ok · all budget sites scaled`)
  return 0
}

// 직접 실행 판정 — `pathToFileURL` 로 비교한다. `file://${process.argv[1]}` 는 windows 에서
// 성립하지 않아 CLI 본문이 돌지 않은 채 exit 0 이 나간다 (`check-migrations-appendonly.mjs`
// 와 같은 이유, CI 는 windows 러너다).
const invokedAs = process.argv[1]
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  try {
    process.exitCode = runCli(process.cwd(), process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
