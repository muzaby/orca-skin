import { expectTypeOf, it } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { PartEventType } from '../../../shared/message-id'
import type {
  TurnAskAnswer,
  UserCommitBatch,
  UserCommitResult
} from '../../../shared/peer-protocol'
import type { TurnContext } from '../../contracts/turn'
import type { TurnEventSink } from './turn-sinks'

type EventOf<T extends NormalizedEvent['type']> = Extract<NormalizedEvent, { type: T }>

it('carries an optional identity on each part event and delta, and a required identity on commit', () => {
  type PartFields = {
    [T in PartEventType]: Pick<EventOf<T>, 'messageKey' | 'messageKeySource'>
  }
  expectTypeOf<PartFields>().toEqualTypeOf<
    Record<PartEventType, { messageKey?: string; messageKeySource?: 'owner' }>
  >()
  type Delta = 'message.delta' | 'message.reasoning.delta'
  type DeltaFields = { [T in Delta]: Pick<EventOf<T>, 'messageKey'> }
  expectTypeOf<DeltaFields>().toEqualTypeOf<Record<Delta, { messageKey?: string }>>()
  expectTypeOf<Pick<EventOf<'message.committed'>, 'messageKey'>>().toEqualTypeOf<{
    messageKey: string
  }>()
})

it('keeps the peer identity fields, commit result and required turn-aware relay contract', () => {
  expectTypeOf<Pick<TurnAskAnswer, 'messageKey'>>().toEqualTypeOf<{ messageKey?: string }>()
  expectTypeOf<Pick<UserCommitBatch, 'messageKey'>>().toEqualTypeOf<{ messageKey?: string }>()
  expectTypeOf<UserCommitResult>().toEqualTypeOf<{ id: number; created: boolean }>()
  expectTypeOf<TurnEventSink<string>['relay']>().toEqualTypeOf<
    (turn: TurnContext<string>, ev: NormalizedEvent) => void
  >()
})
