const revisions = new WeakMap<object, number>()
let lastRevision = 0

export function revisionOf(source: object): number {
  const previous = revisions.get(source)
  if (previous !== undefined) return previous
  const revision = ++lastRevision
  revisions.set(source, revision)
  return revision
}
