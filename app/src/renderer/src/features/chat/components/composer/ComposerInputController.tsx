import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n } from '../../../../shared/i18n'
import { useSkills } from '../../../../shared/hooks/useSkills'
import { useAttachments } from '../../hooks/useAttachments'
import { useFileAutocomplete } from '../../hooks/useFileAutocomplete'
import { useSkillAutocomplete } from '../../hooks/useSkillAutocomplete'
import type {
  AttachmentView,
  ComposerAttachment,
  FileEntry,
  SkillInfo
} from '../../../../../../shared/ipc'
import { AttachMenu } from './AttachMenu'
import { AttachmentTray } from './AttachmentTray'
import { ComposerChip } from './ComposerChip'
import { ComposerInputSurface, type ComposerInputSurfaceHandle } from './ComposerInputSurface'
import { FileAutocomplete } from './FileAutocomplete'
import { SkillAutocomplete } from './SkillAutocomplete'
import {
  clearDraftAfterAcceptedSubmit,
  createDraftSnapshot,
  replaceDraft,
  replaceDraftRange,
  setDraftComposition,
  updateDraftSelection,
  updateDraftSelectionWhenIdle,
  updateDraftText,
  type DraftSnapshot
} from './draftSnapshot'

interface ComposerInputControllerProps {
  active: boolean
  backendLabel: string
  canAbort: boolean
  inflight: boolean
  steerBlocked: boolean
  toolApprovalPending: boolean
  cwd: string | null
  initialDraft?: string
  restoredDraft?: { id: number; text: string }
  onSend: (
    text: string,
    attachments: ComposerAttachment[],
    attachmentViews: AttachmentView[]
  ) => boolean
  onCancel: () => void
  controlsStart: ReactNode
  controlsEnd: ReactNode
}

function derivedSnapshotIsCurrent(current: DraftSnapshot, deferred: DraftSnapshot): boolean {
  return (
    !current.composing &&
    current.revision === deferred.revision &&
    current.text === deferred.text &&
    current.selectionStart === deferred.selectionStart &&
    current.selectionEnd === deferred.selectionEnd
  )
}

// draft/selection/IME/attachments의 수명 경계. plan review가 input panel을 가려도 이
// 컴포넌트 인스턴스는 유지되어 시드·복원 소비 상태와 submit revision을 보존한다.
export function ComposerInputController({
  active,
  backendLabel,
  canAbort,
  inflight,
  steerBlocked,
  toolApprovalPending,
  cwd,
  initialDraft,
  restoredDraft,
  onSend,
  onCancel,
  controlsStart,
  controlsEnd
}: ComposerInputControllerProps): React.JSX.Element {
  const { tr } = useI18n()
  const [snapshot, setSnapshotState] = useState(createDraftSnapshot)
  const snapshotRef = useRef(snapshot)
  const updateSnapshot = useCallback((update: (current: DraftSnapshot) => DraftSnapshot): void => {
    const current = snapshotRef.current
    const next = update(current)
    if (next === current) return
    snapshotRef.current = next
    setSnapshotState(next)
  }, [])

  const {
    attachments,
    attachmentPreviews,
    draggingAttachment,
    setDraggingAttachment,
    pickAttachments,
    removeAttachment,
    addDroppedFiles,
    onPaste,
    buildAttachmentViews,
    resetIfUnchanged: resetAttachmentsIfUnchanged
  } = useAttachments()
  const skills = useSkills()
  const knownSkillNames = useMemo(() => new Set(skills.map((skill) => skill.name)), [skills])
  const surfaceRef = useRef<ComposerInputSurfaceHandle>(null)
  const surfaceWrapRef = useRef<HTMLDivElement>(null)
  const attachButtonRef = useRef<HTMLButtonElement>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)

  // 조합 상태는 스냅샷이 단일 소유한다(0149 — 별도 ref 미러 제거). 텍스트 변이 자체의 거부는
  // draftSnapshot 순수 함수가 하고, 여기 남은 용도는 **DOM 부수효과**(focus/setSelectionRange)와
  // 키 이벤트 분기 억제뿐이다. native isComposing 은 스냅샷보다 먼저 도착할 수 있어 함께 본다.
  const compositionActive = useCallback(
    (nativeIsComposing = false): boolean => snapshotRef.current.composing || nativeIsComposing,
    []
  )

  const focus = useCallback(
    (start: number, end = start): void => {
      queueMicrotask(() => {
        if (compositionActive()) return
        surfaceRef.current?.focus()
        surfaceRef.current?.setSelectionRange(start, end)
      })
    },
    [compositionActive]
  )

  const seededRef = useRef<string | null>(null)
  useEffect(() => {
    if (compositionActive()) return
    if (initialDraft === undefined || seededRef.current === initialDraft) return
    seededRef.current = initialDraft
    updateSnapshot((current) => replaceDraft(current, initialDraft))
    if (active) requestAnimationFrame(() => focus(initialDraft.length))
  }, [active, compositionActive, focus, initialDraft, snapshot.composing, updateSnapshot])

  const restoredRef = useRef<number | null>(null)
  useEffect(() => {
    if (compositionActive()) return
    if (!restoredDraft || restoredRef.current === restoredDraft.id) return
    restoredRef.current = restoredDraft.id
    updateSnapshot((current) => replaceDraft(current, restoredDraft.text))
    if (active) focus(restoredDraft.text.length)
  }, [active, compositionActive, focus, restoredDraft, snapshot.composing, updateSnapshot])

  useEffect(() => {
    if (active || !compositionActive()) return
    updateSnapshot((current) => setDraftComposition(current, false))
  }, [active, compositionActive, updateSnapshot])

  const deferredSnapshot = useDeferredValue(snapshot)
  const derivedCurrent = derivedSnapshotIsCurrent(snapshot, deferredSnapshot)
  const derivedText = active ? deferredSnapshot.text : ''
  const derivedCaret = active ? deferredSnapshot.selectionStart : 0
  const autocomplete = useSkillAutocomplete(derivedText, derivedCaret, skills)
  const fileAutocomplete = useFileAutocomplete(derivedText, derivedCaret, active ? cwd : null)
  const skillOpen = active && derivedCurrent && autocomplete.open
  const fileOpen = active && derivedCurrent && fileAutocomplete.open

  const openSkillPicker = (): void => {
    if (compositionActive()) return
    setAttachMenuOpen(false)
    const current = snapshotRef.current
    const nextText =
      current.text === '' || current.text.endsWith(' ') || current.text.endsWith('\n')
        ? `${current.text}/`
        : `${current.text} /`
    updateSnapshot((value) => replaceDraft(value, nextText))
    focus(nextText.length)
  }

  const applyAutocomplete = (skill: SkillInfo): void => {
    if (compositionActive()) return
    if (!derivedSnapshotIsCurrent(snapshotRef.current, deferredSnapshot)) return
    const start = autocomplete.tokenStart
    if (start < 0) return
    const replacement = `/${skill.name} `
    const nextCaret = start + replacement.length
    updateSnapshot((current) =>
      replaceDraftRange(
        current,
        deferredSnapshot.revision,
        start,
        deferredSnapshot.selectionStart,
        replacement
      )
    )
    autocomplete.close()
    focus(nextCaret)
  }

  const applyFileAutocomplete = (entry: FileEntry): void => {
    if (compositionActive()) return
    if (!derivedSnapshotIsCurrent(snapshotRef.current, deferredSnapshot)) return
    const start = fileAutocomplete.tokenStart
    if (start < 0) return
    const dir = fileAutocomplete.dirPath
    const full = dir === '' ? entry.name : `${dir}/${entry.name}`
    const body = entry.isDirectory ? `${full}/` : full
    let replacement: string
    let nextCaret: number

    if (fileAutocomplete.quoted && fileAutocomplete.hasClosingQuote) {
      replacement = `@"${body}`
      nextCaret = start + replacement.length + (entry.isDirectory ? 0 : 1)
    } else {
      const wrapped = /\s/.test(body) ? `"${body}"` : body
      replacement = entry.isDirectory ? `@${wrapped}` : `@${wrapped} `
      nextCaret = start + replacement.length
    }

    updateSnapshot((current) => {
      const replaced = replaceDraftRange(
        current,
        deferredSnapshot.revision,
        start,
        deferredSnapshot.selectionStart,
        replacement
      )
      return replaced === current ? current : updateDraftSelection(replaced, nextCaret, nextCaret)
    })
    if (!entry.isDirectory) fileAutocomplete.close()
    focus(nextCaret)
  }

  const submit = (): void => {
    const submitted = snapshotRef.current
    if (compositionActive() || submitted.text.trim() === '' || steerBlocked) return
    const items = attachments
    void buildAttachmentViews(items).then((views) => {
      if (!onSend(submitted.text, items, views)) return
      // text 또는 attachment가 바뀌었으면 둘 다 보존한다. 오래된 async 완료가 최신 초안을
      // 부분적으로 지우지 않도록 submit snapshot 전체를 하나의 clear 조건으로 취급한다.
      if (compositionActive()) return
      if (snapshotRef.current.revision !== submitted.revision) return
      if (!resetAttachmentsIfUnchanged(items)) return
      updateSnapshot((current) => clearDraftAfterAcceptedSubmit(current, submitted.revision))
      focus(0)
    })
  }

  const feedbackMode = inflight && !steerBlocked && snapshot.text.trim() !== ''
  const showCancelButton = !feedbackMode && (inflight || toolApprovalPending)

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const composing = compositionActive(event.nativeEvent.isComposing)
    if (composing) return
    if (skillOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const offset = event.key === 'ArrowDown' ? 1 : -1
        const length = autocomplete.suggestions.length
        autocomplete.setActiveIndex((autocomplete.activeIndex + offset + length) % length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const pick = autocomplete.suggestions[autocomplete.activeIndex]
        if (pick) applyAutocomplete(pick)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        autocomplete.close()
        return
      }
    }

    if (fileOpen) {
      const length = fileAutocomplete.suggestions.length
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (length > 0) {
          const offset = event.key === 'ArrowDown' ? 1 : -1
          fileAutocomplete.setActiveIndex((fileAutocomplete.activeIndex + offset + length) % length)
        }
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const pick = fileAutocomplete.suggestions[fileAutocomplete.activeIndex]
        if (pick) applyFileAutocomplete(pick)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        fileAutocomplete.close()
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <>
      {active && (
        <div
          className="contents"
          onPaste={onPaste}
          onDragOver={(event) => {
            event.preventDefault()
            setDraggingAttachment(true)
          }}
          onDragLeave={() => setDraggingAttachment(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDraggingAttachment(false)
            void addDroppedFiles(event.dataTransfer.files)
          }}
        >
          <div
            className={`epitaxy-prompt rounded-r7 border bg-panel px-3 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-colors ${
              draggingAttachment ? 'border-accent ring-2 ring-accent/40' : 'border-border'
            }`}
            data-surface="prompt"
            data-state={draggingAttachment ? 'drag-over' : undefined}
            title={tr('chat.composer.backendTitle', { label: backendLabel })}
          >
            <AttachmentTray
              attachments={attachments}
              previews={attachmentPreviews}
              onRemove={removeAttachment}
            />
            <div className="flex items-end gap-2">
              <div
                ref={surfaceWrapRef}
                className="app-frame-composer-input min-w-0 flex-1"
                data-behavior="interactive"
              >
                <ComposerInputSurface
                  ref={surfaceRef}
                  snapshot={snapshot}
                  onTextChange={(text, selectionStart, selectionEnd) =>
                    updateSnapshot((current) =>
                      updateDraftText(current, text, selectionStart, selectionEnd)
                    )
                  }
                  onSelectionChange={(selectionStart, selectionEnd) =>
                    updateSnapshot((current) =>
                      updateDraftSelectionWhenIdle(current, selectionStart, selectionEnd)
                    )
                  }
                  onCompositionChange={(composing, text, selectionStart, selectionEnd) =>
                    updateSnapshot((current) =>
                      setDraftComposition(current, composing, text, selectionStart, selectionEnd)
                    )
                  }
                  onKeyDown={onKeyDown}
                  knownSkillNames={knownSkillNames}
                  validFilePaths={fileAutocomplete.validPaths}
                  placeholder={
                    inflight
                      ? steerBlocked
                        ? tr('chat.composer.placeholderProviderBoundary')
                        : tr('chat.composer.placeholderFeedback')
                      : tr('chat.composer.placeholderIdle')
                  }
                  ariaLabel={tr('chat.composer.inputAria')}
                />
              </div>
              {showCancelButton ? (
                <Button
                  iconOnly
                  variant="uncontained"
                  leadingIcon="stop"
                  onClick={onCancel}
                  disabled={!canAbort}
                  title={canAbort ? tr('common.stop') : tr('chat.composer.abortUnsupported')}
                  aria-label={tr('common.stop')}
                  data-behavior="action:cancel-turn"
                  className="mb-1 shrink-0 rounded-full"
                />
              ) : (
                <Button
                  iconOnly
                  variant="uncontained"
                  leadingIcon="enter"
                  onClick={submit}
                  disabled={snapshot.text.trim() === ''}
                  title={
                    feedbackMode
                      ? tr('chat.composer.sendFeedbackEnter')
                      : tr('chat.composer.sendEnter')
                  }
                  aria-label={
                    feedbackMode ? tr('chat.composer.sendFeedback') : tr('chat.composer.send')
                  }
                  data-behavior={feedbackMode ? 'action:send-feedback' : 'action:send'}
                  className="mb-1 shrink-0 rounded-full"
                />
              )}
            </div>
          </div>
          <div className="app-frame-composer-controls flex items-center gap-1.5 px-1">
            <div
              className="app-frame-composer-repo flex items-center gap-1.5"
              data-behavior="dismissible"
            >
              {controlsStart}
              <ComposerChip
                ref={attachButtonRef}
                icon="plus"
                onClick={() => setAttachMenuOpen((value) => !value)}
                ariaHasPopup
                ariaExpanded={attachMenuOpen}
                title={tr('chat.composer.attachMenuTitle')}
              />
            </div>
            <span className="ml-auto flex items-center gap-g4">{controlsEnd}</span>
          </div>
        </div>
      )}
      <Popover
        open={active && attachMenuOpen}
        anchorRef={attachButtonRef}
        onClose={() => setAttachMenuOpen(false)}
      >
        <AttachMenu
          onPickAttachment={() => {
            setAttachMenuOpen(false)
            void pickAttachments()
          }}
          onPickSkill={openSkillPicker}
        />
      </Popover>
      <SkillAutocomplete
        open={skillOpen}
        anchorRef={surfaceWrapRef}
        suggestions={autocomplete.suggestions}
        activeIndex={autocomplete.activeIndex}
        onHover={autocomplete.setActiveIndex}
        onPick={applyAutocomplete}
      />
      <FileAutocomplete
        open={fileOpen}
        loading={fileAutocomplete.loading}
        anchorRef={surfaceWrapRef}
        dirPath={fileAutocomplete.dirPath}
        suggestions={fileAutocomplete.suggestions}
        activeIndex={fileAutocomplete.activeIndex}
        onHover={fileAutocomplete.setActiveIndex}
        onPick={applyFileAutocomplete}
      />
    </>
  )
}
