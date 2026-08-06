import { Cron } from 'croner'
import type { Settings } from '../../../shared/protocol'
import { errorMessage } from '../../infra/errors'
import { getLogger } from '../../infra/log/registry'
import { assertValidCron } from '../../infra/cron'
import type { JobAction, JobKey, RunRecorder, ScheduleSpec } from './types'

// cron 잡과 interval 잡을 같은 표면으로 감싼다 — unschedule/stopAll/nextRun 이 분기하지 않게.
interface JobHandle {
  stop(): void
  nextRun(): Date | null
}

interface ScheduledJob {
  handle: JobHandle
  spec: ScheduleSpec
}

export class Scheduler {
  private readonly actions = new Map<string, JobAction>()
  private readonly scheduled = new Map<string, ScheduledJob>()
  private readonly running = new Set<string>()
  private disposed = false

  constructor(
    private readonly recorder: RunRecorder,
    private readonly now: () => number = Date.now
  ) {}

  register(key: JobKey, action: JobAction): void {
    this.assertNotDisposed()
    this.actions.set(key, action)
  }

  schedule(key: JobKey, spec: ScheduleSpec): void {
    this.assertNotDisposed()
    const action = this.actions.get(key)
    if (!action) throw new Error(`Scheduler job is not registered: ${key}`)
    // 검증은 enabled 여부와 무관하게 먼저 — 꺼진 잡의 잘못된 스펙도 즉시 드러나야 한다.
    if ('cron' in spec) assertValidCron(spec.cron)
    else assertValidInterval(spec.intervalMs)
    // 스펙이 그대로면 손대지 않는다. applySettings 는 *모든* 설정 쓰기(lastSessionId 등 무관한
    // 것 포함)마다 불리므로, 무조건 재생성하면 interval 잡의 카운트다운이 매번 0으로 돌아가
    // 주기가 영영 도래하지 않는다. 스펙이 실제로 바뀔 때만 재-anchor 한다.
    const existing = this.scheduled.get(key)
    if (existing && sameSpec(existing.spec, spec)) return
    this.unschedule(key)
    if (spec.enabled === false) return
    const fire = (): void => {
      void this.invoke(key, action)
    }
    this.scheduled.set(key, {
      handle:
        'cron' in spec
          ? cronHandle(spec.cron, fire)
          : intervalHandle(spec.intervalMs, this.now, fire),
      spec
    })
  }

  applySettings(settings: Settings['scheduler']): void {
    this.schedule('usage-recompute', {
      enabled: settings.usageRecompute.enabled,
      cron: settings.usageRecompute.cron
    })
    // 업데이트 확인은 앱 시작 시각 기준 간격이라 cron 이 아니다(0156). 시작 시 1회 확인은
    // 컴포지션 루트가 별도로 수행하므로 첫 발화는 여기서 1주기 뒤다(중복 확인 방지).
    this.schedule('update-check', {
      enabled: settings.updateCheck.enabled,
      intervalMs: settings.updateCheck.intervalHours * 60 * 60 * 1000
    })
  }

  unschedule(key: JobKey): void {
    const existing = this.scheduled.get(key)
    if (!existing) return
    existing.handle.stop()
    this.scheduled.delete(key)
  }

  async runNow(key: JobKey): Promise<void> {
    this.assertNotDisposed()
    const action = this.actions.get(key)
    if (!action) throw new Error(`Scheduler job is not registered: ${key}`)
    await this.invoke(key, action)
  }

  nextRun(key: JobKey): Date | null {
    return this.scheduled.get(key)?.handle.nextRun() ?? null
  }

  stopAll(): void {
    if (this.disposed) return
    this.disposed = true
    for (const job of this.scheduled.values()) job.handle.stop()
    this.scheduled.clear()
    this.actions.clear()
    this.running.clear()
  }

  private async invoke(key: string, action: JobAction): Promise<void> {
    if (this.disposed) return
    const startedAt = this.now()
    if (this.running.has(key)) {
      const skippedId = this.recorder.start(key, startedAt)
      this.recorder.finish(skippedId, this.now(), 'skipped', 'Previous run is still active')
      return
    }
    this.running.add(key)
    const runId = this.recorder.start(key, startedAt)
    try {
      await action()
      this.recorder.finish(runId, this.now(), 'success', null)
      // 주기 실행 경계(0124 카탈로그) — job id·소요만 기록.
      getLogger()
        .child('scheduler')
        .info('scheduler.job.fired', { job: key, durationMs: this.now() - startedAt })
    } catch (e) {
      this.recorder.finish(runId, this.now(), 'error', errorMessage(e))
      getLogger()
        .child('scheduler')
        .error('scheduler.job.failed', e, { job: key, durationMs: this.now() - startedAt })
    } finally {
      this.running.delete(key)
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Scheduler is disposed')
  }
}

function assertValidInterval(intervalMs: number): void {
  // isInteger 는 NaN·±Infinity 를 이미 걸러낸다.
  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid scheduler interval: ${intervalMs}`)
  }
}

// ScheduleSpec 은 평평한 2키라 얕은 비교로 충분하다.
function sameSpec(a: ScheduleSpec, b: ScheduleSpec): boolean {
  if (a.enabled !== b.enabled) return false
  if ('cron' in a) return 'cron' in b && a.cron === b.cron
  return 'intervalMs' in b && a.intervalMs === b.intervalMs
}

function cronHandle(cron: string, fire: () => void): JobHandle {
  const job = new Cron(cron, { protect: true }, fire)
  return { stop: () => job.stop(), nextRun: () => job.nextRun() }
}

// croner 의 interval 옵션은 "실행 사이의 *최소* 간격" 이라 패턴과 합성돼야 하고 첫 발화가
// 패턴에 종속된다. "schedule 시각 + N" 이라는 단순한 의미가 필요하므로 setInterval 을 쓴다.
function intervalHandle(intervalMs: number, now: () => number, fire: () => void): JobHandle {
  let nextAt = now() + intervalMs
  const timer = setInterval(() => {
    nextAt = now() + intervalMs
    fire()
  }, intervalMs)
  return {
    stop: () => clearInterval(timer),
    nextRun: () => new Date(nextAt)
  }
}
