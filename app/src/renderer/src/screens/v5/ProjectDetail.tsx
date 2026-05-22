import { Icon } from '../../components/primitives/Icon'
import { Pill } from '../../components/primitives/Pill'
import { SidePanel } from '../../components/shell/SidePanel'
import { CollapsibleSection } from '../../components/primitives/CollapsibleSection'
import { MemoryChip } from '../../components/shell/Modal'
import type { Project } from '../../../../shared/ipc'

/** v5 Project landing (DESIGN.md §5 — 추가 화면, jsx 원본 없음).
 *  Visual basis: project/uploads/main 시리즈 2번 스크린샷.
 *  헤더 (타이틀 + 종 + 케밥) + composer placeholder + pill row +
 *  중앙 hint 블록 + 우측 320 패널 (지침 / 예정됨 / 컨텍스트). */
export interface ProjectDetailProps {
  project: Project
  onBack?: () => void
  /** composer 영역 클릭 시 호출 — v5-task 로 transition. */
  onStartChat?: () => void
}

export function ProjectDetail({ project, onStartChat }: ProjectDetailProps): React.JSX.Element {
  return (
    <>
      <main
        className="dot-grid"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'var(--bg)'
        }}
      >
        <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '52px 40px 32px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 30,
                  letterSpacing: -0.5,
                  color: 'var(--ink)',
                  margin: 0
                }}
              >
                {project.name}
              </h1>
              <span style={{ marginLeft: 'auto' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" className="tb-icon-btn" aria-label="알림">
                  <Icon name="alert" size={16} color="var(--ink-3)" />
                </button>
                <button type="button" className="tb-icon-btn" aria-label="더보기">
                  <Icon name="chevronD" size={16} color="var(--ink-3)" />
                </button>
              </div>
            </div>

            {/* Composer card — entire area clickable */}
            <button
              type="button"
              onClick={onStartChat}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'var(--paper)',
                borderRadius: 'var(--r-xl)',
                boxShadow: '0 1px 0 rgba(0,0,0,.02), 0 1px 2px rgba(0,0,0,.04)',
                border: '1px solid var(--line)',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <div
                style={{
                  padding: '18px 22px 0',
                  color: 'var(--ink-4)',
                  fontSize: 15,
                  minHeight: 2 * 26 + 16,
                  lineHeight: 1.5
                }}
              >
                이 프로젝트에서 무엇을 작업하시겠습니까?
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
                <span className="cm-btn" aria-label="첨부">
                  <Icon name="plus" size={18} color="var(--ink-3)" />
                </span>
                <span style={{ marginLeft: 'auto' }} />
                <span className="cm-btn" aria-label="음성">
                  <Icon name="mic" size={17} color="var(--ink-3)" />
                </span>
              </div>
            </button>

            {/* Pill row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Pill icon="package" label={project.name} dropdown />
              <Pill icon="hand" label="질문" dropdown />
              <span style={{ marginLeft: 'auto' }} />
              <Pill label="Sonnet 4.6" dropdown surface="ghost" />
            </div>

            {/* Centered hint */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                marginTop: 12
              }}
            >
              <Icon name="chat" size={28} color="var(--ink-4)" />
              <p
                style={{
                  margin: 0,
                  maxWidth: 420,
                  textAlign: 'center',
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: 'var(--ink-3)'
                }}
              >
                Claude에게 작업을 맡기면 프로젝트 컨텍스트를 자동으로 파악합니다.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Right 320 panel */}
      <SidePanel side="right" surface="bg-2" width={320}>
        <div style={{ padding: '14px 6px' }}>
          <CollapsibleSection
            title="지침"
            trailing={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Icon name="pencil" size={14} color="var(--ink-3)" />
              </span>
            }
          >
            <p
              style={{
                margin: 0,
                padding: '4px 12px 8px',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--ink-3)'
              }}
            >
              <strong style={{ fontWeight: 600 }}>Claude</strong>의 작업 방식을 안내할 어조, 서식 또는 규칙을 추가하세요.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            title="예정됨"
            trailing={<Icon name="plus" size={14} color="var(--ink-3)" />}
          >
            <p style={{ margin: 0, padding: '4px 12px 8px', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              이 프로젝트의 반복 작업을 설정하세요.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            title="컨텍스트"
            trailing={<Icon name="plus" size={14} color="var(--ink-3)" />}
          >
            <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontWeight: 500 }}>컴퓨터에서</div>
              <button
                type="button"
                className="suggest-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid var(--line-soft)',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                <Icon name="chevronR" size={12} color="var(--ink-4)" />
                <Icon name="folder" size={14} color="var(--ink-3)" />
                <span>{project.name}</span>
              </button>

              <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontWeight: 500, marginTop: 4 }}>메모리</div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--ink-3)' }}>
                설정에서 메모리가 꺼져 있습니다. 기존 메모리 파일은 유지되지만 새 세션에서 읽거나 쓰이지 않습니다.
              </p>
              <div style={{ marginTop: 4 }}>
                <MemoryChip />
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </SidePanel>
    </>
  )
}
