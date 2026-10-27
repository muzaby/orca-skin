import type { ComponentType, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import type { ChatState } from '../reducer/chatReducer'
import type { ComposerSubmitProps } from './types'
import type { Backend, ClassifiedError } from '../../../../../shared/ipc'
import type { AgentKind } from '../../../../../shared/agent-kind'
import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'
import type { Message } from '../reducer/chatReducer'
import type { PendingSteerState } from '../store/chatStore'
export type { ComposerSubmitProps, ModelPresentation } from './types'
export interface AgentComposerPresentation {
  showGitRow: boolean
  showLandingCwdControls: boolean
}

export interface AgentTranscriptPresentation {
  surface?: Backend
  turnProjection: 'standard' | 'work-activity'
  inlineSubagentDetail: boolean
  showTaskAgentLabel: boolean
  planBodyPlacement: 'approval-card' | 'right-panel'
  remountTranscriptBySession: boolean
}

export interface AgentPresentation {
  icon: IconName
  navIcon: IconName
  label: MessageKey
  greeting: MessageKey
  placeholder: MessageKey
  composer: AgentComposerPresentation
  transcript: AgentTranscriptPresentation
}

export interface TranscriptViewProps {
  backend?: Backend | null
  agentKind: AgentKind
  messages: Message[]
  pendingSteer: PendingSteerState[]
  onRestoreSteerDraft?: (text: string) => void
  inflight: boolean
  loadingSession: boolean
  error?: ClassifiedError
  // 마지막 교환에 예약공간(min-h-[50cqh])을 적용할지 — useScrollAnchor 가 결정.
  anchored: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
}

export interface TranscriptTimelineProps extends TranscriptViewProps {
  textScaleClassName: string
  showAutomaticFeeds: boolean
}

export interface ComposerAppearance {
  shell: string
  prompt: (dragging: boolean) => string
  controls: string
  controlsEnd: string
  typography: string
  textarea: string
}
export interface TranscriptAppearance {
  userBubble: string
  pendingBubble: string
  meta: string
  userWidth: string
}
export interface HarnessSurfaces {
  transcriptRoot: string
  message: string
  directory: string
  pathWidth: string
}
export interface RightPanelAppearance {
  tile: string
  title: string
  overviewTile?: string
}

export interface HarnessLandingPresentation {
  Header: ComponentType<{ framed?: boolean }>
  composer: { openCodeLanding: boolean; flush: boolean }
}
export interface ComposerInputPresentation {
  sourceIcon?: (source: string) => ReactNode
  appearance: ComposerAppearance
  includeSkills: boolean
  includeManagedMcp: boolean
  managedMcpAvailability: 'bindings' | 'observed'
  controlsPlacement: 'split' | 'end'
  harness: Backend
  placeholder: (kind: AgentKind) => MessageKey
  Chip: ForwardRefExoticComponent<ComposerChipProps & RefAttributes<HTMLButtonElement>>
  SubmitButton: ComponentType<ComposerSubmitProps>
}
export interface ComposerControlProps {
  agents: AgentEnvironment[]
  providerKey: string | null
  modelFamily: string | null
  model: { alias: string; model: string | null; isCustom: boolean } | null
}
export interface ToolApprovalBodyProps {
  approvalId: string
  toolName: string
  input: unknown
}
export interface ComposerModule extends ComposerInputPresentation {
  showGitRow: boolean
  label?: string
  landingContextBelow: boolean
  Status: ComponentType<{ onHandoffStarted: () => void }>
  Requests: ComponentType
  AboveInput: ComponentType<{ inflight: boolean }>
  inputBlocked: (
    state: Pick<ChatState, 'pendingAsks' | 'pendingToolApprovals' | 'pendingRequestOrder'>
  ) => boolean
  ModeControl: ComponentType<ComposerControlProps>
  EffortControl: ComponentType<ComposerControlProps>
}

export interface RightPanelTileRegistration {
  id: import('../lib/rightPanelTiles').RightPanelTileId
  defaultLabelKey: MessageKey
  Content: ComponentType
  HeaderActions?: ComponentType
  HeaderContent?: ComponentType<import('../lib/rightPanelTiles').RightPanelHeaderProps>
}

export interface RightPanelHostConfiguration {
  backend: Backend
  appearance: RightPanelAppearance
  tileById: (id: import('../lib/rightPanelTiles').RightPanelTileId) => RightPanelTileRegistration
}

export interface RightPanelHostProps {
  projectName?: string | null
  projectPath?: string | null
  className?: string
  onExpandedChange?: (sessionKey: string, expanded: boolean) => void
  configuration: RightPanelHostConfiguration
  panelPolicy: import('../lib/rightPanelTiles').RightPanelAgentPolicy
  layout: import('../lib/rightPanelLayout').RightPanelLayout
}

export interface RightPanelModule {
  Panel: ComponentType<RightPanelHostProps>
  configuration: RightPanelHostConfiguration
  tiles: readonly RightPanelTileRegistration[]
  resetBySession: boolean
}

export interface ComposerChipProps {
  icon?: IconName
  label?: string
  disabled?: boolean
  title?: string
  onClick?: () => void
  ariaHasPopup?: boolean
  ariaExpanded?: boolean
  ariaPressed?: boolean
  // 기본은 입력 아래 컨트롤 행의 flat. 입력 위 작업 컨텍스트 행은 outlined 를 쓴다(chipSurface).
  variant?: import('./common/composer/chipSurface').ChipVariant
  // 폭 제한 같은 배치 전용 클래스. 색·테두리·높이는 chipSurface 가 소유하므로 여기서 덮지 않는다.
  className?: string
}
