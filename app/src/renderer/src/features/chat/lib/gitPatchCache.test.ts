import { expect, it } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import {
  readGitPatchCache,
  writeGitPatchCache,
  GIT_PATCH_CACHE_BYTES,
  type GitPatchCache
} from './gitPatchCache'

const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'none' },
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}
const scope = (sha: string): { kind: 'commit'; sha: string } => ({ kind: 'commit', sha })
const largePatch = (length: number): GitDiffPatch => ({
  ...patch,
  files: [
    {
      path: 'a',
      status: 'added',
      added: 1,
      removed: 0,
      kind: 'text',
      lines: [{ type: 'added', oldLine: null, newLine: 1, text: 'x'.repeat(length) }]
    }
  ]
})

it('retains sixteen most recently used scopes without mutating earlier snapshots', () => {
  let cache: GitPatchCache = []
  for (let i = 0; i < 16; i++) cache = writeGitPatchCache(cache, scope(String(i)), patch)
  const original = cache
  cache = readGitPatchCache(cache, scope('0')).cache
  cache = writeGitPatchCache(cache, scope('16'), patch)
  expect(readGitPatchCache(cache, scope('0')).patch).toBe(patch)
  expect(readGitPatchCache(cache, scope('1')).patch).toBeNull()
  expect(readGitPatchCache(original, scope('1')).patch).toBe(patch)
})

it('enforces the byte budget and never retains failed or oversized responses', () => {
  const medium = largePatch(GIT_PATCH_CACHE_BYTES / 4)
  let cache = writeGitPatchCache([], scope('a'), medium)
  cache = writeGitPatchCache(cache, scope('b'), medium)
  expect(readGitPatchCache(cache, scope('a')).patch).toBeNull()
  expect(readGitPatchCache(cache, scope('b')).patch).toBe(medium)
  expect(writeGitPatchCache([], scope('huge'), largePatch(GIT_PATCH_CACHE_BYTES / 2))).toEqual([])
  expect(writeGitPatchCache([], scope('failed'), { ...patch, unavailable: true })).toEqual([])
  expect(writeGitPatchCache([], scope('not-repo'), { ...patch, isRepo: false })).toEqual([])
})
