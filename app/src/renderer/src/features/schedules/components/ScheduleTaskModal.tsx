import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Modal, ModalActions, MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
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

interface ScheduleTaskModalProps {
  open: boolean
  // 있으면 편집, 없으면 생성.
  initial?: ScheduledTaskRecord
  projects: readonly ScheduleProject[]
  renderExecutionPicker: RenderExecutionPicker
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
  renderExecutionPicker,
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
      title={tr(initial ? 'schedules.modal.editTitle' : 'schedules.modal.createTitle')}
      onClose={onClose}
      width={560}
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
        renderExecutionPicker={renderExecutionPicker}
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
  renderExecutionPicker: RenderExecutionPicker
  onChange: (patch: Partial<ScheduleFormState>) => void
  autoFocusTitle?: boolean
}

const KIND_KEYS = { prompt: 'schedules.kindPrompt', shell: 'schedules.kindShell' } as const

// 모달 본문 — 제목 → 프로젝트·실행 설정 → 트리거 → 명령. 상태를 갖지 않는다.
export function ScheduleTaskForm({
  form,
  projects,
  renderExecutionPicker,
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
    <div data-schedule-form={form.kind} className="flex flex-col gap-4">
      <label className="block">
        <div className={MODAL_LABEL}>{tr('schedules.modal.title')}</div>
        <input
          ref={titleRef}
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={SCHEDULE_TITLE_MAX}
          placeholder={tr('schedules.modal.titlePlaceholder')}
          className={MODAL_INPUT}
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-40 flex-1">
          <div className={MODAL_LABEL}>{tr('schedules.modal.project')}</div>
          <select
            value={form.projectId ?? ''}
            onChange={(event) => onChange({ projectId: event.target.value || null })}
            className={MODAL_INPUT}
          >
            <option value="">{tr('schedules.modal.projectPlaceholder')}</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.cwd ? item.name : tr('schedules.modal.projectNoFolder', { name: item.name })}
              </option>
            ))}
          </select>
        </label>
        {form.kind === 'prompt' && (
          <div data-schedule-execution="" className="flex flex-wrap items-end gap-3">
            {renderExecutionPicker(form.execution, (execution) => onChange({ execution }))}
          </div>
        )}
      </div>
      {projects.length === 0 && (
        <p className="-mt-2 text-caption text-ink3">{tr('schedules.modal.noProjects')}</p>
      )}
      {needsFolder && (
        <p role="alert" className="-mt-2 text-caption text-danger">
          {tr('schedules.modal.shellNeedsFolder')}
        </p>
      )}

      <div>
        <div className={MODAL_LABEL}>{tr('schedules.modal.trigger')}</div>
        <TriggerFields form={form} onChange={onChange} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-ink">
            {tr('schedules.modal.command')}
          </span>
          <div
            role="radiogroup"
            aria-label={tr('schedules.modal.command')}
            className="ml-auto flex gap-1 rounded-r4 border border-border p-0.5"
          >
            {(Object.keys(KIND_KEYS) as ScheduleKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.kind === kind}
                data-schedule-kind={kind}
                onClick={() => onChange({ kind })}
                className={`rounded-r3 px-2.5 py-1 text-caption hide-focus-ring ring-focus transition-colors ${
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
          className={`${MODAL_INPUT} resize-none leading-[1.6] ${form.kind === 'shell' ? 'font-mono' : ''}`}
        />
        {form.kind === 'shell' && (
          <p className="mt-1 text-caption text-ink3">{tr('schedules.modal.shellHint')}</p>
        )}
      </div>
    </div>
  )
}
