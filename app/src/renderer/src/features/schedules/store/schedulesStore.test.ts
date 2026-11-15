import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  setEnabled: vi.fn(),
  runNow: vi.fn(),
  listRuns: vi.fn(),
  onChanged: vi.fn()
}))
vi.mock('../../../shared/api/ipc', () => ({ scheduleApi: api }))
import { schedulesActions, subscribeScheduleChanges, useSchedulesStore } from './schedulesStore'

const task = (id: string, running = false): ScheduledTask => ({
  id,
  title: id,
  projectId: 'p1',
  trigger: { kind: 'hourly' },
  action: { kind: 'shell', command: 'x' },
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
  nextRunAt: 100,
  running,
  lastRun: null
})

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  vi.clearAllMocks()
  useSchedulesStore.setState({ list: [], loading: true, revision: 0 })
})

describe('schedulesStore', () => {
  it('변경 push 를 받으면 목록을 다시 읽어 반영한다', async () => {
    let push: () => void = () => undefined
    const unsubscribe = vi.fn()
    api.onChanged.mockImplementation((handler: () => void) => {
      push = handler
      return unsubscribe
    })
    api.list.mockResolvedValueOnce([task('a')])
    const stop = subscribeScheduleChanges()
    expect(api.list).not.toHaveBeenCalled()

    push()
    await flush()
    expect(useSchedulesStore.getState()).toMatchObject({
      list: [task('a')],
      loading: false,
      revision: 1
    })

    // 실행 상태가 바뀐 두 번째 push — 새 목록으로 교체되고 이력 재조회 신호가 오른다.
    api.list.mockResolvedValueOnce([task('a', true), task('b')])
    push()
    await flush()
    expect(useSchedulesStore.getState().list).toEqual([task('a', true), task('b')])
    expect(useSchedulesStore.getState().revision).toBe(2)

    stop()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('push 로 시작한 조회가 실패해도 던지지 않고 이전 목록을 유지한다', async () => {
    let push: () => void = () => undefined
    api.onChanged.mockImplementation((handler: () => void) => {
      push = handler
      return () => undefined
    })
    useSchedulesStore.setState({ list: [task('keep')], loading: false, revision: 3 })
    api.list.mockRejectedValueOnce(new Error('ipc down'))
    subscribeScheduleChanges()
    push()
    await flush()
    expect(useSchedulesStore.getState().list).toEqual([task('keep')])
  })

  it('쓰기 액션은 요청 뒤 목록을 다시 읽는다', async () => {
    api.list.mockResolvedValue([task('a')])
    const input = {
      title: 'a',
      projectId: 'p1',
      trigger: { kind: 'hourly' as const },
      action: { kind: 'shell' as const, command: 'x' }
    }
    await schedulesActions.create(input)
    expect(api.create).toHaveBeenCalledWith(input)
    await schedulesActions.update({ ...input, id: 'a' })
    expect(api.update).toHaveBeenCalledWith({ ...input, id: 'a' })
    await schedulesActions.setEnabled('a', false)
    expect(api.setEnabled).toHaveBeenCalledWith('a', false)
    await schedulesActions.remove('a')
    expect(api.delete).toHaveBeenCalledWith('a')
    expect(api.list).toHaveBeenCalledTimes(4)
  })

  it('첫 조회 실패는 로딩을 끝내고 호출자에게 던진다', async () => {
    api.list.mockRejectedValueOnce(new Error('nope'))
    await expect(schedulesActions.refresh()).rejects.toThrow('nope')
    expect(useSchedulesStore.getState().loading).toBe(false)
  })
})
