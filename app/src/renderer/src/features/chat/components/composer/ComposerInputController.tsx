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
import { useChatSession } from '../../store/chatStore'
import { agentPresentation } from '../../lib/agentPresentation'
import type { ComposerDraftUpdate } from '../../lib/composerDraft'
import { useSkills } from '../../../../shared/hooks/useSkills'
import { useAttachments } from '../../hooks/useAttachments'
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete'
import { useSkillAutocomplete } from '../../hooks/useSkillAutocomplete'
import type { AttachmentView, ComposerAttachment, SkillInfo } from '../../../../../../shared/ipc'
import type { DiffRequirementSubmitSnapshot } from '../../store/chatStore'
import { AttachMenu } from './AttachMenu'
import { AttachmentTray } from './AttachmentTray'
import { ComposerChip } from './ComposerChip'
import { ComposerInputSurface, type ComposerInputSurfaceHandle } from './ComposerInputSurface'
import { MentionAutocomplete } from './MentionAutocomplete'
import { handleAutocompleteKey } from './autocompleteKeys'
import { SkillAutocomplete } from './SkillAutocomplete'
import { submitComposerInput } from './composerSubmit'
import {
  applyMentionSuggestion,
  parseMentionToken,
  type MentionSuggestion
} from '../../lib/mentionAutocomplete'
import {
  createDraftSnapshot,
  applyDraftUpdate,
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
  restoredDraft?: ComposerDraftUpdate
  onSend: (
    text: string,
    attachments: ComposerAttachment[],
    attachmentViews: AttachmentView[],
    requirements: DiffRequirementSubmitSnapshot['anchors']
  ) => boolean
  diffRequirementSnapshot: DiffRequirementSubmitSnapshot
  requirementTray?: ReactNode
  onClearDiffRequirementsIfUnchanged: (snapshot: DiffRequirementSubmitSnapshot) => void
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
  diffRequirementSnapshot,
  requirementTray,
  onClearDiffRequirementsIfUnchanged,
  onCancel,
  controlsStart,
  controlsEnd
}: ComposerInputControllerProps): React.JSX.Element {
  const { tr } = useI18n()
  const agentKind = useChatSession((session) => session.agentKind)
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
    if (restoredDraft.mode === 'append' && !active) return
    restoredRef.current = restoredDraft.id
    updateSnapshot((current) => applyDraftUpdate(current, restoredDraft))
    if (active) focus(snapshotRef.current.text.length)
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
  const mentionAutocomplete = useMentionAutocomplete(
    derivedText,
    derivedCaret,
    active ? cwd : null,
    active
  )
  const skillOpen = active && derivedCurrent && autocomplete.open
  const mentionOpen = active && derivedCurrent && mentionAutocomplete.open

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

  const applyMentionAutocomplete = (suggestion: MentionSuggestion): void => {
    if (compositionActive()) return
    if (!derivedSnapshotIsCurrent(snapshotRef.current, deferredSnapshot)) return
    const token = parseMentionToken(deferredSnapshot.text, deferredSnapshot.selectionStart)
    if (!token) return
    const applied = applyMentionSuggestion(
      deferredSnapshot.text,
      deferredSnapshot.selectionStart,
      token,
      suggestion
    )
    const after = deferredSnapshot.text.slice(deferredSnapshot.selectionStart)
    const replacement = applied.text.slice(token.tokenStart, applied.text.length - after.length)
    const nextCaret = applied.caret

    updateSnapshot((current) => {
      const replaced = replaceDraftRange(
        current,
        deferredSnapshot.revision,
        token.tokenStart,
        deferredSnapshot.selectionStart,
        replacement
      )
      return replaced === current ? current : updateDraftSelection(replaced, nextCaret, nextCaret)
    })
    if (suggestion.kind === 'plugin' || !suggestion.entry.isDirectory) mentionAutocomplete.close()
    focus(nextCaret)
  }

  const submit = (): void => {
    const submitted = snapshotRef.current
    const submittedRequirements = diffRequirementSnapshot
    if (compositionActive() || submitted.text.trim() === '' || steerBlocked) return
    const items = attachments
    void submitComposerInput({
      submitted,
      submittedRequirements,
      items,
      buildAttachmentViews,
      onSend,
      compositionActive,
      currentDraft: () => snapshotRef.current,
      resetAttachmentsIfUnchanged,
      onClearDiffRequirementsIfUnchanged,
      updateSnapshot,
      focus
    })
  }

  const feedbackMode = inflight && !steerBlocked && snapshot.text.trim() !== ''
  const showCancelButton = !feedbackMode && (inflight || toolApprovalPending)

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const composing = compositionActive(event.nativeEvent.isComposing)
    if (composing) return
    if (skillOpen && handleAutocompleteKey(event.key, autocomplete, applyAutocomplete)) {
      event.preventDefault()
      return
    }
    if (
      mentionOpen &&
      handleAutocompleteKey(event.key, mentionAutocomplete, applyMentionAutocomplete)
    ) {
      event.preventDefault()
      return
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
            {requirementTray}
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
                  validFilePaths={mentionAutocomplete.validFilePaths}
                  validPluginIds={mentionAutocomplete.validPluginIds}
                  placeholder={
                    inflight
                      ? steerBlocked
                        ? tr('chat.composer.placeholderProviderBoundary')
                        : tr('chat.composer.placeholderFeedback')
                      : tr(agentPresentation[agentKind].placeholder)
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
      <MentionAutocomplete
        open={mentionOpen}
        loading={mentionAutocomplete.loading}
        anchorRef={surfaceWrapRef}
        dirPath={mentionAutocomplete.dirPath}
        groups={mentionAutocomplete.groups}
        suggestions={mentionAutocomplete.suggestions}
        activeIndex={mentionAutocomplete.activeIndex}
        onHover={mentionAutocomplete.setActiveIndex}
        onPick={applyMentionAutocomplete}
      />
    </>
  )
}
