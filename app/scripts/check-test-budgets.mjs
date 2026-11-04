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
// 0294 부터는 **모든** `*.test.ts` 에 세 가지를 더 강제한다 — 기준 PC 가 5년 전 사무용
// 데스크톱이라 예산은 언제나 `기준값 × 배율`(`scripts/test-time.mjs`)이어야 한다.
//
// (F) **배율 경유** — `vi.setConfig` 인자는 `scaledBudget({...})`, 케이스·훅 타임아웃 인자는
//     `scaleMs(...)` 여야 한다. 리터럴로 남은 예산은 배율을 무시하고, 전역(×배율)보다 작아져
//     "더 작은 캡이 이긴다" 를 다시 만든다.
// (G) **픽스처 상한 > 최대 파일 예산** — 둘 다 같은 배율을 받으므로 기준값으로 비교한다.
// (H) **테스트 소유 실시간 마감** — `setTimeout(_, 리터럴 ≥ 1000)` · `Date.now() + 리터럴` 은
//     `scaleMs` 를 지나거나, production 계약을 시험하는 **의미 대기**로 `SEMANTIC_DELAYS` 에
//     사유와 함께 등록돼야 한다. 의미 대기를 배율하면 시험하는 계약이 바뀐다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import ts from 'typescript'

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

// ── 0294 (F)(G)(H) — 모든 테스트 파일, TypeScript AST ─────────────────────────────

/** production 계약을 시험하는 **의미 대기** — 배율하면 시험 대상이 바뀐다. 값은 리터럴 원문. */
export const SEMANTIC_DELAYS = [
  {
    file: 'main/adapters/opencode/v1/adapter.persistent.test.ts',
    value: '2700',
    reason: 'SDK transport 의 실제 AbortSignal.timeout(2.5s) 을 넘겨야 하는 대기'
  },
  {
    file: 'main/app/handlers/session-resources.claude-assembly.test.ts',
    value: '1000',
    reason: '설정 파일 mtime 을 구별하기 위한 1초 간격'
  },
  {
    file: 'main/features/plugins/mail/sync-manager.test.ts',
    value: '25_000',
    reason: '가짜 타이머 아래의 느린 서버 응답 자극 — 명령 타임아웃보다 늦어야 한다'
  },
  {
    file: 'main/adapters/opencode/v1/adapter.test.ts',
    value: '5_001',
    reason: 'vi.setSystemTime 으로 신선도 만료 직후를 만든다'
  },
  {
    file: 'main/adapters/opencode/v1/adapter.test.ts',
    value: '5000',
    reason: 'vi.setSystemTime 으로 신선도 만료 경계를 만든다'
  },
  {
    file: 'main/infra/git/git-snapshot.test.ts',
    value: '60_000',
    reason: '미래 시각 데이터(bornAt) — 대기가 아니다'
  }
]

const TEST_CALLS = new Set(['it', 'test', 'describe', 'bench', 'suite'])
const HOOK_CALLS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach'])
const DEADLINE_MIN_MS = 1000

function rootName(expr) {
  let e = expr
  while (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e)) e = e.expression
  return ts.isIdentifier(e) ? e.text : null
}
const isFn = (node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node)
const isCallTo = (node, name) =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
const literalMs = (node) => Number(node.text.replace(/_/g, ''))

/**
 * 한 테스트 파일의 예산·마감 자리. 각 자리는 `{ kind, line, text, ok, reason? }`.
 * kind = setConfig | case | hook | deadline. `ok` 는 배율 경유(또는 의미 대기 등록) 여부.
 */
export function scanBudgetSites(relPath, source) {
  const src = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true)
  const sites = []
  const at = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1
  const text = (node) => node.getText(src).replace(/\s+/g, ' ').slice(0, 80)
  const semantic = (literal) =>
    SEMANTIC_DELAYS.find((entry) => entry.file === relPath && entry.value === literal.getText(src))
  const push = (kind, node, ok, extra = {}) =>
    sites.push({ kind, line: at(node), text: text(node), ok, ...extra })
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(src)
      const name = rootName(node.expression)
      if (callee === 'vi.setConfig') {
        const arg = node.arguments[0]
        push('setConfig', node, !!arg && isCallTo(arg, 'scaledBudget'))
      } else if (/(^|\.)setTimeout$/.test(callee) && node.arguments[1]) {
        const delay = node.arguments[1]
        if (isCallTo(delay, 'scaleMs')) push('deadline', node, true)
        else if (ts.isNumericLiteral(delay) && literalMs(delay) >= DEADLINE_MIN_MS) {
          const entry = semantic(delay)
          push('deadline', node, !!entry, entry ? { reason: entry.reason } : {})
        }
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
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      /^(Date|performance)\.now\(\)$/.test(node.left.getText(src))
    ) {
      if (isCallTo(node.right, 'scaleMs')) push('deadline', node, true)
      else if (ts.isNumericLiteral(node.right) && literalMs(node.right) >= DEADLINE_MIN_MS) {
        const entry = semantic(node.right)
        push('deadline', node, !!entry, entry ? { reason: entry.reason } : {})
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return sites
}

const SCALE_HINT = {
  setConfig:
    '`vi.setConfig(scaledBudget({ … }))` 로 감싼다 — 리터럴 예산은 배율(ORCA_TEST_TIME_SCALE)을 무시한다',
  case: '케이스 타임아웃은 `scaleMs(기준값)` 이다 — 리터럴은 전역 예산(× 배율)보다 작아져 조용히 이긴다',
  hook: '훅 타임아웃은 `scaleMs(기준값)` 이다',
  deadline:
    '테스트 소유 마감은 `scaleMs(기준값)` 이다 — production 계약을 시험하는 의미 대기라면 SEMANTIC_DELAYS 에 사유와 등록한다'
}

/** (F)(H) 위반 목록. */
export function analyzeScale(relPath, source) {
  return scanBudgetSites(relPath, source)
    .filter((site) => !site.ok)
    .map((site) => `:${site.line} ${site.text} — ${SCALE_HINT[site.kind]}`)
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

/** `dir` 아래의 `*.test.ts` 를 `/` 구분자 상대경로로 모은다. */
export function listTestFiles(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listTestFiles(full, base))
    } else if (entry.endsWith('.test.ts')) {
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

const FIXTURE_PATH = 'main/infra/git/temp-repo.testfixture.ts'

export function runCli(appDir = process.cwd(), argv = []) {
  const root = join(appDir, TEST_ROOT)
  const results = []
  const scaleErrors = []
  const report = []
  for (const rel of listTestFiles(root)) {
    const source = readFileSync(join(root, rel), 'utf8')
    const verdict = analyze(rel, source)
    if (verdict) results.push({ ...verdict, budget: parseBudget(stripComments(source)) })
    for (const error of analyzeScale(rel, source)) scaleErrors.push(`${TEST_ROOT}/${rel}${error}`)
    if (argv.includes('--report'))
      for (const site of scanBudgetSites(rel, source))
        report.push(
          `${site.kind}\t${TEST_ROOT}/${rel}:${site.line}\t${site.ok ? (site.reason ? 'semantic' : 'scaled') : 'LITERAL'}\t${site.text}`
        )
  }
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
