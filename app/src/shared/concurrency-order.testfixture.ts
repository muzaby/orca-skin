import type { ActiveTurnRef } from './ipc'

export type ConcurrencyRefTag = 'draft' | 'confirmed' | 'existing' | 'other'
export type ConcurrencyLocalStep = 'send' | 'handoff' | 'cancel'
export type ConcurrencyChatStep =
  | 'confirm'
  | 'telemetry'
  | 'ended'
  | 'error'
  | 'aborted'
  | 'listening'
  | 'idle'
  | 'managed'
  | 'recovered'
export interface ConcurrencyOrderScenario {
  id: string
  newSession?: boolean
  isolation?: 'managed' | 'intent' | 'recover'
  initialOther?: boolean
  local: readonly ConcurrencyLocalStep[]
  chat: readonly ConcurrencyChatStep[]
  lists: readonly (readonly ConcurrencyRefTag[])[]
}

export const CONCURRENCY_ORDER: readonly ConcurrencyOrderScenario[] = [
  {
    id: 'P1',
    newSession: true,
    local: ['send'],
    chat: ['confirm', 'telemetry', 'ended'],
    lists: [['draft'], ['confirmed'], []]
  },
  { id: 'P2', local: ['send'], chat: ['telemetry', 'ended'], lists: [['existing'], []] },
  { id: 'P3', local: ['send'], chat: ['error'], lists: [['existing'], []] },
  { id: 'P4', local: ['send'], chat: ['aborted'], lists: [['existing'], []] },
  { id: 'P5', local: ['send', 'cancel'], chat: ['aborted'], lists: [['existing'], []] },
  {
    id: 'P6',
    newSession: true,
    local: ['send', 'cancel'],
    chat: ['confirm', 'telemetry'],
    lists: [['draft'], ['confirmed'], []]
  },
  {
    id: 'P7',
    local: ['send'],
    chat: ['aborted', 'listening', 'telemetry', 'idle'],
    lists: [['existing'], [], ['existing'], []]
  },
  {
    id: 'P8',
    newSession: true,
    local: ['handoff'],
    chat: ['confirm', 'telemetry', 'ended'],
    lists: [['draft'], ['confirmed'], []]
  },
  {
    id: 'O1',
    initialOther: true,
    local: ['send'],
    chat: ['telemetry'],
    lists: [['other', 'existing'], ['other'], []]
  },
  {
    id: 'O2',
    initialOther: true,
    newSession: true,
    local: ['send'],
    chat: ['confirm', 'telemetry'],
    lists: [['other', 'draft'], ['other', 'confirmed'], ['other'], []]
  },
  {
    id: 'O3',
    initialOther: true,
    local: ['send', 'cancel'],
    chat: ['aborted'],
    lists: [['other', 'existing'], ['other']]
  },
  {
    id: 'W1',
    isolation: 'managed',
    initialOther: true,
    local: ['send'],
    chat: ['telemetry'],
    lists: [[]]
  },
  {
    id: 'W2',
    isolation: 'intent',
    initialOther: true,
    newSession: true,
    local: ['send'],
    chat: ['confirm', 'managed', 'telemetry'],
    lists: [[]]
  },
  { id: 'W3', local: ['send'], chat: ['telemetry'], lists: [['existing'], []] },
  {
    id: 'W4',
    isolation: 'recover',
    initialOther: true,
    local: ['send'],
    chat: ['recovered', 'telemetry'],
    lists: [['other', 'existing'], ['other']]
  }
]

export function concurrencyFixtureRefs(
  tags: readonly ConcurrencyRefTag[],
  draft = 'draft:a'
): ActiveTurnRef[] {
  return tags.map((tag) => {
    switch (tag) {
      case 'draft':
        return { sessionId: null, clientKey: draft }
      case 'confirmed':
        return { sessionId: 's1', clientKey: draft }
      case 'existing':
        return { sessionId: 's1', clientKey: null }
      case 'other':
        return { sessionId: 'other-session', clientKey: null }
    }
  })
}
