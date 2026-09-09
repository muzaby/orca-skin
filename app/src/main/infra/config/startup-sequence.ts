// 부팅 최초 두 단계의 **순서 계약** (handoff 0225 · §10 EP-07). 이관은 `initLog()` 보다 먼저
// 끝나야 한다 — 로그 전송자가 새 설정 루트(`~/.config/orcinus-orca/logs`)를 먼저 만들면
// 이관의 "target 없으면 이동" 가드가 거짓이 되어 옛 설정 루트가 통째로 남는다.
//
// `main/index.ts` 모듈 스코프에서 부르는 두 줄을 조립 함수로 감싼 이유는 electron 없이 순서를
// 관측하기 위해서다. 테스트가 호출 순서를 기록하는 스텁을 넘겨 두 호출이 맞바뀌면 red 가 된다.

import type { MigrationReport } from './migrate-legacy'

export interface StartupSequenceSteps<L> {
  migrateLegacy: () => MigrationReport
  initLog: () => L
}

export interface StartupSequenceResult<L> {
  migration: MigrationReport
  logger: L
}

export function runStartupSequence<L>(steps: StartupSequenceSteps<L>): StartupSequenceResult<L> {
  // 이관이 예기치 못하게 던져도 로거는 살아야 한다 — 그러지 않으면 진단이 통째로 사라진다.
  // 여기서 잡은 예외는 `critical: false` 다. 조용한 데이터 유실을 만드는 DB 3종 실패는
  // `migrateLegacyRoots` 안에서 이미 `critical: true` 항목으로 보고된다(D-018).
  let migration: MigrationReport
  try {
    migration = steps.migrateLegacy()
  } catch (error) {
    migration = {
      moved: [],
      conflicts: [],
      failed: [{ from: '', to: '', message: String(error), critical: false }],
      configRoots: { legacy: '', current: '' }
    }
  }
  const logger = steps.initLog()
  return { migration, logger }
}
