// 예약 작업 store. main 의 DB 가 SSOT — 변경 push(`oo:schedule:changed`)를 받으면
// 목록을 다시 읽는다. `nextRunAt`·`running`·`lastRun` 은 main 이 합성한 값을 그대로 쓴다.

import { create } from 'zustand'
import type {
  RunNowResult,
  ScheduledRun,
  ScheduledTask,
  ScheduledTaskInput
} from '../../../../../shared/scheduled-tasks'
import { scheduleApi } from '../../../shared/api/ipc'
import { rendererLog } from '../../../shared/logging'

interface SchedulesStoreState {
  list: ScheduledTask[]
  loading: boolean
  // 실행 이력을 다시 읽을 신호 — 변경 push 마다 오른다.
  revision: number
}

export const useSchedulesStore = create<SchedulesStoreState>()(() => ({
  list: [],
  loading: true,
  revision: 0
}))

const { setState } = useSchedulesStore

async function refresh(): Promise<void> {
  try {
    const list = await scheduleApi.list()
    setState((state) => ({ list, loading: false, revision: state.revision + 1 }))
  } catch (error) {
    setState({ loading: false })
    throw error
  }
}

// 변경 push 구독. 반환값으로 해제한다.
export function subscribeScheduleChanges(): () => void {
  return scheduleApi.onChanged(() => {
    // 이전 목록을 유지한다. 다음 push 나 화면 재진입이 다시 읽는다.
    void refresh().catch((error) =>
      rendererLog.warn('schedules.refresh.failed', 'schedules', { error: String(error) })
    )
  })
}

export const schedulesActions = {
  refresh,
  create: async (input: ScheduledTaskInput): Promise<void> => {
    await scheduleApi.create(input)
    await refresh()
  },
  update: async (input: ScheduledTaskInput & { id: string }): Promise<void> => {
    await scheduleApi.update(input)
    await refresh()
  },
  remove: async (id: string): Promise<void> => {
    await scheduleApi.delete(id)
    await refresh()
  },
  setEnabled: async (id: string, enabled: boolean): Promise<void> => {
    await scheduleApi.setEnabled(id, enabled)
    await refresh()
  },
  runNow: (id: string): Promise<RunNowResult> => scheduleApi.runNow(id),
  listRuns: (id: string): Promise<ScheduledRun[]> => scheduleApi.listRuns(id)
}

export function useSchedulesState<T>(selector: (s: SchedulesStoreState) => T): T {
  return useSchedulesStore(selector)
}
