// 공급자가 확인한 세션 예약. cron 식으로 정확한 발화 시각을 추정하지 않는다.
export interface SessionSchedule {
  id: string
  schedule: string
  recurring: boolean
  prompt: string
}

export interface ReceivedMessageOrigin {
  kind: 'scheduled' | 'channel' | 'task' | 'peer' | 'automatic'
  label?: string
  /** Meaning of a provider-owned input, independent of its source and delivery. */
  format?: 'system-reminder' | 'tagged' | 'plain'
}
