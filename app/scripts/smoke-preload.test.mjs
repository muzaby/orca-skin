// preload 산출 검사 (0324 EP-28 규칙 칸 · VP-50). 임시 폴더에 합성 산출을 쓰고 `checkPreloadOutput(dir)` 의
// 결과 `{ scan, run }` 을 단언한다. CLI 는 실제로 띄워 종료 코드와 출력을 본다.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { BRIDGE_KEYS, checkPreloadOutput } from './smoke-preload.mjs'

const SCRIPT = fileURLToPath(new URL('./smoke-preload.mjs', import.meta.url))
const roots = []
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const EXPOSE = (key = 'ooBridge', keys = BRIDGE_KEYS) =>
  `electron.contextBridge.exposeInMainWorld(${JSON.stringify(key)}, { ${keys
    .map((name) => (name === 'platform' ? 'platform: "win32"' : `${name}(){}`))
    .join(', ')} });`
const BASE = ['"use strict";', 'const electron = require("electron");', EXPOSE()]

// 합성 산출 폴더 — `index.js` 에 줄을 쓴다. `null` 이면 빈 폴더다.
function output(lines) {
  const dir = mkdtempSync(join(tmpdir(), 'oo-smoke-preload-'))
  roots.push(dir)
  if (lines) writeFileSync(join(dir, 'index.js'), lines.join('\n'))
  return dir
}
const withLine = (line, at = BASE.length) => [...BASE.slice(0, at), line, ...BASE.slice(at)]

describe('checkPreloadOutput — EP-28 규칙 칸', () => {
  it('통과 — 기본 산출', () => {
    assert.deepEqual(checkPreloadOutput(output(BASE)), { scan: [], run: [] })
  })

  it('다른 모듈(보고된 결함) — 대조와 실행 둘 다 잡는다', () => {
    const { scan, run } = checkPreloadOutput(output(withLine('const zod = require("zod");', 2)))
    assert.equal(scan.length, 1)
    assert.match(scan[0], /^index\.js:3: .*require\("zod"\)/)
    assert.equal(run.length, 1)
    assert.match(run[0], /module not found: zod/)
  })

  it('나뉜 조각 — 대조와 실행 둘 다 잡는다', () => {
    const { scan, run } = checkPreloadOutput(output(withLine('require("./chunk.js");')))
    assert.equal(scan.length, 1)
    assert.match(run[0], /module not found: \.\/chunk\.js/)
  })

  it('별칭 — 대조만 잡는다', () => {
    const { scan, run } = checkPreloadOutput(output(withLine('const r = require; r("electron");')))
    assert.equal(scan.length, 1)
    assert.deepEqual(run, [])
  })

  it('동적 import — 대조만 잡는다', () => {
    const { scan, run } = checkPreloadOutput(
      output(withLine('function later() { return import("zod") }'))
    )
    assert.equal(scan.length, 1)
    assert.match(scan[0], /동적 import/)
    assert.deepEqual(run, [])
  })

  it('로드 중 던짐 — 실행이 잡는다', () => {
    const { scan, run } = checkPreloadOutput(output(withLine('throw new Error("boom");')))
    assert.deepEqual(scan, [])
    assert.equal(run.length, 1)
    assert.match(run[0], /boom/)
  })

  it('모르는 전역 — 실행이 ReferenceError 로 잡는다', () => {
    const { run } = checkPreloadOutput(output(withLine('__dirname.length;', 2)))
    assert.equal(run.length, 1)
    assert.match(run[0], /ReferenceError: __dirname/)
  })

  it('노출 없음 — 실행이 잡는다', () => {
    const { run } = checkPreloadOutput(output(BASE.slice(0, 2)))
    assert.equal(run.length, 1)
    assert.match(run[0], /0번/)
  })

  // 0324 EP-28′ — "`exposeInMainWorld` 1회" 의 다른 쪽.
  it('노출 2회 — 실행이 잡는다', () => {
    const { run } = checkPreloadOutput(output([...BASE, EXPOSE()]))
    assert.equal(run.length, 1)
    assert.match(run[0], /2번/)
  })

  it('다른 키 — 실행이 잡는다', () => {
    const { run } = checkPreloadOutput(output([...BASE.slice(0, 2), EXPOSE('oo')]))
    assert.equal(run.length, 1)
    assert.match(run[0], /`oo`/)
  })

  it('다리 키 빠짐 — 실행이 빠진 키를 낸다', () => {
    const keys = BRIDGE_KEYS.filter((name) => name !== 'connectHost')
    const { run } = checkPreloadOutput(output([...BASE.slice(0, 2), EXPOSE('ooBridge', keys)]))
    assert.deepEqual(run, ['다리에 빠진 키: connectHost'])
  })

  // 구현 세부(설계 리뷰) — 다리 키 7 은 정확히 일곱이다. 등록 밖 키도 막는다(fail-closed).
  it('다리 등록 밖 키 — 실행이 그 키를 낸다', () => {
    const keys = [...BRIDGE_KEYS, 'raw']
    const { run } = checkPreloadOutput(output([...BASE.slice(0, 2), EXPOSE('ooBridge', keys)]))
    assert.deepEqual(run, ['다리에 등록 밖 키: raw'])
  })

  it('진입 파일 없음 — 실패한다', () => {
    const { run } = checkPreloadOutput(output(null))
    assert.equal(run.length, 1)
    assert.match(run[0], /^진입 파일 `index\.js` 없음/)
  })
})

describe('smoke-preload CLI — ⑤', () => {
  const cli = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' })

  it('발견이 없으면 종료 코드 0', () => {
    const result = cli(output(BASE))
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /smoke-preload: OK/)
  })

  it('발견을 모두 출력하고 종료 코드 1', () => {
    const result = cli(output(withLine('const zod = require("zod");', 2)))
    assert.equal(result.status, 1)
    assert.match(result.stderr, /\[대조\] index\.js:3/)
    assert.match(result.stderr, /\[실행\] .*module not found: zod/)
  })
})
