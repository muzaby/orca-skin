import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { NormalizedEvent } from '../../shared/ipc'

const ctx = (): MapContext => ({ sessionId: 's1', cwd: '/w' })
const map = (context: MapContext, value: unknown): NormalizedEvent[] =>
  claudeToNormalized(value as SDKMessage, context)
const start = (name: string, input: unknown, parent?: string): Record<string, unknown> => ({
  type: 'assistant',
  parent_tool_use_id: parent,
  message: { content: [{ type: 'tool_use', id: 'tool1', name, input }] }
})
const result = (output: unknown, isError = false): Record<string, unknown> => ({
  type: 'user',
  tool_use_result: output,
  message: {
    content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'result', is_error: isError }]
  }
})

describe('confirmed Claude cron receipts', () => {
  it('publishes successful create before Stop and preserves the structured receipt', () => {
    const context = ctx()
    expect(map(context, start('CronCreate', { cron: '* * * * *', prompt: 'check' }))).toHaveLength(
      1
    )
    const output = { id: 'cron1', recurring: true, humanSchedule: 'every minute' }
    const events = map(context, result(output))
    expect(events).toContainEqual({
      type: 'session.schedules',
      sessionId: 's1',
      schedules: [{ id: 'cron1', schedule: '* * * * *', prompt: 'check', recurring: true }],
      pendingWakeup: false
    })
    expect(events[0]).toMatchObject({ type: 'tool.call.completed', structuredOutput: output })
  })

  it('deletes only the matching successful receipt and keeps existing jobs', () => {
    const context = ctx()
    map(context, start('CronCreate', { cron: '* * * * *', prompt: 'check' }))
    map(context, result({ id: 'cron1', recurring: true, humanSchedule: 'every minute' }))
    map(context, start('CronDelete', { id: 'cron1' }))
    expect(map(context, result({ id: 'other' }))).toHaveLength(1)
    map(context, start('CronDelete', { id: 'cron1' }))
    expect(map(context, result({ id: 'cron1' }))).toContainEqual({
      type: 'session.schedules',
      sessionId: 's1',
      schedules: [],
      pendingWakeup: false
    })
  })

  it.each([true, false])(
    'does not create from failed or malformed success output (%s)',
    (isError) => {
      const context = ctx()
      map(context, start('CronCreate', { cron: '* * * * *', prompt: 'check' }))
      expect(
        map(
          context,
          result(isError ? { id: 'cron1', recurring: true } : { error: 'failed' }, isError)
        )
      ).toHaveLength(1)
    }
  )

  it('never upgrades child-agent cron tools into the main session schedule list', () => {
    const context = ctx()
    map(context, start('CronCreate', { cron: '* * * * *', prompt: 'check' }, 'parent'))
    expect(map(context, result({ id: 'cron1', recurring: true }))).toHaveLength(1)
  })
})

describe('confirmed Claude dynamic wakeup receipts', () => {
  const wakeup = { scheduledFor: 1_900_000_000_000, clampedDelaySeconds: 60, wasClamped: false }
  const existing = { id: 'cron1', schedule: '* * * * *', prompt: 'check', recurring: true }
  const scheduleEvents = (events: NormalizedEvent[]): NormalizedEvent[] =>
    events.filter((event) => event.type === 'session.schedules')

  it('keeps the first wakeup alive before Stop without inventing a schedule ID', () => {
    const context = ctx()
    expect(scheduleEvents(map(context, start('ScheduleWakeup', { delaySeconds: 60 })))).toEqual([])
    const events = map(context, result(wakeup))
    expect(scheduleEvents(events)).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules: [], pendingWakeup: true }
    ])
    expect(events[0]).toMatchObject({ type: 'tool.call.completed', structuredOutput: wakeup })
    expect(scheduleEvents(map(context, result(wakeup)))).toEqual([])
  })

  it('preserves a pending wakeup when confirmed CronCreate and CronDelete receipts arrive', () => {
    const context = ctx()
    map(context, start('ScheduleWakeup', { delaySeconds: 60 }))
    map(context, result(wakeup))
    map(context, start('CronCreate', { cron: existing.schedule, prompt: existing.prompt }))
    expect(scheduleEvents(map(context, result({ id: existing.id, recurring: true })))).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules: [existing], pendingWakeup: true }
    ])
    map(context, start('CronDelete', { id: existing.id }))
    expect(scheduleEvents(map(context, result({ id: existing.id })))).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules: [], pendingWakeup: true }
    ])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1900000000000', undefined])(
    'does not infer a pending wakeup from invalid scheduledFor %s',
    (scheduledFor) => {
      const context = ctx()
      map(context, start('ScheduleWakeup', { delaySeconds: 60 }))
      expect(scheduleEvents(map(context, result({ ...wakeup, scheduledFor })))).toEqual([])
    }
  )

  it.each(['failed', 'child-start', 'child-result', 'multiple-results'])(
    'rejects a wakeup receipt with %s attribution',
    (kind) => {
      const context = ctx()
      map(
        context,
        start('ScheduleWakeup', { delaySeconds: 60 }, kind === 'child-start' ? 'parent' : undefined)
      )
      const message = result(wakeup, kind === 'failed')
      if (kind === 'child-result') message.parent_tool_use_id = 'parent'
      if (kind === 'multiple-results') {
        message.message = {
          content: [
            { type: 'tool_result', tool_use_id: 'tool1', content: 'result' },
            { type: 'tool_result', tool_use_id: 'other', content: 'result' }
          ]
        }
      }
      expect(scheduleEvents(map(context, message))).toEqual([])
    }
  )

  it('clears only the provisional flag after a confirmed stop without deleting known schedules', () => {
    const context = ctx()
    context.sessionSchedules = [existing]
    map(context, start('ScheduleWakeup', { delaySeconds: 60 }))
    map(context, result(wakeup))
    map(context, start('ScheduleWakeup', { stop: true }))
    expect(
      scheduleEvents(
        map(context, result({ ...wakeup, scheduledFor: 0, stopped: true, cancelledWakeups: 1 }))
      )
    ).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules: [existing], pendingWakeup: false }
    ])
  })

  it('retains the pending flag for a failed or unconfirmed stop', () => {
    const context = ctx()
    map(context, start('ScheduleWakeup', { delaySeconds: 60 }))
    map(context, result(wakeup))
    for (const [output, isError] of [
      [{ ...wakeup, scheduledFor: 0 }, false],
      [{ ...wakeup, scheduledFor: 0, stopped: true }, true],
      [{ ...wakeup, stopped: true }, false]
    ] as const) {
      map(context, start('ScheduleWakeup', { stop: true }))
      expect(scheduleEvents(map(context, result(output, isError)))).toEqual([])
    }
    map(context, start('CronDelete', { id: 'missing' }))
    expect(scheduleEvents(map(context, result({ id: 'missing' })))).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules: [], pendingWakeup: true }
    ])
  })
})
