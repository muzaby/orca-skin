import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildVolume, checkVolume, classify, classifyBucket, classifyKind } from './volume.mjs'

// EP-03 종류 규칙 V1~V8 — 규칙 행마다 입력.
const KIND_CASES = [
  ['V1', 'app/src/main/a.test.ts', 'test'],
  ['V1', 'app/scripts/x.test.mjs', 'test'],
  ['V2', 'app/src/main/infra/git/temp-repo.testfixture.ts', 'test-support'],
  ['V2', 'app/scripts/fixtures/x.html', 'test-support'],
  ['V2', 'app/src/renderer/src/features/chat/components/__snapshots__/a.snap', 'test-support'],
  ['V2', 'app/src/main/adapters/claude/mock-scenarios.ts', 'test-support'],
  ['V2', 'app/src/shared/thing.mock.ts', 'test-support'],
  ['V2', 'app/scripts/vitest-setup.mjs', 'test-support'],
  ['V3', 'app/src/renderer/src/shared/i18n/resources/ko.ts', 'data'],
  ['V3', 'app/src/main/infra/db/migrations/0001_initial.sql', 'data'],
  ['V3', 'app/src/main/infra/net/ca.pem', 'data'],
  ['V3', 'app/src/main/x.json', 'data'],
  ['V4', 'app/src/main/AGENTS.md', 'doc'],
  ['V5', '.github/workflows/ci.yml', 'ci'],
  ['V6', 'app/scripts/test-pools.mjs', 'tooling'],
  ['V6', 'app/scripts/test-pools.d.mts', 'tooling'],
  ['V6', 'app/scripts/x.cjs', 'tooling'],
  ['V7', 'app/src/main/index.ts', 'prod'],
  ['V7', 'app/src/renderer/src/App.tsx', 'prod'],
  ['V7', 'app/src/renderer/src/styles/a.css', 'prod'],
  ['V7', 'app/src/renderer/index.html', 'prod'],
  ['V8', 'app/src/x.wasm', null],
]
for (const [rule, path, kind] of KIND_CASES) {
  test(`kind ${rule}: ${path} → ${kind}`, () => assert.equal(classifyKind(path), kind))
}

// 순서: V1 이 V2·V7 보다, V2 가 V3·V7 보다, V3 이 V7 보다 먼저다.
test('kind 순서: fixtures 안의 test 는 test', () => assert.equal(classifyKind('app/scripts/fixtures/a.test.mjs'), 'test'))
test('kind 순서: i18n resources 는 prod 가 아니라 data', () =>
  assert.equal(classifyKind('app/src/renderer/src/shared/i18n/resources/en.ts'), 'data'))
test('kind 순서: scripts 의 mjs 는 prod 가 아니라 tooling', () => assert.equal(classifyKind('app/scripts/a.mjs'), 'tooling'))
test('kind: scripts 밖의 mjs 는 미분류', () => assert.equal(classifyKind('app/src/main/a.mjs'), null))

// 버킷 규칙 — 층마다 입력.
const BUCKET_CASES = [
  ['app/src/main/index.ts', 'main/(root)'],
  ['app/src/main/app/bootstrap.ts', 'main/app/(root)'],
  ['app/src/main/app/chat-turn/send.ts', 'main/app/chat-turn'],
  ['app/src/main/features/auth/login.ts', 'main/features/auth'],
  ['app/src/main/adapters/opencode/v1/adapter.ts', 'main/adapters/opencode'],
  ['app/src/renderer/src/features/chat/store/chatStore.ts', 'renderer/features/chat/store'],
  ['app/src/renderer/src/features/chat/index.ts', 'renderer/features/chat/(root)'],
  ['app/src/renderer/src/features/x.ts', 'renderer/features/(root)'],
  ['app/src/renderer/src/shared/ui/Button.tsx', 'renderer/shared'],
  ['app/src/renderer/src/App.tsx', 'renderer/(root)'],
  ['app/src/renderer/index.html', 'renderer/(root)'],
  ['app/src/shared/ipc.ts', 'shared/(root)'],
  ['app/src/shared/usage/a.ts', 'shared/usage'],
  ['app/src/preload/index.ts', 'preload'],
  ['app/scripts/fixtures/a.html', 'scripts'],
  ['.github/workflows/ci.yml', '.github/workflows'],
  ['README.md', null],
]
for (const [path, bucket] of BUCKET_CASES) {
  test(`bucket: ${path} → ${bucket}`, () => assert.equal(classifyBucket(path), bucket))
}

test('classify 는 버킷과 종류를 함께 돌려준다', () =>
  assert.deepEqual(classify('app/src/main/features/auth/login.test.ts'), { bucket: 'main/features/auth', kind: 'test' }))

test('buildVolume: 버킷×종류로 합산하고 합이 총계와 같다', () => {
  const v = buildVolume([
    { path: 'app/src/main/features/auth/login.ts', lines: 10 },
    { path: 'app/src/main/features/auth/gate.ts', lines: 5 },
    { path: 'app/src/main/features/auth/login.test.ts', lines: 30 },
    { path: 'app/scripts/a.mjs', lines: 7 },
  ])
  assert.deepEqual(v.buckets['main/features/auth'], { prod: { files: 2, lines: 15 }, test: { files: 1, lines: 30 } })
  assert.deepEqual(v.buckets.scripts, { tooling: { files: 1, lines: 7 } })
  assert.deepEqual(v.totals, { files: 4, lines: 52 })
  assert.deepEqual(checkVolume(v), [])
})

test('checkVolume: 미분류 파일은 red', () => {
  const v = buildVolume([{ path: 'app/src/x.wasm', lines: 3 }])
  assert.equal(v.unclassified.length, 1)
  assert.match(checkVolume(v).join('\n'), /미분류 1/)
})

test('checkVolume: 버킷 행이 빠지면 합 ≠ 총계로 red', () => {
  const v = buildVolume([
    { path: 'app/src/main/index.ts', lines: 4 },
    { path: 'app/scripts/a.mjs', lines: 7 },
  ])
  delete v.buckets.scripts
  const errors = checkVolume(v).join('\n')
  assert.match(errors, /파일 합 1 ≠ 총계 2/)
  assert.match(errors, /줄 합 4 ≠ 총계 11/)
})
