import { Fragment } from 'react'
import { Icon } from '../primitives/Icon'

export interface ArtifactPanelProps {
  onClose?: () => void
}

interface TypeRow {
  emoji: string
  category: string
  count: string
  detail: string
}

const TYPE_ROWS: TypeRow[] = [
  { emoji: '📦', category: '압축파일', count: '53개', detail: 'Android 펌웨어(yukawa, hikey960, vim3l), Amlogic·HUAWEI 드라이버, Node.js 강의, dify/langflow 등' },
  { emoji: '🖼️', category: '이미지', count: '36개', detail: '카카오톡 수신 이미지, 웨딩 관련 사진, 케이크·도안 등' },
  { emoji: '✳️', category: '실행파일', count: '34개', detail: 'Claude Setup, VSCode, Git, Postman, PCManager, Python, Bandizip 등 설치파일 다수' },
  { emoji: '📄', category: 'PDF', count: '17개', detail: '웨딩 관련 문서, 청구서·계약서·신청서, 카페 관련 문서 등' },
  { emoji: '📑', category: '문서', count: '17개', detail: 'xlsx(재무제표·가계부·투자 시뮬레이션), pptx(도안·라벨지), hwp, docx 등' },
  { emoji: '🛠', category: '개발/스크립트', count: '15개', detail: 'Python 스크립트(hisi-idt), 쉘 스크립트, .deb 패키지, firmware 바이너리 등' }
]

/** ArtifactPanel — 620px right pane that opens over a chat to preview a
 *  generated artifact (Markdown). Toolbar: preview/code segmented control,
 *  title pill, share / export-target / refresh / close. Body: serif-typeset
 *  Markdown with a `유형별 현황` table grid. */
export function ArtifactPanel({ onClose }: ArtifactPanelProps): React.JSX.Element {
  return (
    <aside
      style={{
        width: 'var(--artifact-w)',
        flex: '0 0 auto',
        background: 'var(--paper)',
        borderLeft: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--line)',
          flex: '0 0 auto'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            padding: 2,
            background: 'rgba(0,0,0,.04)',
            borderRadius: 999
          }}
        >
          <button
            type="button"
            className="tb-icon-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 999,
              background: 'var(--paper)',
              boxShadow: '0 1px 2px rgba(0,0,0,.06)',
              border: 0,
              cursor: 'pointer'
            }}
          >
            <Icon name="eye" size={14} />
          </button>
          <button
            type="button"
            className="tb-icon-btn"
            style={{
              padding: '4px 9px',
              borderRadius: 999,
              color: 'var(--ink-3)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer'
            }}
          >
            <Icon name="codeSlash" size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Downloads summary</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· MD</span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="tb-icon-btn" style={{ width: 28, height: 28 }}>
            <Icon name="share" size={15} color="var(--ink-3)" />
          </button>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--bg-2)',
              color: 'var(--ink-2)',
              fontSize: 12,
              fontWeight: 500,
              border: 0,
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: '#ffba00',
                display: 'inline-grid',
                placeItems: 'center',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800
              }}
            >
              G
            </span>
            Google Drive
            <Icon name="chevronD" size={11} color="var(--ink-3)" />
          </button>
          <button type="button" className="tb-icon-btn" style={{ width: 28, height: 28 }}>
            <Icon name="refresh" size={15} color="var(--ink-3)" />
          </button>
          <button type="button" className="tb-icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}>
            <Icon name="close" size={15} color="var(--ink-3)" />
          </button>
        </span>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          minHeight: 0,
          padding: '24px 28px 60px',
          fontFamily: 'var(--font-serif)',
          color: 'var(--ink)',
          fontSize: 14,
          lineHeight: 1.65
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 14px', letterSpacing: -0.2 }}>
          다운로드 폴더 요약
        </h1>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.9 }}>
          <div>
            <b>경로:</b>{' '}
            <code
              style={{
                background: 'rgba(0,0,0,.04)',
                padding: '1px 6px',
                borderRadius: 4,
                color: 'var(--rust-ink)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5
              }}
            >
              C:\Users\rlaeo\Downloads
            </code>
          </div>
          <div>
            <b>전체 파일 수:</b> 189개
          </div>
          <div>
            <b>총 용량:</b> 약 52GB
          </div>
          <div>
            <b>기준일:</b> 2026-05-17
          </div>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '22px 0' }} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px' }}>유형별 현황</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '90px 64px 1fr',
            rowGap: 16,
            columnGap: 12,
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            alignItems: 'center'
          }}
        >
          <div style={{ fontWeight: 700 }}>분류</div>
          <div style={{ fontWeight: 700 }}>파일 수</div>
          <div style={{ fontWeight: 700 }}>주요 내용</div>

          {TYPE_ROWS.map((r) => (
            <Fragment key={r.category}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15 }}>{r.emoji}</span>
                <span>{r.category}</span>
              </div>
              <div style={{ color: 'var(--ink-2)' }}>{r.count}</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.6 }}>{r.detail}</div>
            </Fragment>
          ))}
        </div>
      </div>
    </aside>
  )
}
