import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Modal, ModalActions, MODAL_CARD, MODAL_SECTION_LABEL } from '../../../shared/ui/Modal'
import {
  SCHEDULE_COMMAND_MAX,
  SCHEDULE_TITLE_MAX,
  type PromptExecution,
  type ScheduledTaskInput,
  type ScheduledTaskRecord
} from '../../../../../shared/scheduled-tasks'
import {
  emptyForm,
  formFromTask,
  validateForm,
  type ScheduleFormState,
  type ScheduleKind,
  type ScheduleProject
} from '../lib/scheduleForm'
import { TriggerFields } from './TriggerFields'

// 프롬프트 실행 설정(모델·노력·권한) 입력 — 모델 카탈로그는 chat feature 가 알기 때문에
// pages 가 슬롯으로 넣는다(feature 교차 import 금지).
export type RenderExecutionPicker = (
  value: PromptExecution | null,
  onChange: (value: PromptExecution | null) => void
) => ReactNode
// 프로젝트 칩·메뉴 — 컴포저 프로젝트 버튼과 같은 것을 pages 가 넣는다.
export type RenderProjectPicker = (
  value: string | null,
  onChange: (projectId: string) => void
) => ReactNode
export interface SchedulePickers {
  project: RenderProjectPicker
  execution: RenderExecutionPicker
}

interface ScheduleTaskModalProps {
  open: boolean
  // 있으면 편집, 없으면 생성.
  initial?: ScheduledTaskRecord
  projects: readonly ScheduleProject[]
  pickers: SchedulePickers
  onSubmit: (input: ScheduledTaskInput) => Promise<void>
  onClose: () => void
}

// `!open` 이면 unmount 되어 재오픈 시 폼이 초기값으로 돌아간다(CreateProjectModal 과 같은 규칙).
export function ScheduleTaskModal(props: ScheduleTaskModalProps): React.JSX.Element | null {
  if (!props.open) return null
  return <ScheduleTaskModalOpen {...props} />
}

function ScheduleTaskModalOpen({
  initial,
  projects,
  pickers,
  onSubmit,
  onClose
}: ScheduleTaskModalProps): React.JSX.Element {
  const { tr } = useI18n()
  const [form, setForm] = useState<ScheduleFormState>(() =>
    initial ? formFromTask(initial) : emptyForm()
  )
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const result = validateForm(form, projects)
  const canSave = result.ok && !busy

  const save = async (): Promise<void> => {
    if (!result.ok || busy) return
    setBusy(true)
    setFailed(false)
    try {
      await onSubmit(result.request)
      onClose()
    } catch {
      // 실패는 모달을 닫지 않고 알린다 — 입력을 잃지 않게.
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      // 헤더 제목 대신 본문 맨 위의 큰 제목 입력이 그 자리를 갖는다.
      ariaLabel={tr(initial ? 'schedules.modal.editTitle' : 'schedules.modal.createTitle')}
      onClose={onClose}
      width={600}
      busy={busy}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel={tr(initial ? 'common.save' : 'common.create')}
          confirmDisabled={!canSave}
          cancelDisabled={busy}
        />
      }
    >
      <ScheduleTaskForm
        form={form}
        projects={projects}
        pickers={pickers}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        autoFocusTitle
      />
      {failed && (
        <p role="alert" className="mt-3 text-caption text-danger">
          {tr('schedules.modal.saveFailed')}
        </p>
      )}
    </Modal>
  )
}

interface ScheduleTaskFormProps {
  form: ScheduleFormState
  projects: readonly ScheduleProject[]
  pickers: SchedulePickers
  onChange: (patch: Partial<ScheduleFormState>) => void
  autoFocusTitle?: boolean
}

const KIND_KEYS = { prompt: 'schedules.kindPrompt', shell: 'schedules.kindShell' } as const

// 모달 본문 — 큰 제목 입력 → 프로젝트·실행 설정 칩 한 줄 → 트리거 → 명령. 상태를 갖지 않는다.
export function ScheduleTaskForm({
  form,
  projects,
  pickers,
  onChange,
  autoFocusTitle = false
}: ScheduleTaskFormProps): React.JSX.Element {
  const { tr } = useI18n()
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocusTitle) queueMicrotask(() => titleRef.current?.focus())
  }, [autoFocusTitle])
  const project = projects.find((item) => item.id === form.projectId)
  const needsFolder = form.kind === 'shell' && project != null && !project.cwd

  return (
    <div data-schedule-form={form.kind} className="flex flex-col gap-5">
      <div>
        <input
          ref={titleRef}
          data-schedule-title=""
          aria-label={tr('schedules.modal.title')}
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={SCHEDULE_TITLE_MAX}
          placeholder={tr('schedules.modal.titlePlaceholder')}
          className="w-full border-0 bg-transparent p-0 font-serif text-[24px] font-medium tracking-[-0.01em] text-ink outline-none placeholder:text-ink3"
        />
        <div data-schedule-settings="" className="mt-3 flex flex-wrap items-center gap-2">
          <span data-schedule-project="" className="contents">
            {pickers.project(form.projectId, (projectId) => onChange({ projectId }))}
          </span>
          {form.kind === 'prompt' && (
            <div data-schedule-execution="" className="contents">
              {pickers.execution(form.execution, (execution) => onChange({ execution }))}
            </div>
          )}
        </div>
        {needsFolder ? (
          <p role="alert" className="mt-2 text-caption text-danger">
            {tr('schedules.modal.shellNeedsFolder')}
          </p>
        ) : (
          <p className="mt-2 text-caption text-ink3">
            {tr(
              projects.length === 0
                ? 'schedules.modal.noProjects'
                : form.kind === 'shell'
                  ? 'schedules.modal.shellProjectHint'
                  : 'schedules.modal.projectHint'
            )}
          </p>
        )}
      </div>

      <div>
        <div className={MODAL_SECTION_LABEL}>{tr('schedules.modal.trigger')}</div>
        <TriggerFields form={form} onChange={onChange} />
      </div>

      <div data-schedule-command="">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-footnote text-ink2">{tr('schedules.modal.command')}</span>
          <div
            role="radiogroup"
            aria-label={tr('schedules.modal.command')}
            className="ml-auto flex gap-0.5 rounded-full border border-border bg-fill-contained p-0.5"
          >
            {(Object.keys(KIND_KEYS) as ScheduleKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.kind === kind}
                data-schedule-kind={kind}
                onClick={() => onChange({ kind })}
                className={`rounded-full px-3 py-1 text-caption hide-focus-ring ring-focus transition-colors ${
                  form.kind === kind
                    ? 'bg-fill-uncontained-active font-medium text-ink'
                    : 'text-ink3 hover:text-ink'
                }`}
              >
                {tr(KIND_KEYS[kind])}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={form.body}
          onChange={(event) => onChange({ body: event.target.value })}
          maxLength={SCHEDULE_COMMAND_MAX}
          rows={5}
          aria-label={tr(KIND_KEYS[form.kind])}
          placeholder={tr(
            form.kind === 'prompt'
              ? 'schedules.modal.promptPlaceholder'
              : 'schedules.modal.shellPlaceholder'
          )}
          className={`${MODAL_CARD} block w-full resize-y px-3.5 py-3 text-[13px] leading-[1.6] text-ink outline-none placeholder:text-ink3 focus:border-border-strong ${
            form.kind === 'shell' ? 'font-mono' : ''
          }`}
        />
        {form.kind === 'shell' && (
          <p className="mt-1.5 text-caption text-ink3">{tr('schedules.modal.shellHint')}</p>
        )}
      </div>
    </div>
  )
}
