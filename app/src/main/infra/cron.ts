import { Cron } from 'croner'

export function assertValidCron(cron: string): void {
  try {
    const job = new Cron(cron, { paused: true }, () => {})
    job.stop()
  } catch (cause) {
    throw new Error('Invalid scheduler cron expression', { cause })
  }
}
