import type { HookCallback, Options } from '@anthropic-ai/claude-agent-sdk'
import { isAbsolutePath } from '../../shared/absolute-path'
import { isRecord } from '../../shared/obj'
import type { RuntimeToolContext } from './runtime-tools'
import type { TurnExtensions } from './turn'
import type { ArtifactRef } from '../../shared/artifacts'

// 일반 Markdown 전체를 렌더링하지 않는다. 명시적 링크의 목적지만 읽으며 코드 예시는 제외한다.
function withoutCode(markdown: string): string {
  let fence: { char: string; length: number } | undefined
  const lines = markdown.split('\n').map((line) => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (
        match &&
        match[1][0] === fence.char &&
        match[1].length >= fence.length &&
        !match[2].trim()
      )
        fence = undefined
      return ''
    }
    if (match) {
      fence = { char: match[1][0], length: match[1].length }
      return ''
    }
    return /^(?: {4}|\t)/.test(line) ? '' : line
  })
  const text = lines.join('\n')
  let clean = ''
  for (let i = 0; i < text.length;) {
    if (text[i] === '\\') {
      clean += text.slice(i, i + 2)
      i += 2
      continue
    }
    if (text[i] !== '`') {
      clean += text[i++]
      continue
    }
    let end = i + 1
    while (text[end] === '`') end++
    const delimiter = text.slice(i, end)
    let close = text.indexOf(delimiter, end)
    while (close >= 0 && (text[close - 1] === '`' || text[close + delimiter.length] === '`'))
      close = text.indexOf(delimiter, close + delimiter.length)
    if (close < 0) {
      clean += delimiter
      i = end
    } else {
      clean += ' '.repeat(close + delimiter.length - i)
      i = close + delimiter.length
    }
  }
  return clean
}

function closeBracket(text: string, start: number): number {
  let depth = 1
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '[') depth++
    else if (text[i] === ']' && --depth === 0) return i
  }
  return -1
}

function destination(text: string, start: number): { value: string; end: number } | undefined {
  let i = start
  while (/\s/.test(text[i] ?? '') && i < text.length) i++
  let value = ''
  if (text[i] === '<') {
    for (i++; i < text.length; i++) {
      if (text[i] === '>') return { value, end: i + 1 }
      if (text[i] === '\n' || text[i] === '<') return undefined
      if (text[i] === '\\' && /[\\<>]/.test(text[i + 1] ?? '')) i++
      value += text[i]
    }
    return undefined
  }
  let depth = 0
  for (; i < text.length; i++) {
    const char = text[i]
    if (char === '\\' && /[\\()[\]<> ]/.test(text[i + 1] ?? '')) {
      value += text[++i]
      continue
    }
    if (/\s/.test(char)) break
    if (char === '(') depth++
    if (char === ')') {
      if (!depth) break
      depth--
    }
    value += char
  }
  return value && depth === 0 ? { value, end: i } : undefined
}

function hasLinkEnd(text: string, start: number): number | undefined {
  let i = start
  while (/\s/.test(text[i] ?? '') && i < text.length) i++
  if (text[i] === ')') return i + 1
  const opener = text[i]
  if (opener !== '"' && opener !== "'" && opener !== '(') return undefined
  const closer = opener === '(' ? ')' : opener
  for (i++; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === closer) {
      i++
      while (/\s/.test(text[i] ?? '') && i < text.length) i++
      return text[i] === ')' ? i + 1 : undefined
    }
  }
  return undefined
}

const referenceKey = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase()

export function explicitOutputLinks(markdown: string): string[] {
  const definitions = new Map<string, string>()
  const text = withoutCode(markdown)
    .split('\n')
    .map((line) => {
      const match = /^ {0,3}\[([^\]\n]+)\]:[ \t]*/.exec(line)
      if (!match) return line
      const found = destination(line, match[0].length)
      if (!found) return line
      const key = referenceKey(match[1])
      if (!definitions.has(key)) definitions.set(key, found.value)
      return ''
    })
    .join('\n')
  const links = new Set<string>()
  const add = (value: string): void => {
    let decoded: string
    try {
      decoded = decodeURIComponent(value)
    } catch {
      return
    }
    if (!isAbsolutePath(decoded)) return
    // Keep the model's actual absolute destination. The file reader enforces the OS output root.
    links.add(decoded)
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
      continue
    }
    if (text[i] !== '[') continue
    const end = closeBracket(text, i)
    if (end < 0) continue
    const label = text.slice(i + 1, end)
    if (text[end + 1] === '(') {
      const found = destination(text, end + 2)
      const linkEnd = found && hasLinkEnd(text, found.end)
      if (found && linkEnd) {
        add(found.value)
        i = linkEnd - 1
      }
    } else if (text[end + 1] === '[') {
      const refEnd = closeBracket(text, end + 1)
      if (refEnd >= 0) {
        const value = definitions.get(referenceKey(text.slice(end + 2, refEnd) || label))
        if (value) add(value)
        i = refEnd
      }
    } else {
      const value = definitions.get(referenceKey(label))
      if (value) add(value)
      i = end
    }
  }
  return [...links]
}

export function makeOutputFilesHook(
  outputFiles?: TurnExtensions['outputFiles'],
  context?: RuntimeToolContext,
  onCaptured?: (
    artifact: ArtifactRef,
    toolRunId: string | undefined,
    signal: AbortSignal,
    responseScope?: number
  ) => void,
  getResponseScope?: () => number | undefined
): Pick<Options, 'hooks'> {
  if (!outputFiles || !context) return {}
  const callback: HookCallback = async (input) => {
    const signal = context.getSignal()
    const responseScope = getResponseScope?.()
    if (signal.aborted) return {}
    const invocationContext: RuntimeToolContext = {
      cwd: context.cwd,
      extraDirs: context.extraDirs,
      getSignal: () => signal,
      waitForSession: (signal) => context.waitForSession(signal)
    }
    let paths: string[] = []
    let expectedContent: string | undefined
    if (input.hook_event_name === 'PostToolUse') {
      if (!['Write', 'Edit'].includes(input.tool_name) || !isRecord(input.tool_input)) return {}
      if (isRecord(input.tool_response) && input.tool_response.isError === true) return {}
      const filePath = input.tool_input.file_path
      if (typeof filePath === 'string') paths = [filePath]
      if (input.tool_name === 'Write' && typeof input.tool_input.content === 'string')
        expectedContent = input.tool_input.content
    } else if (input.hook_event_name === 'Stop' && input.last_assistant_message) {
      paths = explicitOutputLinks(input.last_assistant_message)
    }
    let failed = false
    for (const filePath of paths) {
      if (signal.aborted) break
      try {
        const file =
          expectedContent !== undefined
            ? await outputFiles.capture(filePath, invocationContext, expectedContent)
            : await outputFiles.capture(filePath, invocationContext)
        if (
          file &&
          !signal.aborted &&
          (input.hook_event_name !== 'Stop' || !getResponseScope || responseScope !== undefined)
        )
          onCaptured?.(
            file,
            input.hook_event_name === 'PostToolUse' ? input.tool_use_id : undefined,
            signal,
            responseScope
          )
      } catch {
        if (!signal.aborted) failed = true
      }
    }
    return failed ? { systemMessage: '출력 파일을 저장하지 못했습니다.' } : {}
  }
  return {
    hooks: {
      PostToolUse: [{ matcher: 'Write|Edit', hooks: [callback] }],
      Stop: [{ hooks: [callback] }]
    }
  }
}
