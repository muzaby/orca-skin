// vitest setupFiles (0294) — 테스트 파일마다 실행된다.
//
// ① 호스트 격리: 임시 루트를 만들어 HOME·USERPROFILE·XDG·(win32)ProgramData·git 설정을 그 아래로
//    바꾸고 하네스·git 변수를 지운다. 자식 프로세스는 process.env 를 상속하므로 함께 격리된다.
// ② `vi.waitFor` 배율: 무옵션 기본 `BASE_WAIT_FOR_MS × 배율`, 명시 timeout 도 × 배율.
//    가짜 타이머 의미는 그대로다(vitest 는 poll 마다 interval 만큼만 시계를 민다).
// ③ 파일 종료 시 루트 정리 — 실패는 삼킨다. 남는 것은 OS 임시 폴더뿐이고 실제 홈은 쓰이지 않았다.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, vi } from 'vitest'
import { hermeticDirectories, hermeticTestEnv } from './test-host.mjs'
import { scaledWaitForOptions } from './test-time.mjs'

const HOST = Symbol.for('orca.test.host')
const WAIT_FOR_SCALED = Symbol.for('orca.test.waitFor.scaled')

const previous = globalThis[HOST]
const originalHome = previous?.originalHome ?? process.env.HOME ?? process.env.USERPROFILE ?? ''
const root = mkdtempSync(join(tmpdir(), 'orca-test-host-'))
const { set, remove } = hermeticTestEnv({ env: process.env, root, platform: process.platform })
for (const dir of hermeticDirectories(set)) mkdirSync(dir, { recursive: true })
writeFileSync(set.GIT_CONFIG_GLOBAL, '')
for (const key of remove) delete process.env[key]
Object.assign(process.env, set)
globalThis[HOST] = { root, originalHome }

if (!vi.waitFor[WAIT_FOR_SCALED]) {
  const original = vi.waitFor
  const scaled = (callback, options) => original(callback, scaledWaitForOptions(options))
  scaled[WAIT_FOR_SCALED] = true
  vi.waitFor = scaled
}

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
  } catch {
    // Windows EBUSY 등 — 임시 폴더 잔여만 남는다.
  }
})
