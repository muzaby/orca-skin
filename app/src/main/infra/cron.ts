import { Cron } from 'croner'

export interface CronJob {
  stop(): void
  nextRun(): Date | null
}

export function assertValidCron(cron: string): void {
  try {
    const job = new Cron(cron, { paused: true }, () => {})
    job.stop()
  } catch (cause) {
    throw new Error('Invalid scheduler cron expression', { cause })
  }
}

// cron 식으로 타이머 하나를 시작한다. 시각은 시스템 로컬 기준이고, 앞선 발화의 콜백이 아직
// 끝나지 않았으면 그 발화는 건너뛴다(`protect`). 잘못된 식은 던진다.
export function startCron(cron: string, fire: () => void): CronJob {
  const job = new Cron(cron, { protect: true }, fire)
  return { stop: () => job.stop(), nextRun: () => job.nextRun() }
}
