// 예약 작업 IPC — 등록된 채널을 실제 zod 스키마로 지나 production 조립의 서비스까지 간다.
// `infra/ipc/handle` 만 대체한다(electron ipcMain 대신 채널 → 핸들러 맵).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import { MemoryScheduledTaskStore } from '../../features/scheduled-tasks/memory-store.testfixture'
import { createScheduledTasks } from '../scheduled-tasks'
import type { ScheduledPromptStart, ScheduledTask } from '../../../shared/scheduled-tasks'

const registered = vi.hoisted(() => new Map<string, (request?: unknown) => unknown>())
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    schema: {
      safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: unknown }
    },
    policy: 'reject' | { fallback: unknown },
    handler: (input: unknown) => unknown
  ) =>
    registered.set(channel, (input) => {
      const parsed = schema.safeParse(input)
      if (parsed.success) return handler(parsed.data)
      if (policy === 'reject') throw parsed.error
      return policy.fallback
    }),
  handlePlain: (channel: string, handler: () => unknown) => registered.set(channel, handler)
}))
import { registerScheduledTaskHandlers } from './scheduled-tasks'

const call = <T = unknown>(channel: string, input?: unknown): T =>
  registered.get(channel)!(input) as T

const execution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'claude-sonnet-5-5',
  effort: 'low',
  permissionMode: 'plan'
}
const promptInput = {
  title: '  아침 요약  ',
  projectId: 'project-a',
  trigger: { kind: 'daily', at: { hour: 9, minute: 30 } },
  action: { kind: 'prompt', text: '요약해 줘', execution }
}
const shellInput = {
  title: '야간 점검',
  projectId: 'project-a',
  trigger: { kind: 'hourly' },
  action: { kind: 'shell', command: 'npm run nightly' }
}

let store: MemoryScheduledTaskStore
let changed: ReturnType<typeof vi.fn<() => void>>
let sent: ScheduledPromptStart[]
// 살아 있는 타이머의 cron 식.
let crons: string[]

beforeEach(() => {
  registered.clear()
  store = new MemoryScheduledTaskStore()
  changed = vi.fn<() => void>()
  sent = []
  crons = []
  const { service, relay } = createScheduledTasks({
    store,
    projects: (id) =>
      id === 'project-a'
        ? { cwd: 'C:\\work\\a' }
        : id === 'project-flat'
          ? { cwd: null }
          : undefined,
    runShell: () => new Promise(() => undefined),
    sendPromptStart: (payload) => {
      sent.push(payload)
      return true
    },
    onChanged: changed,
    startCron: (cron) => {
      crons.push(cron)
      return {
        stop: () => void crons.splice(crons.indexOf(cron), 1),
        nextRun: () => new Date(5000)
      }
    }
  })
  registerScheduledTaskHandlers(service, relay)
})

describe('예약 작업 IPC', () => {
  it('생성 요청을 저장하고 등록한 뒤 목록에 돌려준다', () => {
    const created = call<ScheduledTask>(CHANNELS.scheduleCreate, promptInput)
    expect(created).toMatchObject({
      title: '아침 요약',
      projectId: 'project-a',
      trigger: { kind: 'daily', at: { hour: 9, minute: 30 } },
      action: { kind: 'prompt', text: '요약해 줘', execution },
      enabled: true,
      nextRunAt: 5000,
      running: false,
      lastRun: null
    })
    expect(crons).toEqual(['30 9 * * *'])
    expect(call<ScheduledTask[]>(CHANNELS.scheduleList)).toEqual([created])
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it.each<[string, unknown]>([
    ['빈 제목', { ...shellInput, title: '   ' }],
    ['121자 제목', { ...shellInput, title: 'a'.repeat(121) }],
    ['빈 명령', { ...shellInput, action: { kind: 'shell', command: '  ' } }],
    ['8001자 명령', { ...shellInput, action: { kind: 'shell', command: 'a'.repeat(8001) } }],
    ['프로젝트 없음', { ...shellInput, projectId: '' }],
    [
      '요일 없는 사용자 지정',
      { ...shellInput, trigger: { kind: 'custom', days: [], at: { hour: 9, minute: 0 } } }
    ],
    ['모델 없는 프롬프트', { ...promptInput, action: { kind: 'prompt', text: 'x' } }],
    [
      '알 수 없는 권한 모드',
      {
        ...promptInput,
        action: { ...promptInput.action, execution: { ...execution, permissionMode: 'root' } }
      }
    ],
    ['알 수 없는 명령 종류', { ...shellInput, action: { kind: 'sql', command: 'x' } }]
  ])('무효 페이로드를 거부한다: %s', (_name, input) => {
    expect(() => call(CHANNELS.scheduleCreate, input)).toThrow()
    expect(store.listTasks()).toEqual([])
    expect(changed).not.toHaveBeenCalled()
  })

  it('존재하지 않는 프로젝트·폴더 없는 프로젝트의 shell 을 거부한다', () => {
    expect(() => call(CHANNELS.scheduleCreate, { ...shellInput, projectId: 'ghost' })).toThrow()
    expect(() =>
      call(CHANNELS.scheduleCreate, { ...shellInput, projectId: 'project-flat' })
    ).toThrow()
    // 프롬프트는 폴더가 없어도 된다.
    expect(
      call<ScheduledTask>(CHANNELS.scheduleCreate, { ...promptInput, projectId: 'project-flat' })
        .projectId
    ).toBe('project-flat')
  })

  it('수정·토글·삭제가 등록과 목록에 반영된다', () => {
    const { id } = call<ScheduledTask>(CHANNELS.scheduleCreate, shellInput)
    const updated = call<ScheduledTask>(CHANNELS.scheduleUpdate, {
      ...shellInput,
      id,
      title: '주간 점검',
      trigger: { kind: 'weekly', day: 1, at: { hour: 8, minute: 0 } }
    })
    expect(updated).toMatchObject({ id, title: '주간 점검' })
    expect(crons).toEqual(['0 8 * * 1'])

    call(CHANNELS.scheduleSetEnabled, { id, enabled: false })
    expect(crons).toEqual([])
    expect(call<ScheduledTask[]>(CHANNELS.scheduleList)[0]).toMatchObject({
      enabled: false,
      nextRunAt: null
    })

    call(CHANNELS.scheduleDelete, { id })
    expect(call<ScheduledTask[]>(CHANNELS.scheduleList)).toEqual([])
    expect(changed).toHaveBeenCalledTimes(4)
  })

  it('수정은 새 작업을 만들지 않는다 — 꺼 둔 상태와 생성 시각이 남는다', () => {
    const created = call<ScheduledTask>(CHANNELS.scheduleCreate, shellInput)
    call(CHANNELS.scheduleSetEnabled, { id: created.id, enabled: false })
    const updated = call<ScheduledTask>(CHANNELS.scheduleUpdate, {
      ...shellInput,
      id: created.id,
      title: '바꾼 제목'
    })
    expect(updated).toMatchObject({ id: created.id, title: '바꾼 제목', enabled: false })
    expect(updated.createdAt).toBe(created.createdAt)
    expect(crons).toEqual([])
    expect(call<ScheduledTask[]>(CHANNELS.scheduleList)).toHaveLength(1)
  })

  it('지금 실행은 실행을 시작하고, 실행 중이면 거부한다', () => {
    const { id } = call<ScheduledTask>(CHANNELS.scheduleCreate, shellInput)
    expect(call(CHANNELS.scheduleRunNow, { id })).toEqual({ started: true })
    expect(call(CHANNELS.scheduleRunNow, { id })).toEqual({ started: false, reason: 'running' })
    expect(call(CHANNELS.scheduleRunNow, { id: 'nope' })).toEqual({
      started: false,
      reason: 'not_found'
    })
    expect(call<ScheduledTask[]>(CHANNELS.scheduleList)[0]).toMatchObject({ running: true })
    expect(call<unknown[]>(CHANNELS.scheduleListRuns, { id })).toEqual([
      expect.objectContaining({ status: 'running', origin: 'manual' })
    ])
  })

  it('프롬프트 실행은 시작 요청을 보내고 보고로 종결된다', async () => {
    const { id } = call<ScheduledTask>(CHANNELS.scheduleCreate, promptInput)
    call(CHANNELS.scheduleRunNow, { id })
    expect(sent).toEqual([
      { runId: sent[0]!.runId, projectId: 'project-a', text: '요약해 줘', execution }
    ])
    call(CHANNELS.schedulePromptReport, { runId: sent[0]!.runId, ok: true, sessionId: 'session-7' })
    await new Promise((resolve) => setImmediate(resolve))
    expect(call<unknown[]>(CHANNELS.scheduleListRuns, { id })).toEqual([
      expect.objectContaining({ status: 'success', sessionId: 'session-7' })
    ])
    expect(() => call(CHANNELS.schedulePromptReport, { runId: 'x', ok: true })).toThrow()
  })

  it('이력 조회의 무효 요청은 빈 목록이다', () => {
    expect(call(CHANNELS.scheduleListRuns, {})).toEqual([])
  })
})
