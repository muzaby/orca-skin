import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'
import type { ToolCall } from '../reducer/chatReducer'
import { basenameForDisplay } from '../../../../../shared/path-basename'
import { isRecord } from '../../../../../shared/obj'
import { isTaskListToolName, readTaskToolObservation } from '../../../../../shared/task-tool'
import { isAbortedResult } from './parts'

export interface WorkToolPresentation {
  icon: IconName | null
  description?: string
  labelKey?: MessageKey
  target?: string
  status: 'running' | 'completed' | 'failed' | 'aborted'
}

export interface WorkToolPayload {
  text: string
  language: 'json' | 'text'
}

export interface WorkSearchResult {
  title: string
  url: string
}

function stringField(input: unknown, key: string): string | undefined {
  const value = isRecord(input) ? input[key] : undefined
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// wire text 블록은 표시용 텍스트로 읽는다. 다른 content 종류는 JSON 형태를 유지한다.
function textContent(value: unknown): unknown {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecord(item) && item.type === 'text' && typeof item.text === 'string')
  )
    return value.map((item) => (item as { text: string }).text).join('\n\n')
  return value
}

function resultObject(call: ToolCall): Record<string, unknown> | undefined {
  const output = textContent(call.result?.output)
  const value = typeof output === 'string' ? readJson(output) : output
  return isRecord(value) ? value : undefined
}

function status(call: ToolCall): WorkToolPresentation['status'] {
  if (!call.result) return 'running'
  if (isAbortedResult(call.result)) return 'aborted'
  if (call.result.isError) return 'failed'
  // 목록과 기존 TaskToolBody가 쓰는 구조화 관측을 공유한다. wire receipt가 성공이어도
  // TaskUpdate의 success:false·형상 불일치·구조화 결과 부재는 성공으로 승격하지 않는다.
  if (isTaskListToolName(call.name))
    return readTaskToolObservation({
      toolName: call.name,
      args: call.input,
      structuredOutput: call.result.structuredOutput,
      isError: call.result.isError
    })
      ? 'completed'
      : 'failed'
  // 참고 wire의 명시된 실패 계약만 읽는다. 미지 도구의 `error` 데이터는 추측하지 않는다.
  if (call.name === 'ReadMcpResourceDirTool' && stringField(resultObject(call), 'error'))
    return 'failed'
  if (call.name === 'Artifact' && stringField(call.input, 'action') === 'watch') {
    const watch = resultObject(call)?.watch
    if (isRecord(watch) && watch.outcome === 'failed') return 'failed'
  }
  return 'completed'
}

export function workToolPresentation(call: ToolCall): WorkToolPresentation {
  const presentation: WorkToolPresentation = { icon: null, status: status(call) }
  const input = call.input
  const file = stringField(input, 'file_path') ?? stringField(input, 'notebook_path')
  const fileName = file ? basenameForDisplay(file, file) : undefined
  const description = stringField(input, 'description')
  const assign = (icon: IconName, labelKey: MessageKey, target?: string): void => {
    Object.assign(presentation, { icon, labelKey, target, description })
  }
  if (isTaskListToolName(call.name)) {
    assign(
      'checklist',
      'chat.workTool.task',
      stringField(input, 'subject') ?? stringField(input, 'taskId')
    )
  } else
    switch (call.name) {
      case 'Bash':
      case 'PowerShell':
        assign('terminal2', 'chat.workTool.command', stringField(input, 'command')?.split('\n')[0])
        break
      case 'Read':
        assign('doc', 'chat.workTool.read', fileName)
        break
      case 'Write':
        assign('doc', 'chat.workTool.write', fileName)
        break
      case 'Edit':
      case 'MultiEdit':
      case 'NotebookEdit':
        assign('edit', 'chat.workTool.edit', fileName)
        break
      case 'Glob':
      case 'Grep':
        assign('search', 'chat.workTool.fileSearch', stringField(input, 'pattern'))
        break
      case 'WebSearch':
        assign('globe', 'chat.workTool.webSearch', stringField(input, 'query'))
        break
      case 'WebFetch':
        assign('globe', 'chat.workTool.webFetch', stringField(input, 'url'))
        break
      case 'ToolSearch':
        assign('search', 'chat.workTool.toolSearch', stringField(input, 'query'))
        break
      case 'ExitPlanMode':
      case 'EnterPlanMode':
        assign('checklist', 'chat.workTool.plan')
        break
      case 'CronCreate':
      case 'CronDelete':
      case 'CronList':
      case 'ScheduleWakeup':
        assign('clock', 'chat.workTool.schedule', stringField(input, 'reason'))
        break
      case 'PushNotification':
      case 'ReadNotifications':
      case 'SendUserMessage':
        assign('chat', 'chat.workTool.notification', stringField(input, 'message'))
        break
      default:
        presentation.description = description ?? call.name
    }
  return presentation
}

export function hasWorkToolRequest(input: unknown): boolean {
  return input !== undefined && !(isRecord(input) && Object.keys(input).length === 0)
}

export function workToolPayload(value: unknown): WorkToolPayload {
  const content = textContent(value)
  if (content === undefined) return { text: '', language: 'text' }
  if (typeof content === 'string')
    return {
      text: content,
      language: readJson(content) === undefined ? 'text' : 'json'
    }
  try {
    return { text: JSON.stringify(content, null, 2) ?? '', language: 'json' }
  } catch {
    return { text: String(content), language: 'text' }
  }
}

// SDK WebSearch의 Links 배열만 해석한다. 문자열 속 대괄호/이스케이프를 건너뛰므로
// 정규식의 첫 `]` 절단으로 실제 제목/URL을 잃지 않는다.
function wireLinks(text: string): unknown {
  const match = /(?:^|\n)Links:\s*(\[)/.exec(text)
  if (!match) return undefined
  const start = match.index + match[0].lastIndexOf('[')
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '[') depth++
    else if (char === ']' && --depth === 0) return readJson(text.slice(start, index + 1))
  }
  return undefined
}

export function workSearchResults(call: ToolCall): WorkSearchResult[] {
  if (call.name !== 'WebSearch' || !call.result) return []
  const output = textContent(call.result.output)
  const parsed = typeof output === 'string' ? readJson(output) : output
  const source =
    isRecord(parsed) && Array.isArray(parsed.results)
      ? parsed.results
      : typeof output === 'string'
        ? wireLinks(output)
        : undefined
  if (!Array.isArray(source)) return []
  const candidates = source.flatMap((item) =>
    isRecord(item) && Array.isArray(item.content) ? item.content : [item]
  )
  const links: WorkSearchResult[] = []
  const seen = new Set<string>()
  for (const item of candidates) {
    const title = stringField(item, 'title')
    const url = stringField(item, 'url')
    if (!title || !url || seen.has(url)) continue
    try {
      const parsedUrl = new URL(url)
      if (
        !['https:', 'http:'].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password
      )
        continue
      links.push({ title, url })
      seen.add(url)
    } catch {
      // malformed/relative URL은 링크로 만들지 않으며 원문 응답에는 그대로 남는다.
    }
  }
  return links
}
