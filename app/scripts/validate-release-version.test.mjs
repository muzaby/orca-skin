import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateReleaseVersion } from './validate-release-version.mjs'

test('accepts matching tag and strict semver version', () => {
  const result = validateReleaseVersion({ tag: 'v0.1.0', packageVersion: '0.1.0' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('accepts empty tag (dry run) with strict semver version', () => {
  const result = validateReleaseVersion({ tag: '', packageVersion: '0.1.0' })
  assert.equal(result.ok, true)
})

test('rejects tag/version mismatch', () => {
  const result = validateReleaseVersion({ tag: 'v0.2.0', packageVersion: '0.1.0' })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /does not match/)
})

test('rejects malformed tag', () => {
  for (const tag of ['0.1.0', 'v0.1', 'v0.1.0-beta.1', 'release-0.1.0']) {
    const result = validateReleaseVersion({ tag, packageVersion: '0.1.0' })
    assert.equal(result.ok, false, `expected rejection for tag ${tag}`)
  }
})

test('rejects non-strict package version', () => {
  for (const packageVersion of ['0.1', '0.1.0-beta.1', '0.1.0.0', undefined]) {
    const result = validateReleaseVersion({ tag: '', packageVersion })
    assert.equal(result.ok, false, `expected rejection for version ${packageVersion}`)
  }
})
