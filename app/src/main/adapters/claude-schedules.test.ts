import { describe, expect, it } from 'vitest'
import { readClaudeSessionSchedules } from './claude-schedules'

const cron = { id: 'cron1', schedule: '* * * * *', recurring: true, prompt: ' check ' }

describe('Claude Stop schedule snapshot', () => {
  it('copies only fields present in the installed SDK contract', () => {
    const input = { session_crons: [{ ...cron, next_run: 'invented' }] }
    const result = readClaudeSessionSchedules(input)
    expect(result).toEqual([cron])
    input.session_crons[0].prompt = 'changed'
    expect(result?.[0].prompt).toBe(' check ')
  })

  it('distinguishes explicit deletion from missing/partial/duplicate data', () => {
    expect(readClaudeSessionSchedules({ session_crons: [] })).toEqual([])
    for (const value of [
      undefined,
      null,
      {},
      [cron, {}],
      [cron, cron],
      [{ ...cron, recurring: undefined }]
    ]) {
      expect(readClaudeSessionSchedules({ session_crons: value })).toBeUndefined()
    }
  })
})
