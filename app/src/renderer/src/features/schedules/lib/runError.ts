import { SCHEDULE_RUN_ERROR } from '../../../../../shared/scheduled-tasks'
import type { MessageKey } from '../../../shared/i18n'

const KNOWN_ERRORS = new Set<string>(Object.values(SCHEDULE_RUN_ERROR))

// 알려진 사유 코드는 문구로, 그 밖(프로세스·하네스 메시지)은 원문으로 보인다.
export function runErrorKey(error: string): MessageKey | null {
  return KNOWN_ERRORS.has(error) ? (`schedules.history.errors.${error}` as MessageKey) : null
}
