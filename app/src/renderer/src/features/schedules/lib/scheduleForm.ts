// 예약 작업 모달의 폼 로직 — 순수. 화면 선택을 `ScheduledTaskInput` 으로 옮기고
// 만들 수 있는지 판정한다. 같은 규칙을 main 이 zod + 서비스에서 다시 본다.

import {
  isValidTrigger,
  SCHEDULE_COMMAND_MAX,
  SCHEDULE_TITLE_MAX,
  type PromptExecution,
  type ScheduledTaskInput,
  type ScheduledTaskRecord,
  type TimeOfDay,
  type TriggerSpec,
  type Weekday
} from '../../../../../shared/scheduled-tasks'

export interface ScheduleProject {
  id: string
  name: string
  cwd: string | null
}

export type ScheduleKind = 'prompt' | 'shell'

export interface ScheduleFormState {
  title: string
  projectId: string | null
  kind: ScheduleKind
  // 프롬프트 본문과 shell 명령은 한 입력을 쓴다 — 종류를 바꿔도 적던 내용이 남는다.
  body: string
  execution: PromptExecution | null
  triggerKind: TriggerSpec['kind']
  day: Weekday
  days: Weekday[]
  at: TimeOfDay
}

export type FormIssue = 'title' | 'project' | 'project_no_folder' | 'body' | 'execution' | 'trigger'

export function emptyForm(): ScheduleFormState {
  return {
    title: '',
    projectId: null,
    kind: 'prompt',
    body: '',
    execution: null,
    triggerKind: 'hourly',
    day: 1,
    days: [1],
    at: { hour: 9, minute: 0 }
  }
}

export function formFromTask(task: ScheduledTaskRecord): ScheduleFormState {
  const base = emptyForm()
  const trigger = task.trigger
  return {
    ...base,
    title: task.title,
    projectId: task.projectId,
    kind: task.action.kind,
    body: task.action.kind === 'prompt' ? task.action.text : task.action.command,
    execution: task.action.kind === 'prompt' ? task.action.execution : null,
    triggerKind: trigger.kind,
    day: trigger.kind === 'weekly' ? trigger.day : base.day,
    days: trigger.kind === 'custom' ? [...trigger.days] : base.days,
    at: trigger.kind === 'hourly' ? base.at : { ...trigger.at }
  }
}

export function triggerFromForm(form: ScheduleFormState): TriggerSpec {
  switch (form.triggerKind) {
    case 'hourly':
      return { kind: 'hourly' }
    case 'daily':
      return { kind: 'daily', at: form.at }
    case 'weekly':
      return { kind: 'weekly', day: form.day, at: form.at }
    case 'custom':
      return { kind: 'custom', days: [...form.days].sort((a, b) => a - b), at: form.at }
  }
}

export function toggleDay(days: Weekday[], day: Weekday): Weekday[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
}

// 시각 선택지 — 30분 단위 48개.
export const TIME_OPTIONS: readonly TimeOfDay[] = Array.from({ length: 48 }, (_, index) => ({
  hour: Math.floor(index / 2),
  minute: index % 2 === 0 ? 0 : 30
}))

export function timeKey(at: TimeOfDay): string {
  return `${at.hour}:${at.minute}`
}

export type FormResult = { ok: true; request: ScheduledTaskInput } | { ok: false; issue: FormIssue }

export function validateForm(
  form: ScheduleFormState,
  projects: readonly ScheduleProject[]
): FormResult {
  const title = form.title.trim()
  if (title.length < 1 || title.length > SCHEDULE_TITLE_MAX) return { ok: false, issue: 'title' }
  const project = projects.find((item) => item.id === form.projectId)
  if (!project) return { ok: false, issue: 'project' }
  if (form.kind === 'shell' && !project.cwd) return { ok: false, issue: 'project_no_folder' }
  if (form.body.trim().length < 1 || form.body.length > SCHEDULE_COMMAND_MAX) {
    return { ok: false, issue: 'body' }
  }
  if (form.kind === 'prompt' && !form.execution) return { ok: false, issue: 'execution' }
  const trigger = triggerFromForm(form)
  if (!isValidTrigger(trigger)) return { ok: false, issue: 'trigger' }
  return {
    ok: true,
    request: {
      title,
      projectId: project.id,
      trigger,
      action:
        form.kind === 'prompt'
          ? { kind: 'prompt', text: form.body, execution: form.execution! }
          : { kind: 'shell', command: form.body }
    }
  }
}
