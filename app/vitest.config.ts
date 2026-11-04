import { defineConfig } from 'vitest/config'
import { BASE_CASE_MS, BASE_HOOK_MS, scaleMs } from './scripts/test-time.mjs'

// 순수 함수 단위 테스트 전용. main 모듈 중 electron 비의존 부분(expand/convert 등)만 대상.
// electron 의존 모듈(store/secret-store)은 import 하지 않으므로 node 환경으로 충분하다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Windows CI의 SQLite/git 파일 작업은 같은 디스크를 공유한다. 병렬 실행에서 준비뿐
    // 아니라 닫힌 DB의 정리 훅도 제한을 넘겼으므로 파일 단위로 직렬화한다.
    // 로컬 병렬도와 각 test/hook 예산은 유지한다.
    maxWorkers: process.platform === 'win32' && process.env.CI === 'true' ? 1 : undefined,
    // **예산 = 기준값 × 배율** (0294). 기준 PC 는 5년 전 사무용 데스크톱이고, 배율 기본값은 3,
    // 더 느린 러너는 `ORCA_TEST_TIME_SCALE` 로 올린다 — 정본은 `scripts/test-time.mjs`.
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
})
