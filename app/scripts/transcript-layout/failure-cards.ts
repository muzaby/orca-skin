import type { HistoryPageReply } from '../../src/shared/history-page'
import type { LoadedSession, NormalizedEvent, TurnFailureReceipt } from '../../src/shared/ipc'
import { i18n } from '@renderer/shared/i18n'
import { errorCategoryKey } from '@renderer/features/chat/lib/errorLabels'
import {
  type SessionEntry,
  chatActions,
  ingestChatEvent,
  useChatStore
} from '@renderer/features/chat/store/chatStore'

type Fault = Extract<NormalizedEvent, { type: 'error' }> & { failure: TurnFailureReceipt }
interface Step {
  text: string
  owner: string
  events: NormalizedEvent[]
  fault?: Fault
}
interface Capture {
  id: string
  initial: LoadedSession
  reopened: LoadedSession
  before: Array<{ cursor: string; reply: HistoryPageReply }>
  steps: Step[]
  initialTurns: number
  success: string
}

const scopes = import.meta.env.VITE_LAYOUT_FAILURES as unknown as Record<string, Capture>
export const capture = scopes[new URLSearchParams(location.search).get('screen')!]
const nextFrame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))

// Match each visible card to its nearest preceding user block; matching data attributes alone
// would also pass if the right card were mounted under the wrong question.
interface CardMeasurement {
  ok: boolean
  cards: Array<{
    id?: string
    owner?: string
    user?: string
    question?: string
    messageKey?: string
    block?: string
    at: number
    visible: string
    height: number
  }>
  gaps: number[]
  evidence?: {
    expected: string[]
    stored: Array<{ block: string; failureId?: string }>
    mounted: Array<string | undefined>
    scroll?: { top: number; height: number; viewport: number }
  }
}

function readMountedCards(): Pick<CardMeasurement, 'cards' | 'gaps'> {
  const errors = [...document.querySelectorAll<HTMLElement>('[data-transcript-error]')]
  const users = [...document.querySelectorAll<HTMLElement>('[data-message-id]')].filter((row) =>
    capture.steps.some((s) => s.owner === row.dataset.messageId)
  )
  const cards = errors.map((node) => {
    const user = users
      .filter((row) => row.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .at(-1)
    return {
      id: node.dataset.failureId,
      owner: node.dataset.ownerUserMessageKey,
      user: user?.dataset.messageId,
      question: user?.innerText,
      messageKey: node.dataset.assistantMessageKey,
      block: node.closest<HTMLElement>('[data-message-id]')?.dataset.messageId,
      at: Number(node.dataset.occurredAt),
      visible: node.innerText,
      height: node.getBoundingClientRect().height
    }
  })
  const gaps = errors
    .slice(1)
    .map((row, i) => row.getBoundingClientRect().top - errors[i].getBoundingClientRect().bottom)
  return { cards, gaps }
}

function matches(card: CardMeasurement['cards'][number], { text, owner, fault }: Step): boolean {
  if (!fault) return false
  const label = errorCategoryKey(fault.error.category)
  return Boolean(
    card.height > 0 &&
    card.id === fault.failure.failureId &&
    card.owner === owner &&
    card.user === owner &&
    card.question?.includes(text) &&
    card.messageKey === fault.failure.assistantMessageKey &&
    card.block === fault.failure.assistantMessageKey &&
    card.at === fault.failure.occurredAt &&
    card.visible.includes(fault.error.message) &&
    (!label || card.visible.toLocaleLowerCase().includes(i18n.t(label).toLocaleLowerCase())) &&
    card.visible.includes(i18n.t('errors.retryable')) === fault.error.retryable
  )
}

// The virtualizer may unmount the first user while its assistant is still in overscan.
// Every accepted owner/card and every adjacent gap must be observed together in one viewport.
async function snapshot(steps: Step[]): Promise<CardMeasurement> {
  const ids = steps.map((s) => s.fault!.failure.failureId)
  const observed = new Map<string, CardMeasurement['cards'][number]>()
  const adjacent = new Map<string, number>()
  const allGaps: number[] = []
  let current = readMountedCards()
  let orderMatches = true
  for (const position of [null, 'top', 'bottom'] as const) {
    if (position) {
      await scrollToPosition(position)
      current = readMountedCards()
    }
    for (const [index, card] of current.cards.entries()) {
      const step = ids.indexOf(card.id ?? '')
      const next = current.cards[index + 1]
      if (step < 0 || (next && next.id !== ids[step + 1])) orderMatches = false
      if (card.id && step >= 0 && matches(card, steps[step])) observed.set(card.id, card)
      if (next && card.id) {
        adjacent.set(card.id, current.gaps[index])
        allGaps.push(current.gaps[index])
      }
    }
    // An unexpected, duplicate or out-of-order card cannot be repaired by another viewport.
    if (!orderMatches || (allGaps.length > 1 && Math.max(...allGaps) - Math.min(...allGaps) > 1))
      break
    if (ids.every((id) => observed.has(id)) && ids.slice(0, -1).every((id) => adjacent.has(id)))
      return {
        ok: true,
        cards: ids.map((id) => observed.get(id)!),
        gaps: ids.slice(0, -1).map((id) => adjacent.get(id)!)
      }
  }
  let view = document.querySelector<HTMLElement>('[data-transcript-viewport]')
  while (view && !/(auto|scroll)/.test(getComputedStyle(view).overflowY)) view = view.parentElement
  const stored = useChatStore.getState().sessions[capture.id].session.messages
  return {
    ok: false,
    ...current,
    evidence: {
      expected: steps.map((s) => s.fault!.failure.failureId),
      stored: stored.flatMap((msg) =>
        msg.parts.flatMap((part) =>
          part.type === 'error' ? [{ block: msg.id, failureId: part.failure?.failureId }] : []
        )
      ),
      mounted: [...document.querySelectorAll<HTMLElement>('[data-message-id]')].map(
        (el) => el.dataset.messageId
      ),
      scroll: view
        ? { top: view.scrollTop, height: view.scrollHeight, viewport: view.clientHeight }
        : undefined
    }
  }
}

export async function scrollToPosition(position: 'top' | 'middle' | 'bottom'): Promise<void> {
  let el = document.querySelector<HTMLElement>('[data-transcript-viewport]')
  while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement
  if (!el) throw Error('transcript scroll container missing')
  el.scrollTop = (el.scrollHeight - el.clientHeight) * { top: 0, middle: 0.5, bottom: 1 }[position]
  await nextFrame()
  await nextFrame()
}

export async function measureAccepted(
  reopened: boolean
): Promise<{ ok: boolean; stages: CardMeasurement[]; hasSuccess: boolean }> {
  const { id, steps, success } = capture
  const failed = steps.filter((s) => s.fault)
  const stages: CardMeasurement[] = []
  if (reopened) {
    const initialUsers = useChatStore
      .getState()
      .sessions[id].session.messages.filter((m) => m.role === 'user')
    if (initialUsers.length !== Math.min(5, steps.length))
      throw Error('latest page user count: ' + initialUsers.length)
    for (const { cursor } of capture.before) {
      const entry = (): SessionEntry => useChatStore.getState().sessions[id]
      if (entry().history?.before?.cursor !== cursor || !chatActions.readPrevious(id))
        throw Error('older page was not opened')
      for (let i = 0; i < 60 && entry().history?.lastBeforeCursor !== cursor; i++) await nextFrame()
      if (entry().history?.lastBeforeCursor !== cursor) throw Error('older page not committed')
    }
    await nextFrame()
    await scrollToPosition('middle')
    stages.push(await snapshot(failed))
  } else {
    stages.push(await snapshot(steps.slice(0, capture.initialTurns).filter((s) => s.fault)))
    for (let i = capture.initialTurns; i < steps.length; i++) {
      for (const event of steps[i].events) ingestChatEvent(event)
      await nextFrame()
      await nextFrame()
      await scrollToPosition('middle')
      stages.push(await snapshot(steps.slice(0, i + 1).filter((s) => s.fault)))
    }
  }
  await scrollToPosition('bottom')
  const successful = steps.findLast((step) => !step.fault)!
  const successUser = document.querySelector<HTMLElement>(
    '[data-message-id="' + CSS.escape(successful.owner) + '"]'
  )
  const hasSuccess = Boolean(
    successUser?.innerText.includes(successful.text) &&
    [...document.querySelectorAll<HTMLElement>('[data-message-id]')].some(
      (el) =>
        Boolean(successUser!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        el.innerText.includes(success)
    )
  )
  return { ok: stages.every((s) => s.ok) && hasSuccess, stages, hasSuccess }
}
