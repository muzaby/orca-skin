import { useRef, useState } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { Popover } from '../../../../../shared/ui/Popover'
import { ComposerChip } from '../../../components/composer/ComposerChip'
import { chatActions, useChatSession } from '../../../store/chatStore'
import { ModeMenu } from './ModeMenu'
import { EffortMenu } from './EffortMenu'
import { EFFORT_LABEL_KEYS } from './effort'
import { permissionModeLabelKey, modeMenuOptions } from './modes'
import { defaultEffortForModel } from '../../../../../../../shared/harnesses/claude/model-effort'

export function ClaudeModeControl({
  model
}: {
  model: { alias: string; model: string | null; isCustom: boolean } | null
}): React.JSX.Element {
  const { tr } = useI18n()
  const permissionMode = useChatSession((s) => s.permissionMode)
  const permissionModeError = useChatSession((s) => s.permissionModeError)
  const agentKind = useChatSession((s) => s.agentKind)
  const { setPermissionMode } = chatActions
  const modeButtonRef = useRef<HTMLButtonElement>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  return (
    <>
      {' '}
      <ComposerChip
        ref={modeButtonRef}
        label={tr(
          permissionModeError
            ? 'chat.composer.permissionUpdateFailedLabel'
            : permissionModeLabelKey(permissionMode, agentKind)
        )}
        onClick={() => setModeMenuOpen((value) => !value)}
        ariaHasPopup
        ariaExpanded={modeMenuOpen}
        title={tr('chat.composer.permissionModeTitle')}
      />{' '}
      <Popover open={modeMenuOpen} anchorRef={modeButtonRef} onClose={() => setModeMenuOpen(false)}>
        <ModeMenu
          mode={permissionMode}
          options={modeMenuOptions(model, agentKind)}
          onPick={(mode) => {
            setPermissionMode(mode)
            setModeMenuOpen(false)
          }}
        />
      </Popover>
    </>
  )
}
export function ClaudeEffortControl({
  modelFamily
}: {
  modelFamily: string | null
}): React.JSX.Element {
  const { tr } = useI18n()
  const effort = useChatSession((s) => s.effort)
  const { setEffort } = chatActions
  const effortButtonRef = useRef<HTMLButtonElement>(null)
  const [effortMenuOpen, setEffortMenuOpen] = useState(false)
  return (
    <>
      {' '}
      <ComposerChip
        ref={effortButtonRef}
        label={tr(EFFORT_LABEL_KEYS[effort])}
        onClick={() => setEffortMenuOpen((v) => !v)}
        ariaHasPopup
        ariaExpanded={effortMenuOpen}
        title={tr('chat.composer.effortTitle')}
      />{' '}
      <Popover
        open={effortMenuOpen}
        anchorRef={effortButtonRef}
        onClose={() => setEffortMenuOpen(false)}
        align="end"
      >
        <EffortMenu
          effort={effort}
          defaultEffort={defaultEffortForModel(modelFamily)}
          onPick={(nextEffort) => {
            setEffort(nextEffort)
            setEffortMenuOpen(false)
          }}
        />
      </Popover>
    </>
  )
}
