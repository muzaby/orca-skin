/**
 * Deterministic transcript fixture generator & diagnostic dev-menu bridge (WU-14 · EP-17 ⑧).
 *
 * `window.__ooDev` is ONLY installed when `import.meta.env.VITE_OO_DIAGNOSTIC === '1'`.
 * Production builds without `VITE_OO_DIAGNOSTIC` tree-shake the entire registration out (`rg -c "__ooDev" out/renderer` === 0).
 */
import type { AppMessagePart, LoadedMessage } from '../../../../../shared/ipc'
import type { Message } from '../reducer/chatReducer'
import { chatActions, useChatStore } from '../store/chatStore'
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

function makeTurnMessages(kind: FixtureKind, turnIndex: number, blocksPerTurn: number): Message[] {
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
      boundary: { id: `rb-${turnIndex}`, phase: 'begin' }
    })
  }

  const pairCount = Math.max(1, Math.floor((blocksPerTurn - 2) / 2))
  for (let p = 0; p < pairCount; p++) {
    const toolId = `fx-tool-${turnIndex}-${p}`
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
      boundary: { id: `rb-${turnIndex}`, phase: 'end', outcome: 'ended' }
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
  options: FixtureOptions
): GeneratedFixture {
  const turns = Math.max(1, options.turns)
  const loadedTurns = Math.min(turns, Math.max(1, options.loadedTurns ?? turns))
  const minBlocks = options.minBlocks ?? 0
  const blocksPerTurn = minBlocks > 0 ? Math.max(4, Math.ceil(minBlocks / turns)) : 4

  const turnList: Message[][] = []
  for (let i = 0; i < turns; i++) {
    turnList.push(makeTurnMessages(kind, i, blocksPerTurn))
  }

  const splitAt = turns - loadedTurns
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

export interface DiagnosticDevApi {
  loadFixture(
    kind: FixtureKind,
    options: FixtureOptions
  ): { loadedTurns: number; remainingTurns: number }
  appendFixtureTurn(): void
  prependFixtureTurn(): { remainingTurns: number }
  blockCount(options?: { selectable?: boolean }): number
  setVirtualization(enabled: boolean): void
  selectBlocks(start: number, end: number): boolean
  selectionInfo(): { textLength: number; collapsed: boolean }
  readClipboard(): Promise<string>
  failCopyChunk(chunkIndex: number | null): void
  streamFixture(chars: number): void
}

let activeFixture: GeneratedFixture | null = null
let activeNextTurn = 0
let failChunkIndex: number | null = null

export function getFailCopyChunkIndex(): number | null {
  return failChunkIndex
}

export function createDiagnosticDevApi(): DiagnosticDevApi {
  return {
    loadFixture(kind, options) {
      activeFixture = generateTranscriptFixture(kind, options)
      activeNextTurn = options.turns
      const state = useChatStore.getState()
      const key = state.activeKey
      const entry = state.sessions[key]
      if (entry) {
        useChatStore.setState({
          sessions: {
            ...state.sessions,
            [key]: {
              ...entry,
              session: {
                ...entry.session,
                messages: activeFixture.loadedMessages,
                historyComplete: activeFixture.remainingPrefixTurns.length === 0
              }
            }
          }
        })
      }
      return {
        loadedTurns: options.loadedTurns ?? options.turns,
        remainingTurns: activeFixture.remainingPrefixTurns.length
      }
    },
    appendFixtureTurn() {
      const kind = activeFixture?.kind ?? 'claude-code'
      const turnMsgs = makeTurnMessages(kind, activeNextTurn++, 4)
      const state = useChatStore.getState()
      const key = state.activeKey
      const entry = state.sessions[key]
      if (!entry) return
      useChatStore.setState({
        sessions: {
          ...state.sessions,
          [key]: {
            ...entry,
            session: {
              ...entry.session,
              messages: [...entry.session.messages, ...turnMsgs]
            }
          }
        }
      })
    },
    prependFixtureTurn() {
      if (!activeFixture || activeFixture.remainingPrefixTurns.length === 0) {
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
      if (typeof document === 'undefined') return 0
      const selector = options?.selectable ? '[data-part-key]' : '[data-block-key]'
      return document.querySelectorAll(selector).length
    },
    setVirtualization(enabled) {
      setVirtualization(enabled)
    },
    selectBlocks(start, end) {
      if (typeof document === 'undefined') return false
      const blocks = document.querySelectorAll('[data-block-key]')
      const a = blocks[start]
      const b = blocks[end]
      if (!a || !b) return false
      const sel = document.getSelection()
      if (!sel) return false
      const range = document.createRange()
      range.setStart(a, 0)
      range.setEnd(b, b.childNodes.length)
      sel.removeAllRanges()
      sel.addRange(range)
      return true
    },
    selectionInfo() {
      if (typeof document === 'undefined') return { textLength: 0, collapsed: true }
      const sel = document.getSelection()
      return {
        textLength: sel ? sel.toString().length : 0,
        collapsed: sel ? sel.isCollapsed : true
      }
    },
    async readClipboard() {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return ''
      return navigator.clipboard.readText()
    },
    failCopyChunk(chunkIndex) {
      failChunkIndex = chunkIndex
    },
    streamFixture(chars) {
      const state = useChatStore.getState()
      const key = state.activeKey
      const entry = state.sessions[key]
      if (!entry) return
      const payload = 'x'.repeat(Math.max(0, chars))
      useChatStore.setState({
        sessions: {
          ...state.sessions,
          [key]: {
            ...entry,
            live: { ...entry.live, text: entry.live.text + payload }
          }
        }
      })
    }
  }
}

export function installTranscriptDevTools(): void {
  if (import.meta.env.VITE_OO_DIAGNOSTIC !== '1') return
  if (typeof window === 'undefined') return
  ;(window as Window & { __ooDev?: DiagnosticDevApi }).__ooDev = createDiagnosticDevApi()
}
