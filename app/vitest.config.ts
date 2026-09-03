import { defineConfig } from 'vitest/config'

// 순수 함수 단위 테스트 전용. main 모듈 중 electron 비의존 부분(expand/convert 등)만 대상.
// electron 의존 모듈(store/secret-store)은 import 하지 않으므로 node 환경으로 충분하다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // **케이스 예산 20초** (0211 ΔV5 — CI run 33716628944·33718212925 와 로컬 병렬 실행 실측).
    //
    // 기본값 5초는 windows 에서 **임시 디렉토리 + sqlite/git 를 실제로 쓰는 스위트**를 병렬로
    // 돌릴 때 일이 끝나기 전에 끊는다. 0210 r4 가 프로세스 최초의 sqlite 비용을
    // `beforeAll(warmFileSqlite)` 로 창 밖에 옮겼지만 남은 비용은 **케이스마다 치르는 것**이다 —
    // `openDb()` 하나가 mkdtemp + 새 핸들 + 마이그레이션 20개이고, 재시작 케이스는 그것을 두 번
    // 한다. 로컬 병렬 실행에서 `worktrees/{service,safe-delete,ipc-integration}` ·
    // `infra/git/{git-cli,git-diff}` **5파일 6케이스**가 같은 형태로 끊겼고, 끊긴 케이스는 핸들을
    // 연 채 죽어 `afterEach` 의 `rm` 이 **EBUSY** 로 한 번 더 실패했다(12 = 6 × 2).
    //
    // **늘려도 멈춤은 그대로 잡힌다.** 영영 resolve 되지 않는 promise 는 예산과 무관하게 걸리고,
    // 바뀌는 것은 그 사실을 **보고하기까지의 시간**뿐이다. 직렬 실행(`--maxWorkers=1`)에서 같은
    // 스위트가 3,135케이스 전건 green 인 것이 "일이 많은 것이지 멈춘 것이 아니다" 의 근거다.
    testTimeout: 20_000
  }
})
