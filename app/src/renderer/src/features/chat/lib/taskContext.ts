import { directoryIdentity } from '../../../../../shared/extra-directories'
import { isAbsolutePath, isFilesystemRoot } from '../../../../../shared/absolute-path'
import { isRecord } from '../../../../../shared/obj'
import { PRODUCT_SLUG } from '../../../../../shared/product'
import type { Message } from '../reducer/chatReducer'
import { partsAttachments, partsToolCalls, resultMap } from './parts'
import { workSearchResults, workToolPresentation } from './workToolPresentation'

export interface TaskContextDirectory {
  path: string
  working: boolean
}

export type TaskContextSource =
  | { kind: 'web'; url: string; title: string }
  | { kind: 'file'; path: string }
  | { kind: 'attachment'; attachmentId: string; name: string; image: boolean; path?: string }

export function taskContextDirectories(
  cwd: string | null,
  extraDirs: readonly string[]
): TaskContextDirectory[] {
  const seen = new Set<string>()
  return [
    ...(cwd ? [{ path: cwd, working: true }] : []),
    ...extraDirs.map((path) => ({ path, working: false }))
  ].filter((directory) => {
    if (!isAbsolutePath(directory.path) || isFilesystemRoot(directory.path)) return false
    const key = directoryIdentity(directory.path)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function webUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined
    url.hash = ''
    return url
  } catch {
    return undefined
  }
}

// Work 출처 표시 규칙이다. cwd/권한이나 원본 이력은 변경하지 않는다.
function isInternalClaudeSource(path: string): boolean {
  const segments: string[] = []
  for (const segment of directoryIdentity(path).split('/')) {
    if (segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  const normalized = `${segments.join('/')}/`
  return normalized.includes(`/appdata/local/temp/${PRODUCT_SLUG}/claude/`)
}

// 세션의 영속 호출/결과만 투영한다. 완료 메시지는 다시 파싱하지 않고, 별도 메시지로 온
// 늦은 결과도 toolRunId로 합류한다. 캐시는 원문 참조를 소유할 뿐 다른 세션의 목록을 합치지 않는다.
export function createTaskContextSourceSelector(): (
  messages: readonly Message[]
) => TaskContextSource[] {
  type Parsed = {
    calls: ReturnType<typeof partsToolCalls>
    results: ReturnType<typeof resultMap>
    attachments: ReturnType<typeof partsAttachments>
  }
  const parsed = new WeakMap<Message, Parsed>()
  return (messages) => {
    const slices = messages.map((message) => {
      let entry = parsed.get(message)
      if (!entry) {
        entry = {
          calls: partsToolCalls(message.parts).filter((call) =>
            ['WebFetch', 'WebSearch', 'Read', 'ReadFile', 'read_file'].includes(call.name)
          ),
          results: resultMap(message.parts),
          attachments: message.role === 'user' ? partsAttachments(message.parts) : []
        }
        parsed.set(message, entry)
      }
      return entry
    })
    const results = new Map(slices.flatMap((slice) => [...slice.results]))
    const sources = new Map<string, TaskContextSource>()
    for (const slice of slices) {
      for (const attachment of slice.attachments) {
        const path = attachment.path
        const localPath = path && isAbsolutePath(path) && !isFilesystemRoot(path) ? path : undefined
        if (localPath && isInternalClaudeSource(localPath)) continue
        const key = localPath
          ? `file:${directoryIdentity(localPath)}`
          : `attachment:${attachment.id}`
        // 첨부 원본 이름은 Read에서 얻은 저장 경로보다 우선한다. 경로 없는 과거 첨부도 표시한다.
        if (sources.get(key)?.kind === 'attachment') continue
        sources.set(key, {
          kind: 'attachment',
          attachmentId: attachment.id,
          name: attachment.name,
          image: attachment.kind === 'image',
          ...(localPath ? { path: localPath } : {})
        })
      }
      for (const original of slice.calls) {
        const call = { ...original, result: results.get(original.toolUseId) }
        if (workToolPresentation(call).status !== 'completed') continue
        if (call.name === 'WebSearch') {
          for (const link of workSearchResults(call)) {
            const url = webUrl(link.url)
            if (url && !sources.has(`web:${url.href}`))
              sources.set(`web:${url.href}`, { kind: 'web', url: url.href, title: link.title })
          }
        } else if (call.name === 'WebFetch') {
          const url = webUrl(isRecord(call.input) ? call.input.url : undefined)
          if (url && !sources.has(`web:${url.href}`))
            sources.set(`web:${url.href}`, {
              kind: 'web',
              url: url.href,
              title: url.hostname + (url.pathname === '/' ? '' : url.pathname)
            })
        } else if (isRecord(call.input)) {
          const path = call.input.file_path ?? call.input.path
          // 과거 호출의 상대 경로 기준을 확정할 수 없으므로 현재 cwd로 보완하지 않는다.
          if (typeof path !== 'string' || !isAbsolutePath(path) || isFilesystemRoot(path)) continue
          if (isInternalClaudeSource(path)) continue
          const key = `file:${directoryIdentity(path)}`
          if (!sources.has(key)) sources.set(key, { kind: 'file', path })
        }
      }
    }
    return [...sources.values()]
  }
}
