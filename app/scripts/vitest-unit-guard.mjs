// vitest unit 프로젝트 setupFiles (0298) — 워커 스레드마다 실행된다.
// unit 풀은 exe 를 띄우지 않는다. 자식 프로세스·네이티브 SQLite 를 쓰면 그 시도가 기록되고, 호출자가
// 오류를 삼켰더라도 그 테스트(훅 밖이면 파일)가 red 다. 규칙과 사유의 정본은 `test-pools.mjs`.
// 워커 스레드는 env 가 사본이라 `os.homedir()` 을 그 사본에 맞춘다(0294 격리 유지).

import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import os from 'node:os'
import { afterAll, afterEach } from 'vitest'
import { alignThreadHomedir, drainGuardViolations, installUnitGuard } from './test-pools.mjs'

// 스레드에서도 setup 이 바꾼 홈을 `os.homedir()` 이 돌려준다 — 0294 파일별 홈 격리.
alignThreadHomedir({ os, sync: syncBuiltinESMExports })

const state = installUnitGuard({ childProcess, sync: syncBuiltinESMExports })
const check = () => {
  const error = drainGuardViolations(state)
  if (error) throw error
}
afterEach(check)
afterAll(check)
