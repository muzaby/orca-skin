import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import test from 'node:test'
import { observeSmokeProcesses, processSnapshotIsAlive } from './sandbox-process-observer.mjs'

test(
  'observes an actual child identity and excludes it after exit',
  { timeout: 15_000 },
  async (t) => {
    const child = spawn(process.execPath, ['-e', "console.log('ready');setTimeout(()=>{},12000)"], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const closed = once(child, 'close')
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await closed
    })
    await once(child.stdout, 'data')
    const before = await observeSmokeProcesses([child.pid])
    assert.equal(before.length, 1)
    assert.equal(before[0].pid, child.pid)
    assert.match(before[0].createdAt, /^\d{17,19}$/)
    assert.deepEqual(Object.keys(before[0]).sort(), ['createdAt', 'pid'])
    assert.equal(processSnapshotIsAlive(before[0], before), true)
    child.kill('SIGKILL')
    await closed
    const after = await observeSmokeProcesses([child.pid])
    assert.deepEqual(after, [])
    assert.equal(processSnapshotIsAlive(before[0], after), false)
  }
)

test('identity comparison rejects PID reuse with a different creation epoch', () => {
  const original = { pid: 456, createdAt: '639243000000000000' }
  assert.equal(processSnapshotIsAlive(original, [{ ...original }]), true)
  assert.equal(processSnapshotIsAlive(original, [{ ...original, pid: 457 }]), false)
  assert.equal(
    processSnapshotIsAlive(original, [{ ...original, createdAt: '639243000000000001' }]),
    false
  )
  assert.equal(processSnapshotIsAlive(original, []), false)
})

test('rejects invalid PID collections before observing processes', async () => {
  for (const pids of [
    null,
    {},
    '123',
    [0],
    [-1],
    [1.5],
    ['123'],
    [process.pid],
    [1, 1],
    [2 ** 32],
    Array.from({ length: 17 }, (_, index) => index + 1)
  ]) {
    await assert.rejects(observeSmokeProcesses(pids), /^Error: INVALID_PROCESS_IDS$/)
  }
  assert.deepEqual(await observeSmokeProcesses([]), [])
})
