// git spawn 추적 — NODE_OPTIONS="--import <this>" 로 vitest 와 fork 워커 전부에 적재된다.
// git 을 띄울 때마다 app/src 안의 호출 프레임을 한 줄(JSON)로 남긴다.
import cp from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const LOG = process.env.ORCA_SPAWN_TRACE
Error.stackTraceLimit = 200
const isGit = (file) => /(^|[\\/])git(\.exe)?$/i.test(String(file ?? ''))

function appFrames(stack) {
  const frames = []
  for (const line of String(stack).split('\n').slice(1)) {
    const m = line.match(/at (?:async )?(?:(\S+) )?\(?(?:file:\/\/)?(.*\/app\/src\/[^:)]+):(\d+)/)
    if (m) frames.push({ fn: m[1] ?? '<anon>', file: m[2].replace(/.*\/app\//, ''), line: Number(m[3]) })
  }
  return frames
}

function record(args, cwd) {
  if (!LOG) return
  const frames = appFrames(new Error().stack)
  appendFileSync(LOG, JSON.stringify({ args, cwd: cwd ?? null, frames }) + '\n')
}

const spawn = cp.ChildProcess.prototype.spawn
cp.ChildProcess.prototype.spawn = function (options) {
  if (isGit(options?.file)) record(options.args?.slice(1) ?? [], options.cwd)
  return spawn.call(this, options)
}
for (const name of ['spawnSync', 'execFileSync']) {
  const original = cp[name]
  cp[name] = function (file, args, ...rest) {
    if (isGit(file)) record(Array.isArray(args) ? args : [], rest[0]?.cwd)
    return original.call(this, file, args, ...rest)
  }
}
syncBuiltinESMExports()
