import { computeClient } from '@renderer/shared/compute/client'
import type { LoadedMessage } from '../../src/shared/ipc'

const heading = 'Worker recovery heading'
const source = '## ' + heading + '\n\n' + 'Markdown must return from the worker. '.repeat(160)
const declaration = 'const workerRecoveryToken: number = 42'
const readId = 'worker-recovery-read'
const lanes = ['compute', 'markdown'] as const
type RecoveryLane = (typeof lanes)[number]

export function recoveryMessages(): LoadedMessage[] {
  return [
    {
      id: 'worker-recovery-user',
      role: 'user',
      createdAt: 1,
      parts: [{ type: 'text', text: 'Read and summarize.' }]
    },
    {
      id: 'worker-recovery-answer',
      role: 'assistant',
      createdAt: 2,
      parts: [
        {
          type: 'tool_call',
          toolRunId: readId,
          toolName: 'Read',
          args: { file_path: 'fixture.ts' }
        },
        { type: 'tool_result', toolRunId: readId, isError: false, result: '     1→' + declaration },
        { type: 'text', text: source }
      ]
    }
  ]
}

export function failFirstRecoveryWorkers(): () => Promise<unknown> {
  const NativeWorker = window.Worker
  const failureUrl = URL.createObjectURL(
    new Blob(['throw new Error("Worker recovery fixture exits during startup")'], {
      type: 'text/javascript'
    })
  )
  const starts = { compute: 0, markdown: 0 }
  const errors = { compute: [] as number[], markdown: [] as number[] }
  const replacementAt = { compute: 0, markdown: 0 }
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      const lane = options?.name
      if (lane !== 'compute' && lane !== 'markdown') {
        super(url, options)
        return
      }
      const failing = ++starts[lane] <= 3
      super(failing ? failureUrl : url, options)
      if (starts[lane] === 4) replacementAt[lane] = performance.now()
      if (failing) {
        this.addEventListener(
          'error',
          (event) => {
            errors[lane].push(performance.now())
            event.preventDefault()
          },
          { once: true }
        )
      }
    }
  }

  // Independent jobs drive the first three attempts and challenge the cooldown.
  // After that, observe the two original mounted consumers without sending work.
  let sequence = 0
  function request(lane: RecoveryLane): Promise<unknown> {
    const client = computeClient()
    const id = ++sequence
    if (lane === 'compute')
      return client.request<'highlight'>({
        kind: 'highlight',
        code: 'const recoveryWitness' + id + ' = true',
        lang: 'typescript',
        theme: 'github-light'
      }).promise
    const doc = { id: 'recovery-witness-' + id, revision: 1 }
    const text = '## Recovery witness'
    const lease = client.openDocument(doc, { text }, 'markdown')
    return client
      .request<'markdown'>({ kind: 'markdown', doc, start: 0, end: text.length })
      .promise.finally(() => lease.release())
  }

  async function observe(test: () => boolean, timeoutMs = 15000): Promise<boolean> {
    const deadline = performance.now() + timeoutMs
    do {
      if (test()) return true
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    } while (performance.now() < deadline)
    return false
  }

  return async () => {
    try {
      const trigger = document.querySelector<HTMLElement>('[data-focus-id="toggle"]')
      if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click()
      const code = (): Element | undefined =>
        [...document.querySelectorAll('pre')].find((el) => el.textContent?.includes(declaration))
      const raw = (): boolean =>
        (document.querySelector('[data-md-block-error]')?.textContent?.includes('## ' + heading) ??
          false) &&
        !!code() &&
        !code()?.matches('.shiki')
      const formatted = (): boolean =>
        [...document.querySelectorAll('h2')].some((el) => el.textContent === heading) &&
        !!code()?.matches('.shiki') &&
        document.querySelectorAll('[data-md-block-error]').length === 0

      const fallback = await observe(() => lanes.every((lane) => errors[lane].length >= 1) && raw())
      if (!fallback) return { ok: false, fallback, starts, errors }
      for (let attempt = 1; attempt <= 3; attempt++) {
        await Promise.allSettled(lanes.filter((lane) => errors[lane].length < 3).map(request))
      }
      const thirdFailure = lanes.every((lane) => errors[lane].length === 3 && starts[lane] === 3)
      const early = await Promise.allSettled(lanes.map(request))
      const stayedInCooldown =
        early.every((result) => result.status === 'rejected') &&
        lanes.every((lane) => starts[lane] === 3) &&
        raw()
      const restored = await observe(formatted)
      const waitMs = {
        compute: replacementAt.compute ? replacementAt.compute - errors.compute.at(-1)! : null,
        markdown: replacementAt.markdown ? replacementAt.markdown - errors.markdown.at(-1)! : null
      }
      return {
        ok:
          thirdFailure &&
          stayedInCooldown &&
          restored &&
          lanes.every((lane) => starts[lane] === 4 && (waitMs[lane] ?? 0) >= 1999),
        fallback,
        thirdFailure,
        stayedInCooldown,
        waitMs,
        restored,
        starts,
        errors
      }
    } finally {
      window.Worker = NativeWorker
      URL.revokeObjectURL(failureUrl)
    }
  }
}
