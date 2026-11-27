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
}

function snapshot(steps: Step[]): CardMeasurement {
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
  const ok =
    cards.length === steps.length &&
    cards.every((card, i) => {
      const { text, owner, fault } = steps[i]
      if (!fault) return false
      const label = errorCategoryKey(fault.error.category)
      return (
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
    }) &&
    (gaps.length < 2 || Math.max(...gaps) - Math.min(...gaps) <= 1)
  return { ok, cards, gaps }
}

export async function scrollToPosition(position: 'middle' | 'bottom'): Promise<void> {
  let el = document.querySelector<HTMLElement>('[data-transcript-viewport]')
  while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement
  if (!el) throw Error('transcript scroll container missing')
  el.scrollTop = (el.scrollHeight - el.clientHeight) * (position === 'middle' ? 0.5 : 1)
  await nextFrame()
  await nextFrame()
}

export async function measureAccepted(
  reopened: boolean
): Promise<{ ok: boolean; stages: CardMeasurement[]; hasSuccess: boolean }> {
  const { id, steps, success } = capture
  const failed = steps.filter((s) => s.fault)
  const stages = []
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
    stages.push(snapshot(failed))
  } else {
    stages.push(snapshot(steps.slice(0, capture.initialTurns).filter((s) => s.fault)))
    for (let i = capture.initialTurns; i < steps.length; i++) {
      for (const event of steps[i].events) ingestChatEvent(event)
      await nextFrame()
      await nextFrame()
      await scrollToPosition('middle')
      stages.push(snapshot(steps.slice(0, i + 1).filter((s) => s.fault)))
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
