import { setComputeDiagnostics } from '../../../shared/compute/diagnostics'
import type { ComputeJobTiming } from '../../../shared/compute/client'
import { diagnosticViewports, type ViewportDiagnostics } from './transcriptViewportDiagnostics'
/**
 * Deterministic transcript fixture generator & diagnostic dev-menu bridge (WU-14 · EP-17 ⑧).
 *
 * `window.__ooDev` is ONLY installed when `import.meta.env.VITE_OO_DIAGNOSTIC === '1'`.
 * Production builds without `VITE_OO_DIAGNOSTIC` tree-shake the entire registration out (`rg -c "__ooDev" out/renderer` === 0).
 */
import type { AppMessagePart, LoadedMessage } from '../../../../../shared/ipc'
import { chatReducer, type Message } from '../reducer/chatReducer'
import { chatActions, ingestChatEvent, useChatStore } from '../store/chatStore'
import { setVirtualization } from '../components/transcript/TranscriptViewport'

export type FixtureKind = 'claude-code' | 'claude-work' | 'opencode'

export interface FixtureOptions {
  readonly turns: number
  readonly loadedTurns?: number
  readonly minBlocks?: number
}

export interface GeneratedFixture {
  readonly kind: FixtureKind
  readonly allMessages: Message[]
  readonly loadedMessages: Message[]
  readonly remainingPrefixTurns: Message[][]
}

function makeTurnMessages(
  kind: FixtureKind,
  turnIndex: number,
  blocksPerTurn: number,
  splitActivities = false
): Message[] {
  const baseTs = 1_700_000_000_000 + turnIndex * 10_000
  const userId = `u:fx-${turnIndex}`
  const assistantId = `a:fx-${turnIndex}`
  const user: Message = {
    id: userId,
    role: 'user',
    createdAt: baseTs,
    parts: [{ type: 'text', text: `Fixture prompt #${turnIndex}: explain module ${turnIndex}` }]
  }

  const parts: AppMessagePart[] = []
  if (kind === 'claude-work') {
    parts.push({
      type: 'response_boundary',
      boundary: { id: splitActivities ? `rb-${turnIndex}-0` : `rb-${turnIndex}`, phase: 'begin' }
    })
  }

  const pairCount = Math.max(1, Math.floor((blocksPerTurn - 2) / 2))
  for (let p = 0; p < pairCount; p++) {
    const toolId = `fx-tool-${turnIndex}-${p}`
    if (splitActivities && kind === 'claude-work' && p > 0) {
      parts.push(
        {
          type: 'response_boundary',
          boundary: { id: `rb-${turnIndex}-${p - 1}`, phase: 'end', outcome: 'ended' }
        },
        { type: 'response_boundary', boundary: { id: `rb-${turnIndex}-${p}`, phase: 'begin' } }
      )
    }
    parts.push({
      type: 'text',
      text: `Step ${p + 1} of turn ${turnIndex}: inspecting file \`src/mod_${turnIndex}_${p}.ts\`.`
    })
    parts.push({
      type: 'tool_call',
      toolRunId: toolId,
      toolName: 'Read',
      args: { file_path: `src/mod_${turnIndex}_${p}.ts` }
    })
    parts.push({
      type: 'tool_result',
      toolRunId: toolId,
      result: `export const mod_${turnIndex}_${p} = ${p}`,
      isError: false
    })
  }
  parts.push({
    type: 'text',
    text: `Summary for turn ${turnIndex}:\n\`\`\`ts\nexport const turn = ${turnIndex}\n\`\`\``
  })
  if (kind === 'claude-work') {
    parts.push({
      type: 'response_boundary',
      boundary: {
        id: splitActivities ? `rb-${turnIndex}-${pairCount - 1}` : `rb-${turnIndex}`,
        phase: 'end',
        outcome: 'ended'
      }
    })
  }

  const assistant: Message = {
    id: assistantId,
    role: 'assistant',
    createdAt: baseTs + 500,
    parts
  }
  return [user, assistant]
}

export function generateTranscriptFixture(
  kind: FixtureKind,
  options: FixtureOptions,
  scenario?: 'long' | 'answer-5000'
): GeneratedFixture {
  const requestedTurns = Math.max(1, options.turns)
  const requestedLoaded = Math.min(
    requestedTurns,
    Math.max(1, options.loadedTurns ?? requestedTurns)
  )
  const splitAt = requestedTurns - requestedLoaded
  // One regular turn yields at least four selectable Work blocks or twenty on Code screens.
  const minimumPerTurn = kind === 'claude-work' ? 4 : 20
  const needed = Math.ceil((options.minBlocks ?? 0) / minimumPerTurn)
  const turns = splitAt + Math.max(requestedLoaded, needed)
  const largeAnswer = scenario === 'answer-5000'
  const blocksPerTurn = largeAnswer ? 5010 : scenario === 'long' || options.minBlocks ? 22 : 4
  const turnList: Message[][] = []
  for (let i = 0; i < turns; i++) {
    turnList.push(makeTurnMessages(kind, i, blocksPerTurn, largeAnswer))
  }
  const remainingPrefixTurns = turnList.slice(0, splitAt)
  const loadedMessages = turnList.slice(splitAt).flat()
  const allMessages = turnList.flat()

  return { kind, allMessages, loadedMessages, remainingPrefixTurns }
}

function toLoadedMessages(messages: readonly Message[]): LoadedMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    createdAt: m.createdAt,
    parts: m.parts,
    incomplete: m.incomplete
  }))
}

type ToolFixtureCard =
  'write' | 'edit' | 'multiedit' | 'read' | 'work' | 'file' | 'edit-rewrite' | 'read-long'
function toolFixture(kind: FixtureKind, card: ToolFixtureCard, count: number): GeneratedFixture {
  if (!Number.isInteger(count) || count <= 0) throw Error('Expected a positive line count')
  const messages = makeTurnMessages(kind, 1, 4),
    id = 'fx-visible',
    file_path = 'src/example.ts'
  const rows = Array.from({ length: count }, (_, i) => 'export const value' + i + ' = ' + i)
  const text = rows.join('\n')
  let args: Record<string, unknown> = { file_path },
    result: unknown = 'done',
    name: string = card
  switch (card) {
    case 'write':
      name = 'Write'
      args = { file_path, content: text }
      break
    case 'edit':
    case 'edit-rewrite':
      name = 'Edit'
      args = {
        file_path,
        old_string: text,
        new_string:
          card === 'edit-rewrite'
            ? rows.map((l) => '// ' + l).join('\n')
            : text.replace('value0', 'changed0')
      }
      break
    case 'multiedit':
      name = 'MultiEdit'
      args = {
        file_path,
        edits: Array.from({ length: 50 }, (_, i) => ({
          old_string: text,
          new_string: text.replace('value0', 'changed' + i)
        }))
      }
      break
    case 'read':
    case 'read-long':
      name = 'Read'
      result = rows
        .map((_, i) => String(i + 1) + '\t' + 'x'.repeat(card === 'read' ? 2000 : 5000))
        .join('\n')
      break
    case 'work':
      name = 'Task'
      args = { prompt: rows }
      result = { output: rows }
      break
    case 'file':
      name = 'apply_patch'
      result = {
        files: [
          {
            filePath: file_path,
            relativePath: file_path,
            type: 'update',
            diff:
              '--- a/example.ts\n+++ b/example.ts\n@@ -0,0 +1,' +
              count +
              ' @@\n' +
              rows.map((l) => '+' + l).join('\n')
          }
        ]
      }
      break
  }
  const parts: AppMessagePart[] = [
    { type: 'tool_call', toolRunId: id, toolName: name, args },
    {
      type: 'tool_result',
      toolRunId: id,
      result,
      isError: false,
      ...(card === 'file' ? { structuredOutput: result } : {})
    }
  ]
  const assistant = messages[1]
  messages[1] = {
    ...assistant,
    parts: [
      ...assistant.parts.filter(
        (p) => p.type === 'response_boundary' && p.boundary.phase === 'begin'
      ),
      ...parts,
      ...assistant.parts.filter((p) => p.type === 'response_boundary' && p.boundary.phase === 'end')
    ]
  }
  return { kind, allMessages: messages, loadedMessages: messages, remainingPrefixTurns: [] }
}
export interface DiagnosticDevApi {
  loadToolCardFixture(
    kind: FixtureKind,
    card: ToolFixtureCard,
    lines: number
  ): { loadedTurns: number; remainingTurns: number }
  startComputeTimings(): void
  finishComputeTimings(): { jobs: ComputeJobTiming[]; paints: { key: string; at: number }[] }

  loadFixture(
    kind: FixtureKind | 'long' | 'answer-5000',
    options: FixtureOptions
  ): { loadedTurns: number; remainingTurns: number }
  appendFixtureTurn(): void
  prependFixtureTurn(): { remainingTurns: number }
  blockCount(options?: { selectable?: boolean }): number
  setVirtualization(enabled: boolean): void
  selectionInfo(): ReturnType<ViewportDiagnostics['selection']> & {
    textLength: number
    collapsed: boolean
  }
  streamFixture(chars: number): void
}

let activeFixture: GeneratedFixture | null = null
let activeNextTurn = 0
let fixtureSessionKey: string | null = null
export function createDiagnosticDevApi(): DiagnosticDevApi {
  const jobs: ComputeJobTiming[] = [],
    paints: { key: string; at: number }[] = []
  function load(
    kind: FixtureKind | 'long' | 'answer-5000',
    options: FixtureOptions,
    fixture?: GeneratedFixture
  ): { loadedTurns: number; remainingTurns: number } {
    const state = useChatStore.getState()
    const key = state.activeKey
    const entry = state.sessions[key]
    if (!entry) throw new Error('Open a chat before loading a transcript fixture')
    const screen =
      entry.session.backend === 'opencode'
        ? 'opencode'
        : entry.session.agentKind === 'work'
          ? 'claude-work'
          : 'claude-code'
    const fixtureKind = kind === 'long' || kind === 'answer-5000' ? screen : kind
    activeFixture =
      fixture ??
      generateTranscriptFixture(fixtureKind, options, kind === 'answer-5000' ? kind : 'long')
    activeNextTurn = activeFixture.allMessages.length / 2
    fixtureSessionKey = key
    const session = chatReducer(entry.session, {
      type: 'LOAD_SESSION',
      session: {
        id: entry.session.sessionId ?? key,
        title: 'Transcript fixture',
        agentKind: entry.session.agentKind,
        backend: entry.session.backend ?? 'claude',
        messages: toLoadedMessages(activeFixture.loadedMessages)
      },
      complete: activeFixture.remainingPrefixTurns.length === 0
    })
    useChatStore.setState({
      entryIntent: { sessionKey: key, cause: 'open', seq: (state.entryIntent?.seq ?? 0) + 1 },
      sessions: {
        ...state.sessions,
        [key]: { ...entry, session, live: { text: '', reasoning: '', reasoningVisible: false } }
      }
    })
    return {
      loadedTurns: activeFixture.loadedMessages.length / 2,
      remainingTurns: activeFixture.remainingPrefixTurns.length
    }
  }
  return {
    loadFixture: load,
    loadToolCardFixture: (kind, card, count) =>
      load(kind, { turns: 1 }, toolFixture(kind, card, count)),
    startComputeTimings() {
      jobs.length = 0
      paints.length = 0
      setComputeDiagnostics({
        job: (t) => jobs.push(t),
        paint: (key, at) => paints.push({ key, at })
      })
    },
    finishComputeTimings() {
      setComputeDiagnostics(undefined)
      return { jobs: [...jobs], paints: [...paints] }
    },
    appendFixtureTurn() {
      if (useChatStore.getState().activeKey !== fixtureSessionKey) return
      const kind = activeFixture?.kind ?? 'claude-code'
      const turnMsgs = makeTurnMessages(kind, activeNextTurn++, 4)
      const state = useChatStore.getState()
      const key = state.activeKey
      const entry = state.sessions[key]
      if (!entry) return
      const [user, answer] = turnMsgs
      const sessionId = entry.session.sessionId ?? key
      const text = (message: Message): string =>
        message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ')
      ingestChatEvent({
        type: 'message.committed',
        sessionId,
        ids: [user.id],
        text: text(user),
        messageKey: user.id,
        messageId: activeNextTurn,
        createdAt: user.createdAt
      })
      ingestChatEvent({
        type: 'message.completed',
        sessionId,
        messageKey: answer.id,
        message: { text: text(answer) }
      })
      ingestChatEvent({ type: 'telemetry', sessionId })
    },
    prependFixtureTurn() {
      if (
        !activeFixture ||
        useChatStore.getState().activeKey !== fixtureSessionKey ||
        activeFixture.remainingPrefixTurns.length === 0
      ) {
        return { remainingTurns: 0 }
      }
      const nextBatch = activeFixture.remainingPrefixTurns.pop()!
      const key = useChatStore.getState().activeKey
      chatActions.prependHistory(key, toLoadedMessages(nextBatch), {
        reachedStart: activeFixture.remainingPrefixTurns.length === 0
      })
      return { remainingTurns: activeFixture.remainingPrefixTurns.length }
    },
    blockCount(options) {
      return (
        diagnosticViewports.get(useChatStore.getState().activeKey)?.count(!!options?.selectable) ??
        0
      )
    },
    setVirtualization,
    selectionInfo() {
      const selection = document.getSelection()
      const info = diagnosticViewports.get(useChatStore.getState().activeKey)?.selection()
      return {
        endpoints: info?.endpoints ?? null,
        blockCount: info?.blockCount ?? 0,
        textLength: selection?.toString().length ?? 0,
        collapsed: selection?.isCollapsed ?? true
      }
    },
    streamFixture(chars) {
      const state = useChatStore.getState()
      const key = state.activeKey
      const entry = state.sessions[key]
      if (!entry) return
      const sessionId = entry.session.sessionId ?? key
      const messageKey = `a:fixture-stream-${activeNextTurn++}`
      const source = ('```ts\n' + 'const value = 12345\n'.repeat(Math.ceil(chars / 20))).slice(
        0,
        Math.max(0, chars)
      )
      let offset = 0
      function sendFrame(): void {
        if (offset < source.length) {
          ingestChatEvent({
            type: 'message.delta',
            sessionId,
            messageKey,
            delta: { text: source.slice(offset, offset + 512) }
          })
          offset += 512
          requestAnimationFrame(sendFrame)
        } else {
          ingestChatEvent({
            type: 'message.completed',
            sessionId,
            messageKey,
            message: { text: source }
          })
          ingestChatEvent({ type: 'telemetry', sessionId })
        }
      }
      sendFrame()
    }
  }
}

export function installTranscriptDevTools(): void {
  if (import.meta.env.VITE_OO_DIAGNOSTIC !== '1') return
  if (typeof window === 'undefined') return
  ;(window as Window & { __ooDev?: DiagnosticDevApi }).__ooDev = createDiagnosticDevApi()
}
