// 테스트 소스 신호의 단일 정본 — `check-test-budgets.mjs`(실-git 예산)와 `test-pools.mjs`(풀 분류,
// 0298)가 같은 문자열·정규식을 쓴다. 한쪽만 고치면 "예산 대상인데 unit 풀" 같은 어긋남이 생긴다.
// 순수 Node — ABI·TypeScript 무관이라 vitest 설정 로드에서도 가볍게 읽힌다.

/** 공용 git 픽스처 모듈 이름. 이 이름을 import 하면 실제 저장소를 세운다. */
export const FIXTURE = 'temp-repo.testfixture'

// `git` 바이너리를 직접 띄우는 형태. `promisify(execFile)` 로 감싼 별칭은 잡지 못하지만,
// 그 경로는 (D) 가 요구하는 픽스처를 지나므로 `FIXTURE` 신호에 걸린다.
export const SPAWN_GIT = /(?:execFile|execFileSync|spawn|spawnSync|exec)\s*\(\s*['"]git['"]/

// 프로덕션 러너를 통한 간접 spawn. **이 신호가 없으면 문이 새어 있었다** —
// `git-diff-commit.test.ts` 와 `prepare-progress.test.ts` 는 임시 저장소를 `runGit(dir,
// ['init', …])` 으로 세워서 리터럴 `'git'` 이 한 번도 나오지 않는다. 0218 조치 전 트리에
// 게이트를 돌려 보고서야 드러났다(10개 중 8개만 대상으로 잡혔다).
export const RUN_GIT = /\brunGit\s*\(/
// 러너 자체의 단위 테스트는 가짜 구현을 주입하므로 실제로 띄우지 않는다 — 유일한 예외이고,
// 이름이 아니라 **주입한다는 사실**로 가른다.
export const INJECTS_RUNNER = /execFileImpl/

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

/** 실-git 스위트인가. `text` 는 `stripComments` 를 지난 소스다. */
export function isRealGitSuite(text) {
  if (text.includes(FIXTURE)) return true
  if (SPAWN_GIT.test(text)) return true
  return RUN_GIT.test(text) && !INJECTS_RUNNER.test(text)
}
