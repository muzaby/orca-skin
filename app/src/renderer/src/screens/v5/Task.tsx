import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../components/primitives/Icon'
import { Pill } from '../../components/primitives/Pill'
import { SidePanel } from '../../components/shell/SidePanel'
import { CollapsibleSection } from '../../components/primitives/CollapsibleSection'
import { StepCircle } from '../../components/primitives/ToolStatusIcon'
import { MessageBubble } from '../../components/chat/MessageBubble'
import { ToolBlock, Bash, CompletedTag, MsgFooter } from '../../components/chat/ToolBlock'
import { ApprovalGate } from '../../components/chat/ApprovalGate'
import { ArtifactPanel } from '../../components/artifact/ArtifactPanel'

export type TaskVariant = 'running' | 'approval' | 'result' | 'artifact'

export interface TaskProps {
  variant?: TaskVariant
  title?: string
  panelOpen?: boolean
  onTogglePanel?: () => void
  onCloseArtifact?: () => void
}

const DEFAULT_TITLE = 'Check and summarize download folder'

const STEPS = [
  { label: '30초 대기', done: true },
  { label: '다운로드 폴더 점검', done: true },
  { label: '있다면 30초 대기', done: false },
  { label: '없다면 요약', done: false }
]

const FOLDER_ITEMS: { label: string; kind: string; icon: IconName }[] = [
  { kind: '폴더', label: 'C:\\Users\\rlaeo\\Downloads', icon: 'folder' }
]

/** v5 Task screen (DESIGN.md §5 #08-10).
 *  Variant controls the conversation content: 'running' = mid-task with bash output,
 *  'approval' = folder permission gate, 'result' = artifact-linked summary. */
export function Task({
  variant = 'running',
  title = DEFAULT_TITLE,
  panelOpen = true,
  onTogglePanel,
  onCloseArtifact
}: TaskProps): React.JSX.Element {
  const showResultBody = variant === 'result' || variant === 'artifact'
  const isBusy = variant === 'running' || variant === 'approval'
  return (
    <>
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          backgroundColor: 'var(--bg)'
        }}
      >
        <ChatHeader title={title} panelOpen={panelOpen} onTogglePanel={onTogglePanel} />
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          <div
            style={{
              maxWidth: 760,
              margin: '0 auto',
              padding: '8px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 28
            }}
          >
            {variant === 'running' && <RunningConversation />}
            {variant === 'approval' && <ApprovalConversation />}
            {showResultBody && <ResultConversation />}
          </div>
        </div>
        <TaskComposer busy={isBusy} queued={variant === 'approval'} />
      </main>
      {variant === 'artifact' ? (
        <ArtifactPanel onClose={onCloseArtifact} />
      ) : (
        panelOpen && <TaskRightPanel />
      )}
    </>
  )
}

// ─── Header ─────────────────────────────────────────────────────────

export function ChatHeader({
  title,
  onTogglePanel,
  panelOpen
}: {
  title: string
  onTogglePanel?: () => void
  panelOpen?: boolean
}): React.JSX.Element {
  return (
    <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="sb-nav-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            color: 'var(--ink)',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6
          }}
        >
          {title}
          <Icon name="chevronD" size={14} color="var(--ink-3)" />
        </button>
      </div>
      <button
        type="button"
        className="tb-icon-btn"
        onClick={onTogglePanel}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
          background: panelOpen ? 'var(--press)' : 'transparent',
          color: panelOpen ? 'var(--ink)' : 'var(--ink-3)'
        }}
      >
        <Icon name="rightPane" size={18} />
      </button>
    </div>
  )
}

// ─── Composer ───────────────────────────────────────────────────────

export function TaskComposer({ busy, queued }: { busy?: boolean; queued?: boolean }): React.JSX.Element {
  return (
    <div style={{ padding: '8px 20px 18px', flex: '0 0 auto' }}>
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: 'var(--r-xl)',
          boxShadow: '0 1px 0 rgba(0,0,0,.02), 0 1px 2px rgba(0,0,0,.04)',
          border: '1px solid var(--line)'
        }}
      >
        <div
          style={{
            padding: '14px 18px 0',
            color: 'var(--ink-4)',
            fontSize: 14,
            minHeight: 2 * 22,
            lineHeight: 1.5
          }}
        >
          메시지를 입력하세요...
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 10px' }}>
          <button type="button" className="cm-btn">
            <Icon name="plus" size={18} color="var(--ink-3)" />
          </button>
          <Pill icon="hand" label="질문" dropdown surface="ghost" />
          <span style={{ marginLeft: 'auto' }} />
          <Pill label="Sonnet 4.6" dropdown surface="ghost" />
          {busy && (
            <button type="button" className="cm-btn" title="정지">
              <Icon name="maximize" size={11} color="var(--ink-3)" stroke={1.6} />
            </button>
          )}
          {queued && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(0,0,0,.05)',
                padding: '4px 9px',
                borderRadius: 999,
                fontSize: 12,
                color: 'var(--ink-2)'
              }}
            >
              <Icon name="arrowDown" size={12} color="var(--ink-3)" />
              대기열
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--ink-4)' }}>
        Claude는 AI이며 실수할 수 있습니다. 응답을 다시 한번 확인해 주세요.
      </div>
    </div>
  )
}

// ─── Conversation variants ──────────────────────────────────────────

function RunningConversation(): React.JSX.Element {
  return (
    <>
      <MessageBubble role="user">
        {`1. 30초 대기 후 다운로드 폴더로 이동하라
2. 다운로드 파일이 있는지 점검하라
3. 있는 경우 30초 기다리고
4. 없는 경우 다운로드 폴더의 파일을 요약하라`}
      </MessageBubble>

      <MessageBubble role="assistant">
        <Column>
          <ToolBlock title="도구 4개 사용함, 로드된 도구" status="done" collapsible opened={false} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>30초 대기 시작합니다...</p>
          <ToolBlock title="명령 실행함" status="done">
            <Bash>
              <span style={{ color: 'var(--good)' }}>sleep</span> 30 && <span style={{ color: 'var(--good)' }}>echo</span>{' '}
              <span style={{ color: 'var(--rust)' }}>"대기 완료"</span>
            </Bash>
          </ToolBlock>
          <CompletedTag />
          <MsgFooter />
        </Column>
      </MessageBubble>

      <MessageBubble role="assistant" busy>
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          <span className="pulse">작업 중...</span>
        </div>
      </MessageBubble>
    </>
  )
}

function ApprovalConversation(): React.JSX.Element {
  return (
    <>
      <MessageBubble role="user">이어서 진행</MessageBubble>
      <MessageBubble role="assistant">
        <Column>
          <ToolBlock title="사고 과정" status="done" collapsible opened={false} />
          <p style={{ margin: 0, fontSize: 14 }}>
            30초는 이미 경과했으니 Task 1을 완료 처리하고, 다운로드 폴더 접근으로 이어갑니다.
          </p>
          <ToolBlock title="도구 2개 사용함" status="done" collapsible opened={false} />
          <p style={{ margin: 0, fontSize: 14 }}>다운로드 폴더에 접근 권한을 요청합니다.</p>
          <ToolBlock title="작업 중" status="running" collapsible opened={false} />
          <ToolBlock title="Request cowork directory" status="done" collapsible opened={false} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-3)' }}>
            <Icon name="tool" size={13} color="var(--ink-3)" /> 요청
          </div>
          <ApprovalGate>
            Claude가 다음에서 <b style={{ color: 'var(--ink)' }}>Cowork</b>하려고 합니다:
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', marginTop: 4 }}>
              C:\Users\rlaeo\Downloads
            </div>
          </ApprovalGate>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 13 }}>
            <div
              className="spin"
              style={{
                width: 14,
                height: 14,
                border: '1.6px solid var(--rust)',
                borderTopColor: 'transparent',
                borderRadius: '50%'
              }}
            />
            작업 중...
          </div>
        </Column>
      </MessageBubble>
    </>
  )
}

function ResultConversation(): React.JSX.Element {
  return (
    <>
      <MessageBubble role="user">md파일로 요약해줘</MessageBubble>
      <MessageBubble role="assistant">
        <Column>
          <ToolBlock title="파일 생성됨" status="done" collapsible opened={false} />
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              color: 'var(--ink)',
              textDecoration: 'underline',
              textDecorationColor: 'var(--ink-4)',
              textUnderlineOffset: 3,
              fontWeight: 600,
              alignSelf: 'flex-start',
              background: 'transparent',
              border: 0,
              padding: 0,
              cursor: 'pointer'
            }}
          >
            downloads_summary.md 열기
          </button>
          <MsgFooter />
        </Column>
      </MessageBubble>
      <MessageBubble role="assistant" busy />
    </>
  )
}

// ─── Right panel ────────────────────────────────────────────────────

function TaskRightPanel(): React.JSX.Element {
  return (
    <SidePanel side="right" surface="bg">
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <CollapsibleSection title="진행 상황">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StepCircle index={i + 1} done={s.done} />
                <span
                  style={{
                    fontSize: 13,
                    color: s.done ? 'var(--ink-3)' : 'var(--ink-2)',
                    textDecoration: s.done ? 'line-through' : 'none',
                    textDecorationColor: 'var(--ink-4)'
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="작업 폴더">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FOLDER_ITEMS.map((f) => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={f.icon} size={16} color="var(--ink-3)" />
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{f.kind}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>·</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{f.label}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="컨텍스트">
          <ContextStack count={3} />
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.55 }}>
            이 작업에 사용된 도구와 참조된 파일을 추적합니다.
          </div>
        </CollapsibleSection>
      </div>
    </SidePanel>
  )
}

function ContextStack({ count }: { count: number }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 56 }}>
      {Array.from({ length: count }, (_, i) => (
        <DocCard key={i} offset={i > 0} plus={i === count - 1} />
      ))}
    </div>
  )
}

function DocCard({ offset, plus }: { offset?: boolean; plus?: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        width: 48,
        height: 56,
        marginLeft: offset ? -8 : 0,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 4,
        boxShadow: '0 1px 2px rgba(0,0,0,.04)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      {plus ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <Icon name="plus" size={16} color="var(--ink-3)" />
        </div>
      ) : (
        <>
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1 }} />
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1, width: '78%' }} />
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1, width: '90%' }} />
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1, width: '60%' }} />
        </>
      )}
    </div>
  )
}

function Column({ children }: { children: ReactNode }): React.JSX.Element {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
}
