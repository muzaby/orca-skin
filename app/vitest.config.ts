import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import { BASE_CASE_MS, BASE_HOOK_MS, scaleMs } from './scripts/test-time.mjs'
import { buildProjects, partitionTestFiles, resolveIoMode } from './scripts/test-pools.mjs'

// 순수 함수 단위 테스트 전용. main 모듈 중 electron 비의존 부분(expand/convert 등)만 대상.
// electron 의존 모듈(store/secret-store)은 import 하지 않으므로 node 환경으로 충분하다.
//
// **풀은 둘이다** (0298 — 정본 `scripts/test-pools.mjs`). 자식 프로세스·git·SQLite·프로세스 전역
// 상태를 쓰는 파일(io)만 forks(파일마다 프로세스)로 돌고, 나머지(unit)는 threads 로 exe 없이 돈다.
// 둘은 같은 그룹에서 병렬로 돈다 — Windows CI 직렬화(0262)는 실측에서 더 느렸고 병렬 실패가 없어
// 없앴다(0298 ΔV4). 실측 모드(`ORCINUS_ORCA_TEST_IO_MODE`)는 실험 워크플로만 쓴다.
const base = {
  environment: 'node' as const,
  // **예산 = 기준값 × 배율** (0294). 기준 PC 는 5년 전 사무용 데스크톱이고, 배율 기본값은 3,
  // 더 느린 러너는 `ORCINUS_ORCA_TEST_TIME_SCALE` 로 올린다 — 정본은 `scripts/test-time.mjs`.
  //
  // 케이스 기준값 20초는 0211 ΔV5 실측이다(CI run 33716628944·33718212925 와 로컬 병렬).
  // 임시 디렉토리 + sqlite/git 를 실제로 쓰는 스위트는 케이스마다 mkdtemp·핸들·마이그레이션을
  // 치른다. 훅 기준값도 같은 20초다 — vitest 기본 10초는 저장소를 세우는 훅을 담지 못한다.
  //
  // **늘려도 멈춤은 그대로 잡힌다.** 영영 resolve 되지 않는 promise 는 예산과 무관하게 걸리고,
  // 바뀌는 것은 그 사실을 **보고하기까지의 시간**뿐이다.
  testTimeout: scaleMs(BASE_CASE_MS),
  hookTimeout: scaleMs(BASE_HOOK_MS),
  // 호스트 격리(HOME·XDG·git 설정·하네스 변수)와 `vi.waitFor` 배율 — 테스트 파일마다 실행된다.
  setupFiles: ['./scripts/vitest-setup.mjs']
}

// plain node 로도 읽힌다(`scripts/test-time.test.mjs`) — `__dirname` 대신 이 파일의 URL 로 앱 루트를 잡는다.
const { io, ioSqlite } = partitionTestFiles(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  test: {
    projects: buildProjects({
      io,
      ioSqlite,
      base,
      exclude: configDefaults.exclude,
      // 미설정이면 기본 구조. 실측 워크플로(`test-pools-experiment.yml`)만 설정한다(0298 ΔV2).
      mode: resolveIoMode()
    })
  }
})
