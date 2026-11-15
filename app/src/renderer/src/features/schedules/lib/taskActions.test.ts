// 예약 작업 삭제 — 확인을 받기 전에는 지우지 않고, 확인하면 그 작업만 지운다.

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/api/ipc', () => ({ scheduleApi: {} }))
import { confirmTaskDeletion } from './taskActions'

type Tr = Parameters<typeof confirmTaskDeletion>[1]
type Deps = NonNullable<Parameters<typeof confirmTaskDeletion>[2]>
type Request = Parameters<Deps['confirm']>[0]

const tr = ((key: string, options?: { title?: string }) =>
  options?.title ? `${key}:${options.title}` : key) as unknown as Tr

describe('confirmTaskDeletion', () => {
  it('확인 다이얼로그를 띄우고, 확인하기 전에는 지우지 않는다', () => {
    const requests: Request[] = []
    const remove = vi.fn(async () => undefined)
    confirmTaskDeletion({ id: 't-7', title: '아침 요약' }, tr, {
      confirm: (request) => void requests.push(request),
      remove
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      title: 'schedules.deleteDialogTitle',
      message: 'schedules.deleteDialogMessage:아침 요약',
      confirmLabel: 'common.delete',
      danger: true
    })
    expect(remove).not.toHaveBeenCalled()

    requests[0]!.onConfirm()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('t-7')
  })
})
