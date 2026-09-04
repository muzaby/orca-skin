import type { GitDiffPatch } from '../../../../../shared/ipc'
import { diffComparisonKey, type DiffComparison } from '../components/rightpanel/diffComparison'

interface CachedPatch {
  key: string
  patch: GitDiffPatch
  weight: number
}

/** 세션의 한 요약 세대만 보관한다. 가장 최근 사용한 범위가 끝에 온다. */
export type GitPatchCache = readonly CachedPatch[]
export const GIT_PATCH_CACHE_SCOPES = 16
export const GIT_PATCH_CACHE_BYTES = 32 * 1024 * 1024

export function readGitPatchCache(
  cache: GitPatchCache,
  comparison: DiffComparison
): { patch: GitDiffPatch | null; cache: GitPatchCache } {
  const key = diffComparisonKey(comparison)
  const hit = cache.find((entry) => entry.key === key)
  return hit
    ? { patch: hit.patch, cache: [...cache.filter((entry) => entry !== hit), hit] }
    : { patch: null, cache }
}

export function writeGitPatchCache(
  cache: GitPatchCache,
  comparison: DiffComparison,
  patch: GitDiffPatch
): GitPatchCache {
  const key = diffComparisonKey(comparison)
  const next = cache.filter((entry) => entry.key !== key)
  if (!patch.isRepo || patch.unavailable) return next
  // UTF-16 문자열과 객체 메타데이터의 추정치. 큰 패치는 현재 화면에서만 보이고 보관하지 않는다.
  let weight = 512
  for (const file of patch.files) {
    weight += 256 + (file.path.length + (file.oldPath?.length ?? 0)) * 2
    for (const line of file.lines) weight += 96 + line.text.length * 2
  }
  if (weight > GIT_PATCH_CACHE_BYTES) return next
  next.push({ key, patch, weight })
  let total = next.reduce((sum, entry) => sum + entry.weight, 0)
  while (next.length > GIT_PATCH_CACHE_SCOPES || total > GIT_PATCH_CACHE_BYTES) {
    total -= next.shift()!.weight
  }
  return next
}
