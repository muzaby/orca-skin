import { Icon, type IconName } from '../../components/primitives/Icon'
import { ModalShell, ModalBack, MemoryChip } from '../../components/shell/Modal'

export type ModalVariant = 'root' | 'start' | 'import' | 'folder'

export interface NewProjectModalsProps {
  variant: ModalVariant
  onPick?: (v: ModalVariant) => void
  onClose?: () => void
  onCreate?: () => void
}

/** v5 new-project modal stack (DESIGN.md §5 #04-07).
 *  One stateful host renders the active variant; the user toggles between
 *  root chooser → one of three sub-modals via `onPick`. */
export function NewProjectModals({ variant, onPick, onClose, onCreate }: NewProjectModalsProps): React.JSX.Element {
  if (variant === 'root') return <ModalNewProject onPick={onPick} onClose={onClose} />
  if (variant === 'start') return <ModalNewProjectStart onBack={() => onPick?.('root')} onClose={onClose} onCreate={onCreate} />
  if (variant === 'import') return <ModalNewProjectImport onBack={() => onPick?.('root')} onClose={onClose} />
  return <ModalNewProjectFolder onBack={() => onPick?.('root')} onClose={onClose} />
}

interface RowOpt {
  id: ModalVariant
  icon: IconName
  title: string
  desc: string
}

const ROOT_ROWS: RowOpt[] = [
  { id: 'start', icon: 'plus', title: '처음부터 시작하기', desc: '지침과 파일이 포함된 새 폴더를 설정합니다.' },
  { id: 'import', icon: 'folderImp', title: '프로젝트 가져오기', desc: '채팅에서 만든 프로젝트를 Cowork로 가져오세요.' },
  { id: 'folder', icon: 'folder', title: '기존 폴더 사용', desc: '이미 작업 중인 폴더를 Claude에 제공하세요.' }
]

function ModalNewProject({
  onPick,
  onClose
}: {
  onPick?: (v: ModalVariant) => void
  onClose?: () => void
}): React.JSX.Element {
  return (
    <ModalShell onClose={onClose} width={460}>
      <div style={{ padding: '20px 24px 24px' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>새 프로젝트 생성</h2>
        <p style={{ margin: '6px 0 18px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          진행 중인 작업을 위한 전용 공간으로, 시간이 지남에 따라 컨텍스트가 쌓입니다. 파일과 지침은 컴퓨터의 폴더에 보관됩니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROOT_ROWS.map((r) => (
            <button key={r.id} type="button" className="row-btn" onClick={() => onPick?.(r.id)}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--bg-2)',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Icon name={r.icon} size={18} color="var(--ink-2)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{r.desc}</div>
              </div>
              <Icon name="chevronR" size={16} color="var(--ink-4)" />
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

function ModalNewProjectStart({
  onBack,
  onClose,
  onCreate
}: {
  onBack?: () => void
  onClose?: () => void
  onCreate?: () => void
}): React.JSX.Element {
  return (
    <ModalShell width={500} onClose={onClose}>
      <div style={{ padding: '18px 24px 22px' }}>
        <ModalBack onBack={onBack} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>새 프로젝트 시작하기</h2>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="field-label">
              이름 <span className="req">*</span>
            </div>
            <input className="field-input focused" placeholder="프로젝트 이름" />
          </div>
          <div>
            <div className="field-label">지침</div>
            <textarea
              className="field-input field-textarea"
              placeholder="이 프로젝트에서 작업하는 방법을 Claude에게 알려주세요(선택 사항)"
            />
          </div>
          <div>
            <div className="field-label">파일 추가</div>
            <div
              style={{
                border: '1.5px dashed var(--line-strong)',
                borderRadius: 'var(--r-md)',
                padding: '14px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: 'var(--ink-3)',
                fontSize: 12.5
              }}
            >
              <Icon name="plus" size={15} color="var(--ink-3)" />
              파일을 여기에 드롭하거나 클릭하여 찾아보기
            </div>
          </div>
          <div>
            <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>프로젝트 위치 선택</span>
              <Icon name="alert" size={13} color="var(--ink-4)" />
            </div>
            <button
              type="button"
              className="field-input"
              style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left' }}
            >
              <Icon name="folderImp" size={15} color="var(--ink-3)" />
              <span style={{ fontSize: 13 }}>C:\Users\rlaeo\OneDrive\문서\Claude\Projects</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center' }}>
          <MemoryChip />
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="ghost-btn" onClick={onClose}>
              취소
            </button>
            <button type="button" className="primary-btn" aria-disabled="true" onClick={onCreate}>
              만들기
            </button>
          </span>
        </div>
      </div>
    </ModalShell>
  )
}

function ModalNewProjectImport({
  onBack,
  onClose
}: {
  onBack?: () => void
  onClose?: () => void
}): React.JSX.Element {
  return (
    <ModalShell width={500} onClose={onClose}>
      <div style={{ padding: '18px 24px 22px' }}>
        <ModalBack onBack={onBack} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>프로젝트 가져오기</h2>
        <p style={{ margin: '6px 0 18px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          채팅에서 만든 프로젝트를 Cowork로 가져오세요. Cowork에서의 변경 사항은 채팅의 프로젝트에 영향을 주지 않습니다.
        </p>
        <div>
          <div className="field-label">채팅의 프로젝트</div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} color="var(--ink-4)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input className="field-input" style={{ paddingLeft: 36 }} placeholder="채팅에서 프로젝트 검색..." />
          </div>
        </div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center' }}>
          <MemoryChip />
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="ghost-btn" onClick={onClose}>
              취소
            </button>
            <button type="button" className="primary-btn" aria-disabled="true">
              만들기
            </button>
          </span>
        </div>
      </div>
    </ModalShell>
  )
}

function ModalNewProjectFolder({
  onBack,
  onClose
}: {
  onBack?: () => void
  onClose?: () => void
}): React.JSX.Element {
  return (
    <ModalShell width={500} onClose={onClose}>
      <div style={{ padding: '18px 24px 22px' }}>
        <ModalBack onBack={onBack} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>기존 폴더 사용</h2>
        <p style={{ margin: '6px 0 18px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          폴더를 선택하면 Claude가 해당 파일을 프로젝트 컨텍스트로 처리합니다. Claude가 작업에 접근하는 방식을 조정하려면 지침을 추가하세요.
        </p>
        <div>
          <div className="field-label">폴더 선택</div>
          <button
            type="button"
            className="field-input"
            style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', color: 'var(--ink-4)' }}
          >
            <Icon name="folderImp" size={15} color="var(--ink-4)" />
            <span style={{ fontSize: 13 }}>폴더 선택...</span>
          </button>
        </div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center' }}>
          <MemoryChip />
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="ghost-btn" onClick={onClose}>
              취소
            </button>
            <button type="button" className="primary-btn" aria-disabled="true">
              만들기
            </button>
          </span>
        </div>
      </div>
    </ModalShell>
  )
}
