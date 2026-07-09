import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseLatestYml, validateDist } from './validate-dist.mjs'

const SHA = 'AbC123+/=='
const LATEST_YML = `version: 0.1.0
files:
  - url: orca-0.1.0-setup.exe
    sha512: ${SHA}
    size: 1024
path: orca-0.1.0-setup.exe
sha512: ${SHA}
releaseDate: '2026-07-09T00:00:00.000Z'
`

function fakeFs({ size = 1024, blockmap = 10, sha = SHA } = {}) {
  return {
    fileSize: (name) => {
      if (name === 'orca-0.1.0-setup.exe') return size
      if (name === 'orca-0.1.0-setup.exe.blockmap') return blockmap
      return null
    },
    hashFile: () => sha
  }
}

test('parseLatestYml reads version, path, sha512 and files entries', () => {
  const manifest = parseLatestYml(LATEST_YML)
  assert.equal(manifest.version, '0.1.0')
  assert.equal(manifest.path, 'orca-0.1.0-setup.exe')
  assert.equal(manifest.sha512, SHA)
  assert.equal(manifest.files.length, 1)
  assert.deepEqual(manifest.files[0], {
    url: 'orca-0.1.0-setup.exe',
    sha512: SHA,
    size: '1024'
  })
})

test('validateDist passes on consistent manifest and files', () => {
  const result = validateDist({
    manifest: parseLatestYml(LATEST_YML),
    expectedVersion: '0.1.0',
    expectedArtifact: 'orca-0.1.0-setup.exe',
    ...fakeFs()
  })
  assert.deepEqual(result.errors, [])
  assert.equal(result.ok, true)
})

test('validateDist rejects version mismatch', () => {
  const result = validateDist({
    manifest: parseLatestYml(LATEST_YML),
    expectedVersion: '0.2.0',
    expectedArtifact: 'orca-0.2.0-setup.exe',
    ...fakeFs()
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /version 0\.1\.0 != expected 0\.2\.0/)
})

test('validateDist rejects sha512 mismatch', () => {
  const result = validateDist({
    manifest: parseLatestYml(LATEST_YML),
    expectedVersion: '0.1.0',
    expectedArtifact: 'orca-0.1.0-setup.exe',
    ...fakeFs({ sha: 'different==' })
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /sha512 mismatch/)
})

test('validateDist rejects size mismatch, missing artifact and missing blockmap', () => {
  const base = {
    manifest: parseLatestYml(LATEST_YML),
    expectedVersion: '0.1.0',
    expectedArtifact: 'orca-0.1.0-setup.exe'
  }

  const wrongSize = validateDist({ ...base, ...fakeFs({ size: 999 }) })
  assert.match(wrongSize.errors.join('\n'), /size mismatch/)

  const missing = validateDist({ ...base, fileSize: () => null, hashFile: () => SHA })
  assert.match(missing.errors.join('\n'), /artifact missing/)

  const noBlockmap = validateDist({ ...base, ...fakeFs({ blockmap: null }) })
  assert.match(noBlockmap.errors.join('\n'), /blockmap missing/)
})
