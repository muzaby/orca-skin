const SKILL_TOKEN_RE = /(?<=^|\s)\/[a-z][a-z0-9:-]*\b/g
const FILE_TOKEN_RE = /(?<=^|\s)@(?:"([^"\n]*)"|([^\s"]+))/g

export type ComposerDecorationSegment =
  { kind: 'text'; text: string } | { kind: 'chip'; chip: 'skill' | 'file'; text: string }

export function tokenizeComposerDecoration(
  value: string,
  knownSkillNames: ReadonlySet<string>,
  validFilePaths: ReadonlySet<string>
): ComposerDecorationSegment[] {
  if (value === '') return []
  const hits: Array<{
    start: number
    end: number
    text: string
    chip: 'skill' | 'file'
  }> = []

  for (const match of value.matchAll(SKILL_TOKEN_RE)) {
    if (!knownSkillNames.has(match[0].slice(1))) continue
    const start = match.index ?? 0
    hits.push({ start, end: start + match[0].length, text: match[0], chip: 'skill' })
  }
  for (const match of value.matchAll(FILE_TOKEN_RE)) {
    const raw = match[1] ?? match[2]
    if (!validFilePaths.has(raw)) continue
    const start = match.index ?? 0
    hits.push({ start, end: start + match[0].length, text: match[0], chip: 'file' })
  }
  hits.sort((a, b) => a.start - b.start)

  const segments: ComposerDecorationSegment[] = []
  let last = 0
  for (const hit of hits) {
    if (hit.start < last) continue
    if (hit.start > last) segments.push({ kind: 'text', text: value.slice(last, hit.start) })
    segments.push({ kind: 'chip', chip: hit.chip, text: hit.text })
    last = hit.end
  }
  if (last < value.length) segments.push({ kind: 'text', text: value.slice(last) })
  return segments
}
