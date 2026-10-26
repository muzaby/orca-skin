import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const app = fileURLToPath(new URL('..', import.meta.url))
function filesUnder(directory, include) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path, include) : include(path) ? [path] : []
  })
}
function matches(files, pattern) {
  assert.ok(files.length > 0, 'The surface scan must visit real files')
  return files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .flatMap((line, index) =>
        pattern.test(line) ? [`${relative(app, file)}:${index + 1}: ${line.trim()}`] : []
      )
  )
}

test('chat features keep native observations without reviving session control or status panels', () => {
  const source = filesUnder(join(app, 'src'), (file) => /\.tsx?$/.test(file))
  assert.deepEqual(matches(source, /\bnativeStatus\b/), [])
  const features = filesUnder(join(app, 'src/renderer/src/features'), (file) =>
    /\.tsx?$/.test(file)
  )
  assert.deepEqual(
    matches(
      features,
      /\b(?:setNativeResource|openNativePlugin|NativeResourcesTile|OpenCodeNativeResourcesTile|preparedResourcesView|nativeResourcesMenu|subscribeResources)\b/
    ),
    []
  )
  const chat = join(app, 'src/renderer/src/features/chat')
  for (const file of [
    'components/rightpanel/NativeResourcesTile',
    'harnesses/opencode/rightpanel/NativeResources',
    'harnesses/opencode/rightpanel/preparedResourcesView',
    'lib/nativeResourcesMenu'
  ]) {
    for (const extension of ['.ts', '.tsx', '.test.ts']) {
      assert.equal(existsSync(join(chat, file + extension)), false, file + extension)
    }
  }
  assert.deepEqual(
    matches(
      [join(chat, 'hooks/useNativeResources.ts')],
      /state\.(toggle|openPlugin)|openPlugin:|toggle: \(resource/
    ),
    []
  )
  assert.deepEqual(
    matches(
      [join(chat, 'lib/nativeResourceState.ts')],
      /operations|pushSerial|this\.epoch|begin\(|finish\(|pending/
    ),
    []
  )
  assert.deepEqual(
    matches(
      filesUnder(join(chat, 'harnesses/opencode/composer'), (file) => /\.tsx?$/.test(file)),
      /resources = false|resources \?/
    ),
    []
  )
  const obsoleteKeys =
    /chat\.rightpanel\.tiles\.nativeStatus|harness\.catalogRefresh|chat\.nativeResources\.(?:openConfig|openFolder|loading|enable|disable|plugins)\b/
  assert.deepEqual(
    matches(
      source.filter((file) => !/\.test\.tsx?$/.test(file)),
      obsoleteKeys
    ),
    []
  )
})

test('current architecture describes brand groups and omits the removed status surface', () => {
  const docs = join(app, '../docs')
  const files = [
    join(docs, 'IPC_CONTRACT.md'),
    ...filesUnder(join(docs, 'arch'), (file) => file.endsWith('.md'))
  ]
  assert.deepEqual(
    matches(
      files,
      /상태 타일|상태 패널|nativeStatus|NativeResourcesTile|nativeResourcesMenu|preparedResourcesView|타이틀 메뉴[^\n]*상태를 토글|Claude 상태|OpenCode 상태/
    ),
    []
  )
  assert.match(
    readFileSync(join(docs, 'arch/frontend/rendering.md'), 'utf8'),
    /각 탭은 Orcinus orca 그룹이 맨 위/
  )
})
