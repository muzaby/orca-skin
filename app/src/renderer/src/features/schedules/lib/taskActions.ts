// 목록 화면이 부르는 작업 동작 — 실패 보고와 삭제 확인을 한 곳이 갖는다.

import type { TFunction } from 'i18next'
import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'
import { reportError } from '../../../shared/errors'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { schedulesActions } from '../store/schedulesStore'

// 조용히 실패하면 "눌렀는데 아무 일도 없음" 으로 보인다 — 오류 토스트로 알린다.
export function reportTaskFailure(error: unknown): void {
  reportError({
    event: 'schedules.action.failed',
    scope: 'schedules',
    title: 'actionFailed',
    error
  })
}

// 삭제는 확인을 받은 뒤에만 한다 — 작업과 실행 이력이 함께 지워진다.
export function confirmTaskDeletion(
  task: Pick<ScheduledTask, 'id' | 'title'>,
  tr: TFunction,
  deps: {
    confirm: typeof openConfirmDialog
    remove: (id: string) => Promise<void>
  } = { confirm: openConfirmDialog, remove: schedulesActions.remove }
): void {
  deps.confirm({
    title: tr('schedules.deleteDialogTitle'),
    message: tr('schedules.deleteDialogMessage', { title: task.title }),
    confirmLabel: tr('common.delete'),
    danger: true,
    onConfirm: () => void deps.remove(task.id).catch(reportTaskFailure)
  })
}
