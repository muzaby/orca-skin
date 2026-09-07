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
// 그래서 네 가지를 강제한다.
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
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const TEST_ROOT = 'src'
const FIXTURE = 'temp-repo.testfixture'

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

/** 최상위 `vi.setConfig({ … })` 의 두 값. 없으면 null. */
export function parseBudget(text) {
  const call = /vi\.setConfig\(\s*\{([^}]*)\}\s*\)/.exec(text)
  if (!call) return null
  const body = call[1]
  const read = (key) => {
    const hit = new RegExp(`${key}\\s*:\\s*(\\d[\\d_]*)`).exec(body)
    return hit ? Number(hit[1].replace(/_/g, '')) : null
  }
  return { testTimeout: read('testTimeout'), hookTimeout: read('hookTimeout') }
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

  if (!text.includes('removeTempRoots')) {
    errors.push(
      '정리가 `removeTempRoots` 를 지나지 않는다 — 끊긴 케이스가 남긴 고아 git 자식을 밟아 rm 이 EBUSY/EPERM 으로 실패한다'
    )
  }

  return { path: relPath, errors }
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

export function runCli(appDir = process.cwd()) {
  const root = join(appDir, TEST_ROOT)
  const results = []
  for (const rel of listTestFiles(root)) {
    const verdict = analyze(rel, readFileSync(join(root, rel), 'utf8'))
    if (verdict) results.push(verdict)
  }
  const failed = results.filter((r) => r.errors.length > 0)
  if (failed.length > 0) {
    for (const { path, errors } of failed) {
      for (const error of errors) console.error(`[test-budgets] ${TEST_ROOT}/${path}: ${error}`)
    }
    console.error(
      `[test-budgets] ${failed.length}/${results.length} real-git suites violate the budget contract`
    )
    return 1
  }
  console.log(`[test-budgets] ${results.length} real-git suites ok`)
  return 0
}

// 직접 실행 판정 — `pathToFileURL` 로 비교한다. `file://${process.argv[1]}` 는 windows 에서
// 성립하지 않아 CLI 본문이 돌지 않은 채 exit 0 이 나간다 (`check-migrations-appendonly.mjs`
// 와 같은 이유, CI 는 windows 러너다).
const invokedAs = process.argv[1]
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
