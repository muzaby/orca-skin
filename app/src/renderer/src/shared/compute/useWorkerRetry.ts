import { useEffect, useMemo, useState } from 'react'
import {
  computeClient,
  isComputeWorkerFailure,
  type ComputeClient,
  type ComputeHandle
} from './client'
import type { Lane } from './protocol'

// The first successful request can arrive before the rejected promise's reaction.
// Subscribe, then compare the epoch captured before submitting the failed request.
export function afterWorkerRecovery(
  client: ComputeClient,
  lane: Lane,
  epoch: number,
  error: unknown,
  retry: () => void
): (() => void) | undefined {
  if (!isComputeWorkerFailure(error)) return
  let active = true
  const stop = client.subscribeRecovery(lane, () => {
    if (active && client.recoveryEpoch(lane) !== epoch) queueMicrotask(deliver)
  })
  function deliver(): void {
    if (!active) return
    active = false
    stop()
    retry()
  }
  if (client.recoveryEpoch(lane) !== epoch) queueMicrotask(deliver)
  return () => {
    active = false
    stop()
  }
}

type Submit = <R>(request: () => ComputeHandle<R>) => ComputeHandle<R>

function watchFailedRequest(
  client: ComputeClient,
  lane: Lane,
  retry: () => void
): { run: Submit; clear: () => void } {
  let serial = 0
  let stop: (() => void) | undefined
  function clear(): void {
    serial++
    stop?.()
    stop = undefined
  }
  function run<R>(request: () => ComputeHandle<R>): ComputeHandle<R> {
    clear()
    const starting = serial
    const epoch = client.recoveryEpoch(lane)
    const job = request()
    void job.promise.catch((error: unknown) => {
      if (starting === serial) stop = afterWorkerRecovery(client, lane, epoch, error, retry)
    })
    return job
  }
  return { run, clear }
}

// Each mounted request owns its subscription. A recovery changes the effect
// dependency only for the current owner of a failed request.
export function useWorkerRetry(lane: Lane, owner: unknown): Submit {
  const [last, setLast] = useState<{ owner: unknown; attempt: number }>()
  const attempt = last && last.owner === owner ? last.attempt : 0
  const client = computeClient()
  const watch = useMemo(
    () => watchFailedRequest(client, lane, () => setLast({ owner, attempt: attempt + 1 })),
    [owner, attempt, lane, client]
  )
  useEffect(() => () => watch.clear(), [watch])
  return watch.run
}
