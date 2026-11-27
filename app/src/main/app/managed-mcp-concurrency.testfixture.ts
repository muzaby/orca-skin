import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from 'vitest'
import type { LiveTurn, ProviderMessageBatch } from '../adapters/common/types'
import type { TurnRequest } from '../adapters/common/turn'

interface SharedMcpResponses {
  hold(text: string): Promise<void>
  verify(
    root: string,
    open: (cwd: string, text: string, phase?: TurnRequest['onWaitPhase']) => LiveTurn,
    select: (enabled: boolean) => void,
    called: string[],
    modelRequests: Record<string, unknown>[],
    observe: () => { pids: (number | undefined)[]; disposals: number }
  ): Promise<void>
}

/** Pause the mock model after tool discovery, before a running response requests its tools. */
export function sharedMcpResponses(): SharedMcpResponses {
  const gates = new Map(
    ['A', 'B'].map((key) => [
      key,
      { started: Promise.withResolvers<void>(), finish: Promise.withResolvers<void>() }
    ])
  )
  return {
    async hold(text) {
      for (const [key, gate] of gates) {
        if (text.includes('0333-probe-held-' + key)) {
          gate.started.resolve()
          await gate.finish.promise
        }
      }
    },
    async verify(root, open, select, called, modelRequests, observe) {
      const other = join(root, 'parallel')
      await mkdir(other)
      const ended = async (stream: AsyncIterator<ProviderMessageBatch>): Promise<void> => {
        for (;;) {
          const batch = await stream.next()
          expect(batch.done).toBeFalsy()
          const events = batch.value!.events
          expect(events.filter((event) => event.type === 'error')).toEqual([])
          if (events.some((event) => event.type === 'turn.ended')) return
        }
      }
      const input = (body: Record<string, unknown>): string => {
        const messages = body.messages as { role: string; content: unknown }[]
        return JSON.stringify(
          messages.filter((message) => message.role === 'user').at(-1)?.content ?? ''
        )
      }
      const actualCalls = (start: number, on: boolean): void => {
        for (const id of ['G', 'http', 'jira']) expect(called.slice(start).includes(id)).toBe(on)
        expect(called.slice(start)).toContain('sse')
      }
      select(true)
      const s1 = open(root, '0333-probe-held-A')
      const s3 = open(other, '0333-probe-held-B')
      const streams = [s1, s3].map((turn) => turn.eventBatches[Symbol.asyncIterator]())
      const oldA = ended(streams[0])
      const oldB = ended(streams[1])
      const drains = [oldA, oldB]
      let s2: LiveTurn | undefined
      try {
        await Promise.all([...gates.values()].map((gate) => gate.started.promise))
        const owners = observe()
        select(false)
        const waiting = Promise.withResolvers<void>()
        s2 = open(root, '0333-probe-peer', (phase) => {
          if (phase?.kind === 'mcp') waiting.resolve()
        })
        const peer = ended(s2.eventBatches[Symbol.asyncIterator]())
        drains.push(peer)
        await waiting.promise
        const startB = called.length
        gates.get('B')!.finish.resolve()
        await oldB
        actualCalls(startB, true)
        const nextB = called.length
        expect(await s3.pushTurn!({ text: '0333-probe-next-B' })).toEqual({ kind: 'accepted' })
        await ended(streams[1])
        actualCalls(nextB, false)
        expect(modelRequests.some((body) => input(body).includes('0333-probe-peer'))).toBe(false)
        const startA = called.length
        gates.get('A')!.finish.resolve()
        await Promise.all([oldA, peer])
        actualCalls(startA, true)
        const nextA = called.length
        expect(await s1.pushTurn!({ text: '0333-probe-next-A' })).toEqual({ kind: 'accepted' })
        await ended(streams[0])
        actualCalls(nextA, false)
        for (const marker of ['0333-probe-next-A', '0333-probe-next-B', '0333-probe-peer']) {
          const requests = modelRequests.filter(
            (body) => input(body).includes(marker) && Array.isArray(body.tools) && body.tools.length
          )
          expect(requests.length).toBeGreaterThan(0)
          for (const body of requests)
            expect(JSON.stringify(body.tools)).not.toContain('docs_lookup')
        }
        expect(observe()).toEqual(owners)
      } finally {
        for (const gate of gates.values()) gate.finish.resolve()
        for (const turn of [s1, s2, s3]) turn?.close()
        await Promise.allSettled(drains)
      }
    }
  }
}
