import { COMPOSER_DECORATION_MAX_CHARS } from '../../../../../shared/compute/limits'
import { skillIndexFor, trailingPunctuationStart, trieChild } from './skillIndex'

const SKILL_TOKEN_RE = /(?<=^|\s)\/[^\s]+/g
// 토큰 전체가 id여야 한다 — `@jira-dc/notes.md` 같은 경로의 앞부분을 Plugin으로 칠하지 않는다.
const PLUGIN_TOKEN_RE = /(?<=^|\s)@("(?:\\.|[^"\\\n])*"|[^\s"]+)(?=\s|$)/g
const FILE_TOKEN_RE = /(?<=^|\s)@(?:"([^"\n]*)"|([^\s"]+))/g

export type ComposerDecorationSegment =
  { kind: 'text'; text: string } | { kind: 'chip'; chip: 'skill' | 'plugin' | 'file'; text: string }

export function tokenizeComposerDecoration(
  value: string,
  knownSkillNames: ReadonlySet<string>,
  validFilePaths: ReadonlySet<string>,
  validPluginIds: ReadonlySet<string> = new Set()
): ComposerDecorationSegment[] {
  // 상한을 넘는 초안은 장식하지 않는다 — 정규식도 돌리지 않는다(0325 D-010 · EP-6 ②).
  if (value === '' || value.length > COMPOSER_DECORATION_MAX_CHARS) return []
  const skillIndex = skillIndexFor(knownSkillNames)
  const hits: Array<{
    start: number
    end: number
    text: string
    chip: 'skill' | 'plugin' | 'file'
  }> = []

  for (const match of value.matchAll(SKILL_TOKEN_RE)) {
    // 등록 이름 중 끝 구두점을 떼어 낸 자리까지 가장 긴 것 — 기저 조회 1회 뒤 끝 구두점만 걷는다
    // (0325 D-039 · EP-6 ④). 구두점으로 끝나는 이름도, 이름 뒤에 붙은 구두점도 지금처럼 다룬다.
    const name = match[0].slice(1)
    const punctuation = trailingPunctuationStart(name)
    let node = skillIndex.get(name.slice(0, punctuation))
    let matched = node?.end ? punctuation : -1
    for (let i = punctuation; node && i < name.length; i++) {
      node = trieChild(node, name[i])
      if (node?.end) matched = i + 1
    }
    if (matched < 0) continue
    const text = match[0].slice(0, matched + 1)
    const start = match.index ?? 0
    hits.push({ start, end: start + text.length, text, chip: 'skill' })
  }
  for (const match of value.matchAll(PLUGIN_TOKEN_RE)) {
    let id = match[1]
    if (id.startsWith('"')) {
      try {
        id = JSON.parse(id) as string
      } catch {
        continue
      }
    }
    if (!validPluginIds.has(id)) continue
    const start = match.index ?? 0
    hits.push({ start, end: start + match[0].length, text: match[0], chip: 'plugin' })
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
