import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { afterAll, afterEach, expect } from 'vitest'
import { relative } from 'node:path'
import { drainGuardViolations, finishGitAllowances, installIoGitGuard } from './test-pools.mjs'

const state = installIoGitGuard({ childProcess, sync: syncBuiltinESMExports })
const check = () => {
  const error = drainGuardViolations(state)
  state.spawns.length = 0
  if (error) throw error
}
afterEach(check)
afterAll(() => {
  finishGitAllowances(
    state,
    relative(process.cwd(), expect.getState().testPath).replaceAll('\\', '/')
  )
  check()
})
