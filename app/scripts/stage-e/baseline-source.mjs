const commit = '4412276f248ffe6a447760f56ad2fa424fa0e78a'
const file = commit + ':app/scripts/stage-e/host.ts'

export function baselineHostSource(git) {
  try {
    git('cat-file', '-e', commit)
  } catch {
    throw Error('baseline host commit missing')
  }
  if (git('rev-parse', file).toString().trim() !== '1c4bcb1a7c0319ff9fdbff92cae8c220b3742a79')
    throw Error('baseline host blob mismatch')
  try {
    git('merge-base', '--is-ancestor', commit, 'HEAD')
  } catch {
    throw Error('baseline host not reachable from HEAD')
  }
  return git('show', file).toString()
}
