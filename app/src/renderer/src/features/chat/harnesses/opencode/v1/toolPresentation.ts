import { stringify } from '../../../format'
import { toolRunOutcome } from '../../../lib/parts'
import { parseAsk, type ParsedAsk } from '../../../lib/ask'
import type { ToolCall } from '../../../reducer/chatReducer'
import type { OpenCodeFileView, OpenCodeTodo, OpenCodeToolView } from '../toolPresentation.types'

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const output = (value: unknown): string =>
  value == null ? '' : typeof value === 'string' ? value : stringify(value)
const kinds: Record<string, OpenCodeToolView['kind']> = {
  read: 'read',
  glob: 'search',
  grep: 'search',
  list: 'list',
  bash: 'shell',
  powershell: 'shell',
  shell: 'shell',
  edit: 'edit',
  multiedit: 'edit',
  patch: 'edit',
  apply_patch: 'edit',
  write: 'write',
  webfetch: 'web',
  websearch: 'web',
  task: 'task',
  agent: 'task',
  todowrite: 'todo'
}
function file(value: unknown): OpenCodeFileView | undefined {
  const data = record(value)
  const path = text(data.file) || text(data.filePath) || text(data.relativePath)
  if (!path) return undefined
  return {
    path,
    before: typeof data.before === 'string' ? data.before : undefined,
    after: typeof data.after === 'string' ? data.after : undefined,
    patch: text(data.patch) || text(data.diff) || undefined
  }
}

export function toolKind(call: ToolCall): OpenCodeToolView['kind'] {
  return (
    kinds[(call.providerTool?.name ?? call.name).toLowerCase()] ??
    kinds[call.name.toLowerCase()] ??
    'generic'
  )
}

/** Native 1.x question results keep positional answers in state.metadata. */
export function questionAnswers(call: ToolCall): ParsedAsk {
  const parsed = parseAsk({
    ...call,
    input: { ...record(call.providerTool?.input), ...record(call.input) }
  })
  const answers = record(call.result?.structuredOutput).answers
  if (!Array.isArray(answers) || toolRunOutcome(call.result) !== 'completed') return parsed
  return {
    ...parsed,
    items: parsed.items.map((item, index) => ({
      ...item,
      answer:
        item.answer ||
        (Array.isArray(answers[index])
          ? answers[index].filter((answer: unknown) => typeof answer === 'string').join(', ')
          : text(answers[index]))
    }))
  }
}

/** Only executed root writes can replace the composer list; an empty list is a valid clear. */
export function readSuccessfulTodos(call: ToolCall): OpenCodeTodo[] | undefined {
  if (
    toolKind(call) !== 'todo' ||
    call.parentToolRunId !== undefined ||
    call.result?.parentToolRunId !== undefined ||
    toolRunOutcome(call.result) !== 'completed'
  )
    return undefined
  const metadata = record(call.result?.structuredOutput)
  const input = { ...record(call.input), ...record(call.providerTool?.input) }
  const todos = Array.isArray(metadata.todos)
    ? metadata.todos
    : Array.isArray(input.todos)
      ? input.todos
      : undefined
  return todos?.map(record).map((todo) => ({ text: text(todo.content), status: text(todo.status) }))
}

// OpenCode 1.x state.metadata(file diff, patch files, todos)와 native input 해석.
export function describeTool(call: ToolCall): OpenCodeToolView {
  const input = { ...record(call.input), ...record(call.providerTool?.input) }
  const metadata = record(call.result?.structuredOutput)
  const name = call.providerTool?.name ?? call.name
  const kind = toolKind(call)
  const path = text(input.filePath) || text(input.file_path) || text(input.path)
  const files = (Array.isArray(metadata.files) ? metadata.files : [metadata.filediff])
    .map(file)
    .filter((item): item is OpenCodeFileView => Boolean(item))
  if (files.length === 0 && path && (kind === 'edit' || kind === 'write')) {
    const edits = Array.isArray(input.edits) ? input.edits.map(record) : [input]
    for (const edit of edits)
      files.push({
        path,
        before: kind === 'write' ? '' : text(edit.oldString ?? edit.old_string),
        after: kind === 'write' ? text(input.content) : text(edit.newString ?? edit.new_string)
      })
  }
  const command = text(input.command),
    url = text(input.url)
  const todos = Array.isArray(metadata.todos)
    ? metadata.todos
    : Array.isArray(input.todos)
      ? input.todos
      : []
  return {
    kind,
    name,
    subtitle:
      (kind === 'shell' ? command : '') ||
      path ||
      text(input.description) ||
      (kind === 'search' ? '' : text(input.pattern)) ||
      url ||
      text(input.query) ||
      (name.toLowerCase() === 'skill' ? text(input.name) : ''),
    arguments: [
      kind === 'search' && input.pattern ? `pattern=${text(input.pattern)}` : '',
      input.offset != null ? `offset=${input.offset}` : '',
      input.limit != null ? `limit=${input.limit}` : '',
      input.include ? `include=${text(input.include)}` : ''
    ]
      .filter(Boolean)
      .join(' '),
    outcome: toolRunOutcome(call.result),
    inputText: kind === 'generic' ? output(call.input) : '',
    // ANSI CSI를 제거하기 위한 ESC 매칭이다. 제어 문자를 실행하지 않는다.
    // eslint-disable-next-line no-control-regex
    output: output(call.result?.output).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, ''),
    command: command || undefined,
    url: /^https?:\/\//i.test(url) ? url : undefined,
    path: path || undefined,
    agent: text(input.subagent_type) || undefined,
    files,
    todos: todos
      .map(record)
      .map((todo) => ({ text: text(todo.content), status: text(todo.status) })),
    original: call.providerTool
  }
}
