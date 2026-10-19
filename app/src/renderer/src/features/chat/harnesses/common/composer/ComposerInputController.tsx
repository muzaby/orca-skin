import type { ComposerInputPresentation } from '../../contracts'
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
import { useI18n } from '../../../../../shared/i18n'
import { useChatSession } from '../../../store/chatStore'
import type { ComposerDraftUpdate } from '../../../lib/composerDraft'
import { useSkills } from '../../../../../shared/hooks/useSkills'
import { useAttachments } from '../../../hooks/useAttachments'
import { useMentionAutocomplete } from '../../../hooks/useMentionAutocomplete'
import { useSkillAutocomplete } from '../../../hooks/useSkillAutocomplete'
import type { AttachmentView, ComposerAttachment, SkillInfo } from '../../../../../../../shared/ipc'
import type { DiffRequirementSubmitSnapshot } from '../../../store/chatStore'
import { AttachMenu } from './AttachMenu'
import type { AttachMenuAction } from '../../../lib/attachMenuModel'
import { runAttachMenuAction } from './composerAttachMenu'
import { AttachmentTray } from './AttachmentTray'
import { ComposerInputSurface, type ComposerInputSurfaceHandle } from './ComposerInputSurface'
import { MentionAutocomplete } from './MentionAutocomplete'
import { handleAutocompleteKey } from './autocompleteKeys'
import { SkillAutocomplete } from './SkillAutocomplete'
import { submitComposerInput } from './composerSubmit'
import {
  applyMentionSuggestion,
  parseMentionToken,
  type MentionSuggestion
} from '../../../lib/mentionAutocomplete'
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
  presentation: ComposerInputPresentation
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
  // '+' 메뉴의 '플러그인 관리' — 페이지가 주입한다(0259 D-010). 없으면 그 항목이 없다.
  onManagePlugins?: () => void
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
  presentation,
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
  controlsEnd,
  onManagePlugins
}: ComposerInputControllerProps): React.JSX.Element {
  const { tr } = useI18n()
  const agentKind = useChatSession((session) => session.agentKind)
  const { appearance, includeExtensions, controlsPlacement, Chip, SubmitButton } = presentation
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
  const availableSkills = useSkills()
  const skills = useMemo(
    () => (includeExtensions ? availableSkills : []),
    [includeExtensions, availableSkills]
  )
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
    active,
    includeExtensions
  )
  const skillOpen = active && derivedCurrent && autocomplete.open
  const mentionOpen = active && derivedCurrent && mentionAutocomplete.open

  // '+' 메뉴 동작(0259) — 파일 추가는 현행 선택 창, 스킬·플러그인은 커서 자리에 토큰을 넣는다.
  const onAttachMenuAction = (action: AttachMenuAction): void =>
    runAttachMenuAction(action, {
      closeMenu: () => setAttachMenuOpen(false),
      pickAttachments: () => void pickAttachments(),
      compositionActive: () => compositionActive(),
      snapshot: () => snapshotRef.current,
      updateSnapshot,
      focus
    })

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
          className={appearance.shell}
          data-harness={presentation.harness}
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
            className={appearance.prompt(draggingAttachment)}
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
                  appearance={appearance}
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
                      : tr(presentation.placeholder(agentKind))
                  }
                  ariaLabel={tr('chat.composer.inputAria')}
                />
              </div>
              <SubmitButton
                showCancelButton={showCancelButton}
                onCancel={onCancel}
                submit={submit}
                canAbort={canAbort}
                text={snapshot.text}
                feedbackMode={feedbackMode}
              />
            </div>
          </div>
          <div className={appearance.controls}>
            <div
              className="app-frame-composer-repo flex items-center gap-1.5"
              data-behavior="dismissible"
            >
              {controlsPlacement === 'split' && controlsStart}
              <Chip
                ref={attachButtonRef}
                icon="plus"
                onClick={() => setAttachMenuOpen((value) => !value)}
                ariaHasPopup
                ariaExpanded={attachMenuOpen}
                title={tr('chat.composer.attachMenuTitle')}
              />
            </div>
            {controlsPlacement === 'end' ? (
              <div
                className="ml-[4px] h-full min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
                data-slot="composer-controls"
              >
                <span className={appearance.controlsEnd}>
                  {controlsStart}
                  {controlsEnd}
                </span>
              </div>
            ) : (
              <span className={appearance.controlsEnd}>{controlsEnd}</span>
            )}
          </div>
        </div>
      )}
      <AttachMenu
        open={active && attachMenuOpen}
        anchorRef={attachButtonRef}
        onClose={() => setAttachMenuOpen(false)}
        skills={skills}
        includeExtensions={includeExtensions}
        plugins={mentionAutocomplete.plugins}
        onAction={onAttachMenuAction}
        onManagePlugins={
          onManagePlugins
            ? () => {
                setAttachMenuOpen(false)
                onManagePlugins()
              }
            : undefined
        }
      />
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
