import { rendererLog } from '../logging'
import type { ComputeRequest, Lane } from './protocol'

const COOLDOWNS_MS = [2_000, 10_000, 60_000]
const REPEAT_LOG_MS = 60_000
const SLOW_JOB_MS = 10_000

type JobKind = ComputeRequest['kind'] | 'health'

export class ComputeWorkerFailure extends Error {
  constructor(message = 'compute worker failed') {
    super(message)
    this.name = 'ComputeWorkerFailure'
  }
}

export function isComputeWorkerFailure(error: unknown): boolean {
  return error instanceof ComputeWorkerFailure
}

// 요청 결과와 별개인 레인 수명이다. 교체는 취소에도 일어나지만 회복은 실제 성공 응답에서만 일어난다.
export class LaneRecovery {
  workerEpoch = 0
  recoveryEpoch = 0
  private failures = 0
  private cooldowns = 0
  private failed = false
  private blockedUntil = 0
  private listeners = new Set<() => void>()
  private wake: ReturnType<typeof setTimeout> | undefined
  private previousLog?: { event: string; kind: JobKind; reason: string; at: number }

  constructor(
    private readonly lane: Lane,
    private readonly limit: number,
    private readonly now: () => number,
    private readonly probe: () => void
  ) {}

  get blocked(): boolean {
    return this.blockedUntil !== 0 && this.blockedUntil > this.now()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    this.scheduleProbe()
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size) this.cancelWake()
    }
  }

  private cancelWake(): void {
    clearTimeout(this.wake)
    this.wake = undefined
  }

  // 실패 소비처만 남아도 대기 뒤에 실제 워커 응답을 받는다. 소비처가 떠나면 예약도 해제한다.
  scheduleProbe(): void {
    if (!this.failed || !this.listeners.size || this.wake !== undefined) return
    this.wake = setTimeout(
      () => {
        this.wake = undefined
        // 타이머는 `now()` 보다 조금 일찍 깨어날 수 있다 — 아직 대기 중이면 남은 시간만큼 다시 예약한다.
        // 예약 없이 돌아가면 새 요청이 없는 한 레인이 영영 회복하지 않는다.
        if (this.blocked) this.scheduleProbe()
        else this.probe()
      },
      Math.max(0, Math.ceil(this.blockedUntil - this.now()))
    )
  }

  failure(): void {
    this.failed = true
    if (++this.failures >= this.limit) {
      this.failures = 0
      this.blockedUntil =
        this.now() + COOLDOWNS_MS[Math.min(this.cooldowns++, COOLDOWNS_MS.length - 1)]
      this.cancelWake()
    }
    this.scheduleProbe()
  }

  success(): void {
    this.failures = 0
    if (!this.failed) return
    this.failed = false
    this.blockedUntil = 0
    this.cancelWake()
    this.recoveryEpoch++
    for (const listener of [...this.listeners]) listener()
  }

  report(
    event: 'compute.worker.failed' | 'compute.request.failed',
    kind: JobKind,
    reason: string,
    error?: unknown
  ): void {
    const previous = this.previousLog
    const at = this.now()
    if (
      previous?.event === event &&
      previous.kind === kind &&
      previous.reason === reason &&
      at - previous.at < REPEAT_LOG_MS
    )
      return
    this.previousLog = { event, kind, reason, at }
    const data = { lane: this.lane, kind, reason }
    if (event === 'compute.worker.failed') rendererLog.error(event, 'compute', error, data)
    else rendererLog.warn(event, 'compute', data)
  }

  watch(kind: JobKind): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      rendererLog.warn('compute.request.slow', 'compute', {
        lane: this.lane,
        kind,
        reason: 'no-response',
        elapsedMs: SLOW_JOB_MS
      })
    }, SLOW_JOB_MS)
  }
}

export function workerFailureReason(event: unknown, fallback: string): string {
  if (typeof event === 'string') return event
  if (
    event &&
    typeof event === 'object' &&
    'message' in event &&
    typeof event.message === 'string' &&
    event.message
  )
    return event.message
  return fallback
}
