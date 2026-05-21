// Orca Skin — Screens (faithful to uploaded Cowork reference)
//
// Exposes:
//   ScreenHome             — empty state (light/dark)
//   ScreenHomeFolderMenu   — empty state with the project-folder dropdown open
//   ScreenTaskRunning      — task in progress, right panel showing progress
//   ScreenTaskResult       — task done; markdown summary visible in chat
//   ScreenTaskArtifact     — task done; artifact preview pane open at the right
//   ScreenApproval         — task waiting for tool-approval (Allow/Deny gate)
//   ModalNewProject        — chooser (start from scratch / import / use existing)
//   ModalNewProjectStart   — "처음부터 시작하기" form
//   ModalNewProjectImport  — "프로젝트 가져오기" form
//   ModalNewProjectFolder  — "기존 폴더 사용" form

// ── Shared content ───────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: 'sun',        label: '이번 주 최적화하기' },
  { icon: 'screenshot', label: '스크린샷 정리하기' },
  { icon: 'insight',    label: '파일에서 인사이트 찾기' },
];

const RECENT_TASKS = [
  { id: 'cs', title: 'Create new project with Paint' },
  { id: 'ns', title: 'New scheduled task' },
];

// ─────────────────────────────────────────────────────────────────────
// Home / Empty state
// ─────────────────────────────────────────────────────────────────────
function ScreenHome({ folderOpen, onOpenFolder, onCreate }) {
  return (
    <main className="dot-grid" style={{
      flex: 1, minWidth: 0, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '52px 40px 32px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Headline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
            <Sparkle size={32}/>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 34,
              letterSpacing: -0.5,
              color: 'var(--ink)',
              margin: 0,
              whiteSpace: 'nowrap',
              wordBreak: 'keep-all',
            }}>
              할 일을 처리해 볼까요?
            </h1>
          </div>
          <div style={{ marginLeft: 46, marginBottom: 32 }}>
            <a href="#" style={{ fontSize: 13.5 }}>Cowork를 안전하게 사용하는 방법 알아보기.</a>
          </div>

          {/* Composer */}
          <div style={{ position: 'relative' }}>
            <Composer
              large rows={2}
              placeholder="오늘 어떤 도움을 드릴까요?"
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 14,
              flexWrap: 'wrap',
            }}>
              <Pill icon="package" label="프로젝트에서 작업" dropdown onClick={onOpenFolder}/>
              <Pill icon="hand" label="질문" dropdown/>
              <span style={{ marginLeft: 'auto' }}/>
              <Pill label="Sonnet 4.6" dropdown ghost/>
            </div>

            {folderOpen && <FolderMenu onCreate={onCreate}/>}
          </div>

          {/* Suggestion list */}
          <div style={{
            marginTop: 60,
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--ink-3)',
            fontSize: 12.5,
          }}>
            <Icon name="shuffle" size={15} color="var(--ink-3)"/>
            <span>작업을 골라보세요, 어떤 것이든</span>
          </div>

          <div style={{ marginTop: 6 }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s.label}
                className="suggest-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  width: '100%', padding: '18px 6px',
                  borderTop: i === 0 ? '1px solid var(--line-soft)' : 'none',
                  borderBottom: '1px solid var(--line-soft)',
                  color: 'var(--ink-2)',
                  fontSize: 14,
                  textAlign: 'left',
                }}
              >
                <Icon name={s.icon} size={20} color="var(--ink-3)"/>
                <span style={{ flex: 1 }}>{s.label}</span>
                <Icon name="chevronR" size={16} color="var(--ink-4)" style={{ opacity: 0 }}/>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 22, fontSize: 12.5, color: 'var(--ink-3)' }}>
            플러그인으로 맞춤 설정
          </div>
        </div>
      </div>

      <ScreensCSS/>
    </main>
  );
}

// Folder dropdown anchored to the "프로젝트에서 작업" pill
function FolderMenu({ onCreate }) {
  return (
    <div style={{
      position: 'absolute', left: 0, top: 'calc(100% + 56px)',
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-md)',
      width: 320,
      padding: 6,
      zIndex: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: 'var(--press)',
        borderRadius: 8,
      }}>
        <Icon name="folder" size={16} color="var(--ink-2)"/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>C:\Users\rlaeo\Downloads</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            C:\Users\rlaeo\Downloads
          </div>
        </div>
        <Icon name="star" size={15} color="var(--ink-4)"/>
      </div>

      <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 0' }}/>

      <button
        onClick={onCreate}
        className="suggest-row"
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', borderRadius: 8,
          color: 'var(--ink-2)',
          fontSize: 13,
        }}
      >
        <Icon name="plus" size={15} color="var(--ink-3)"/>
        <span>새 프로젝트 생성</span>
      </button>
      <button
        className="suggest-row"
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', borderRadius: 8,
          color: 'var(--ink-2)',
          fontSize: 13,
        }}
      >
        <Icon name="folderPlus" size={15} color="var(--ink-3)"/>
        <span>다른 폴더 선택</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────
function ModalShell({ children, width = 520, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(28, 24, 16, 0.32)',
        display: 'grid', placeItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width, maxWidth: '92vw',
          background: 'var(--paper)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
      <ModalCSS/>
    </div>
  );
}

function ModalCSS() {
  React.useEffect(() => {
    if (document.getElementById('m-css')) return;
    const s = document.createElement('style');
    s.id = 'm-css';
    s.textContent = `
      @keyframes mFade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes mPop  { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }
      .row-btn {
        display: flex; align-items: center; gap: 14px;
        width: 100%; padding: 14px 16px;
        background: var(--paper); border: 1px solid var(--line);
        border-radius: var(--r-md);
        text-align: left;
        color: var(--ink);
        transition: background .12s, border-color .12s;
      }
      .row-btn:hover { background: var(--hover); border-color: var(--line-strong); }
      .ghost-btn {
        padding: 7px 16px; border-radius: 8px;
        background: var(--paper); border: 1px solid var(--line);
        color: var(--ink-2); font-weight: 500; font-size: 13;
      }
      .ghost-btn:hover { background: var(--hover); }
      .primary-btn {
        padding: 7px 18px; border-radius: 8px;
        background: var(--ink); color: var(--paper);
        font-weight: 600; font-size: 13;
      }
      .primary-btn:hover { background: var(--ink-2); }
      .primary-btn:disabled, .primary-btn[aria-disabled="true"] {
        background: var(--ink-5); cursor: not-allowed;
      }
      .field-input {
        width: 100%; padding: 9px 12px;
        background: var(--paper); border: 1.5px solid var(--line);
        border-radius: var(--r-md);
        font-size: 13.5; color: var(--ink);
      }
      .field-input:focus { outline: none; border-color: var(--ink-4); }
      .field-input.focused { border-color: var(--rust); }
      .field-textarea { min-height: 86px; resize: vertical; }
      .field-label { font-size: 13; font-weight: 600; color: var(--ink); margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
      .field-label .req { color: var(--rust); }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

function ModalNewProject({ onPick, onClose }) {
  return (
    <ModalShell onClose={onClose} width={460}>
      <div style={{ padding: '20px 24px 24px' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>새 프로젝트 생성</h2>
        <p style={{ margin: '6px 0 18px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          진행 중인 작업을 위한 전용 공간으로, 시간이 지남에 따라 컨텍스트가 쌓입니다. 파일과 지침은 컴퓨터의 폴더에 보관됩니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="row-btn" onClick={() => onPick('start')}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--bg-2)', display: 'grid', placeItems: 'center',
            }}>
              <Icon name="plus" size={18} color="var(--ink-2)"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>처음부터 시작하기</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>지침과 파일이 포함된 새 폴더를 설정합니다.</div>
            </div>
            <Icon name="chevronR" size={16} color="var(--ink-4)"/>
          </button>
          <button className="row-btn" onClick={() => onPick('import')}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--bg-2)', display: 'grid', placeItems: 'center',
            }}>
              <Icon name="folderImp" size={18} color="var(--ink-2)"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>프로젝트 가져오기</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>채팅에서 만든 프로젝트를 Cowork로 가져오세요.</div>
            </div>
            <Icon name="chevronR" size={16} color="var(--ink-4)"/>
          </button>
          <button className="row-btn" onClick={() => onPick('folder')}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--bg-2)', display: 'grid', placeItems: 'center',
            }}>
              <Icon name="folder" size={18} color="var(--ink-2)"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>기존 폴더 사용</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>이미 작업 중인 폴더를 Claude에 제공하세요.</div>
            </div>
            <Icon name="chevronR" size={16} color="var(--ink-4)"/>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalBack({ onBack }) {
  return (
    <button onClick={onBack} style={{ marginBottom: 10, padding: 4, color: 'var(--ink-3)' }}>
      <Icon name="arrowL" size={18}/>
    </button>
  );
}

function MemoryChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11.5, color: 'var(--ink-3)',
    }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.4px solid var(--ink-4)', display: 'inline-grid', placeItems: 'center' }}>
        <span style={{ width: 6, height: 1.4, background: 'var(--ink-4)' }}/>
      </span>
      메모리 꺼짐
    </span>
  );
}

function ModalNewProjectStart({ onBack, onClose, onCreate }) {
  return (
    <ModalShell width={500} onClose={onClose}>
      <div style={{ padding: '18px 24px 22px' }}>
        <ModalBack onBack={onBack}/>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>새 프로젝트 시작하기</h2>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="field-label">이름 <span className="req">*</span></div>
            <input className="field-input focused" placeholder="프로젝트 이름"/>
          </div>
          <div>
            <div className="field-label">지침</div>
            <textarea className="field-input field-textarea" placeholder="이 프로젝트에서 작업하는 방법을 Claude에게 알려주세요(선택 사항)"/>
          </div>
          <div>
            <div className="field-label">파일 추가</div>
            <div style={{
              border: '1.5px dashed var(--line-strong)',
              borderRadius: 'var(--r-md)',
              padding: '14px 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              color: 'var(--ink-3)', fontSize: 12.5,
            }}>
              <Icon name="plus" size={15} color="var(--ink-3)"/>
              파일을 여기에 드롭하거나 클릭하여 찾아보기
            </div>
          </div>
          <div>
            <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>프로젝트 위치 선택</span>
              <Icon name="alert" size={13} color="var(--ink-4)"/>
            </div>
            <button className="field-input" style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left' }}>
              <Icon name="folderImp" size={15} color="var(--ink-3)"/>
              <span style={{ fontSize: 13 }}>C:\Users\rlaeo\OneDrive\문서/Claude/Projects</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center' }}>
          <MemoryChip/>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="ghost-btn" onClick={onClose}>취소</button>
            <button className="primary-btn" aria-disabled="true" onClick={onCreate}>만들기</button>
          </span>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalNewProjectImport({ onBack, onClose }) {
  return (
    <ModalShell width={500} onClose={onClose}>
      <div style={{ padding: '18px 24px 22px' }}>
        <ModalBack onBack={onBack}/>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>프로젝트 가져오기</h2>
        <p style={{ margin: '6px 0 18px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          채팅에서 만든 프로젝트를 Cowork로 가져오세요. Cowork에서의 변경 사항은 채팅의 프로젝트에 영향을 주지 않습니다.
        </p>
        <div>
          <div className="field-label">채팅의 프로젝트</div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} color="var(--ink-4)"
              style={{ position: 'absolute', left: 12, top: 10 }}/>
            <input className="field-input" style={{ paddingLeft: 36 }} placeholder="채팅에서 프로젝트 검색..."/>
          </div>
        </div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center' }}>
          <MemoryChip/>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="ghost-btn" onClick={onClose}>취소</button>
            <button className="primary-btn" aria-disabled="true">만들기</button>
          </span>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalNewProjectFolder({ onBack, onClose }) {
  return (
    <ModalShell width={500} onClose={onClose}>
      <div style={{ padding: '18px 24px 22px' }}>
        <ModalBack onBack={onBack}/>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>기존 폴더 사용</h2>
        <p style={{ margin: '6px 0 18px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          폴더를 선택하면 Claude가 해당 파일을 프로젝트 컨텍스트로 처리합니다. Claude가 작업에 접근하는 방식을 조정하려면 지침을 추가하세요.
        </p>
        <div>
          <div className="field-label">폴더 선택</div>
          <button className="field-input" style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', color: 'var(--ink-4)' }}>
            <Icon name="folderImp" size={15} color="var(--ink-4)"/>
            <span style={{ fontSize: 13 }}>폴더 선택...</span>
          </button>
        </div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center' }}>
          <MemoryChip/>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="ghost-btn" onClick={onClose}>취소</button>
            <button className="primary-btn" aria-disabled="true">만들기</button>
          </span>
        </div>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Task running view
// ─────────────────────────────────────────────────────────────────────

function ChatHeader({ title = 'Check and summarize download folder', onTogglePanel, panelOpen }) {
  return (
    <div style={{
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 8,
      flex: '0 0 auto',
    }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px',
          color: 'var(--ink)', fontSize: 14, fontWeight: 600,
          borderRadius: 6,
        }} className="sb-nav-btn">
          {title}
          <Icon name="chevronD" size={14} color="var(--ink-3)"/>
        </button>
      </div>
      <button className="tb-icon-btn" onClick={onTogglePanel}
        style={{
          width: 32, height: 32, borderRadius: 6,
          display: 'grid', placeItems: 'center',
          background: panelOpen ? 'var(--press)' : 'transparent',
          color: panelOpen ? 'var(--ink)' : 'var(--ink-3)',
        }}>
        <Icon name="rightPane" size={18}/>
      </button>
    </div>
  );
}

function UserMsg({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        maxWidth: '76%',
        padding: '10px 16px',
        background: 'rgba(0,0,0,.045)',
        borderRadius: 14,
        fontSize: 14,
        color: 'var(--ink)',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
      }}>
        {children}
      </div>
    </div>
  );
}

function ClaudeMsg({ children, busy, avatar = true }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {avatar
        ? <Sparkle size={22} style={{ marginTop: 4, flex: '0 0 auto', opacity: busy ? 0.8 : 1, animation: busy ? 'spin 1.4s linear infinite' : 'none' }}/>
        : <div style={{ width: 22 }}/>
      }
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
        {children}
      </div>
    </div>
  );
}

function MsgFooter() {
  return (
    <div style={{ marginLeft: 36, display: 'flex', gap: 4, color: 'var(--ink-4)' }}>
      <button className="tb-icon-btn" style={{ width: 26, height: 26 }}><Icon name="copy" size={14}/></button>
      <button className="tb-icon-btn" style={{ width: 26, height: 26 }}><Icon name="thumbUp" size={14}/></button>
      <button className="tb-icon-btn" style={{ width: 26, height: 26 }}><Icon name="thumbDown" size={14}/></button>
    </div>
  );
}

function ToolBlock({ title, status = 'done', children, collapsible = true, opened = true }) {
  const tones = {
    done:   { dot: 'var(--ink-3)', label: 'done' },
    running:{ dot: 'var(--rust)', label: 'running' },
    pending:{ dot: 'var(--ink-4)', label: 'pending' },
  };
  return (
    <div style={{ marginLeft: 0 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--ink-3)', fontSize: 12.5,
      }}>
        {status === 'running'
          ? <div className="spin" style={{ width: 14, height: 14, border: '1.6px solid var(--rust)', borderTopColor: 'transparent', borderRadius: '50%' }}/>
          : status === 'done'
            ? <Icon name="terminal" size={14} color="var(--ink-3)"/>
            : <Icon name="cog" size={14} color="var(--ink-3)"/>}
        <span>{title}</span>
        {collapsible && <Icon name="chevronD" size={12} color="var(--ink-4)"/>}
      </div>
      {opened && children && (
        <div style={{
          marginTop: 10,
          padding: 16,
          background: 'var(--paper-2)',
          borderRadius: 'var(--r-md)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          overflow: 'auto',
          maxWidth: '100%',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Bash({ children }) {
  return (
    <div style={{
      background: 'var(--paper-2)',
      borderRadius: 'var(--r-md)',
      padding: '12px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--ink-2)',
      lineHeight: 1.7,
    }}>
      <div style={{ color: 'var(--ink-4)', fontSize: 11.5, marginBottom: 6 }}>bash</div>
      <div style={{ color: 'var(--ink)' }}>{children}</div>
    </div>
  );
}

function CompletedTag({ children = '완료' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12.5 }}>
      <Icon name="checkCircle" size={14} color="var(--ink-3)"/>
      {children}
    </div>
  );
}

// Approval prompt card
function ApprovalCard({ path = 'C:\\Users\\rlaeo\\Downloads' }) {
  return (
    <div style={{
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: 14,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon name="folder" size={16} color="var(--ink-3)" style={{ marginTop: 2 }}/>
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Claude가 다음에서 <b style={{ color: 'var(--ink)' }}>Cowork</b>하려고 합니다:
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', marginTop: 4 }}>{path}</div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          거부 <span className="kbd">Esc</span>
        </button>
        <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          허용 <span className="kbd" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>Enter</span>
        </button>
      </div>
    </div>
  );
}

// Bottom composer for task screens
function TaskComposer({ queued, busy }) {
  return (
    <div style={{ padding: '8px 20px 18px', flex: '0 0 auto' }}>
      <Composer
        placeholder="메시지를 입력하세요..."
        leftChips={<Pill icon="hand" label="질문" dropdown ghost/>}
        rightChips={
          <>
            <Pill label="Sonnet 4.6" dropdown ghost/>
            {busy && (
              <button className="cm-btn" title="정지">
                <Icon name="maximize" size={11} color="var(--ink-3)" stroke={1.6}/>
              </button>
            )}
            {queued && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(0,0,0,.05)',
                padding: '4px 9px', borderRadius: 999,
                fontSize: 12, color: 'var(--ink-2)',
              }}>
                <Icon name="arrowDown" size={12} color="var(--ink-3)"/>
                대기열
              </span>
            )}
          </>
        }
      />
      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--ink-4)' }}>
        Claude는 AI이며 실수할 수 있습니다. 응답을 다시 한번 확인해 주세요.
      </div>
    </div>
  );
}

// Right side panel — progress / working folder / context
function RightPanel({ steps = [], folderItems, contextItems = [] }) {
  return (
    <aside style={{
      width: 'var(--right-pane-w)', flex: '0 0 auto',
      background: 'var(--bg)',
      borderLeft: '1px solid transparent',
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
    }}>
      <div className="scroll" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 22, flex: 1, minHeight: 0 }}>
        <PanelSection title="진행 상황">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {s.done ? (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--info)', color: '#fff',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Icon name="check" size={13} color="#fff" stroke={2.2}/>
                  </div>
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: '1.5px solid var(--ink-4)',
                    color: 'var(--ink-3)', fontSize: 11, fontWeight: 600,
                    display: 'grid', placeItems: 'center',
                  }}>{i + 1}</div>
                )}
                <span style={{
                  fontSize: 13, color: s.done ? 'var(--ink-3)' : 'var(--ink-2)',
                  textDecoration: s.done ? 'line-through' : 'none',
                  textDecorationColor: 'var(--ink-4)',
                }}>{s.label}</span>
              </div>
            ))}
          </div>
        </PanelSection>

        {folderItems && (
          <PanelSection title="작업 폴더" expandable>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {folderItems.map((f) => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={f.icon} size={16} color="var(--ink-3)"/>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{f.kind}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>·</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink) ' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </PanelSection>
        )}

        <PanelSection title="컨텍스트" expandable>
          <ContextStack count={contextItems.length || 3}/>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.55 }}>
            이 작업에 사용된 도구와 참조된 파일을 추적합니다.
          </div>
        </PanelSection>
      </div>
    </aside>
  );
}

function PanelSection({ title, children, expandable }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
        <button className="tb-icon-btn" style={{ width: 24, height: 24, marginLeft: 'auto' }}>
          <Icon name="chevronD" size={14} color="var(--ink-3)"/>
        </button>
      </div>
      {children}
    </section>
  );
}

function ContextStack({ count = 3 }) {
  // 3 small overlapping doc cards illustration
  return (
    <div style={{ display: 'flex', gap: -10, alignItems: 'center', height: 56 }}>
      <DocCard/>
      <DocCard offset/>
      <DocCard offset plus/>
    </div>
  );
}

function DocCard({ offset, plus }) {
  return (
    <div style={{
      width: 48, height: 56,
      marginLeft: offset ? -8 : 0,
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      borderRadius: 4,
      boxShadow: '0 1px 2px rgba(0,0,0,.04)',
      padding: 6,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {plus ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <Icon name="plus" size={16} color="var(--ink-3)"/>
        </div>
      ) : (
        <>
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1 }}/>
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1, width: '78%' }}/>
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1, width: '90%' }}/>
          <div style={{ height: 2, background: 'var(--line-strong)', borderRadius: 1, width: '60%' }}/>
        </>
      )}
    </div>
  );
}

// Working folder mini chart (used at later steps)
function FolderChartCard({ files = 189, size = '52GB' }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 'var(--r-md)',
      background: 'var(--paper)', border: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="6" y="20" width="5" height="12" fill="var(--line-strong)"/>
        <rect x="14" y="14" width="5" height="18" fill="var(--ink-4)"/>
        <rect x="22" y="8" width="5" height="24" fill="var(--ink-2)"/>
      </svg>
      <div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>이 작업 중에 생성된 파일을</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>확인하고 열 수 있습니다.</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Task running screen (and result)
// ─────────────────────────────────────────────────────────────────────

const TASK_TITLE = 'Check and summarize download folder';

function ScreenTaskRunning({ panelOpen, onTogglePanel }) {
  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ChatHeader title={TASK_TITLE} panelOpen={panelOpen} onTogglePanel={onTogglePanel}/>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <UserMsg>
            {`1. 30초 대기 후 다운로드 폴더로 이동하라
2. 다운로드 파일이 있는지 점검하라
3. 있는 경우 30초 기다리고
4. 없는 경우 다운로드 폴더의 파일을 요약하라`}
          </UserMsg>

          <ClaudeMsg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ToolBlock title="도구 4개 사용함, 로드된 도구" status="done" collapsible/>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>30초 대기 시작합니다...</p>
              <ToolBlock title="명령 실행함" status="done">
                <Bash>
                  <span style={{ color: '#5a8a4f' }}>sleep</span> 30 && <span style={{ color: '#5a8a4f' }}>echo</span>{' '}
                  <span style={{ color: 'var(--rust)' }}>"대기 완료"</span>
                </Bash>
              </ToolBlock>
              <CompletedTag/>
              <MsgFooter/>
            </div>
          </ClaudeMsg>

          <ClaudeMsg busy>
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
              <span className="pulse">작업 중...</span>
            </div>
          </ClaudeMsg>
        </div>
      </div>
      <TaskComposer busy/>
    </main>
  );
}

// Task result — markdown summary with final tool/file produced.
function ScreenTaskResult({ panelOpen, onTogglePanel, onOpenArtifact }) {
  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ChatHeader title={TASK_TITLE} panelOpen={panelOpen} onTogglePanel={onTogglePanel}/>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <UserMsg>md파일로 요약해줘</UserMsg>

          <ClaudeMsg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToolBlock title="파일 생성됨" status="done" collapsible opened={false}/>
              <button onClick={onOpenArtifact} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 14, color: 'var(--ink)',
                textDecoration: 'underline', textDecorationColor: 'var(--ink-4)', textUnderlineOffset: 3,
                fontWeight: 600,
                alignSelf: 'flex-start',
              }}>
                downloads_summary.md 열기
              </button>
              <MsgFooter/>
            </div>
          </ClaudeMsg>

          <ClaudeMsg busy avatar/>
        </div>
      </div>
      <TaskComposer/>
    </main>
  );
}

// Approval gate screen
function ScreenApproval({ panelOpen, onTogglePanel }) {
  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ChatHeader title={TASK_TITLE} panelOpen={panelOpen} onTogglePanel={onTogglePanel}/>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <UserMsg>이어서 진행</UserMsg>
          <ClaudeMsg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToolBlock title="사고 과정" status="done" collapsible opened={false}/>
              <p style={{ margin: 0, fontSize: 14 }}>
                30초는 이미 경과했으니 Task 1을 완료 처리하고, 다운로드 폴더 접근으로 이어갑니다.
              </p>
              <ToolBlock title="도구 2개 사용함" status="done" collapsible opened={false}/>
              <p style={{ margin: 0, fontSize: 14 }}>
                다운로드 폴더에 접근 권한을 요청합니다.
              </p>
              <ToolBlock title="작업 중" status="running" collapsible opened={false}/>
              <ToolBlock title="Request cowork directory" status="done" collapsible opened={false}/>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-3)' }}>
                <Icon name="tool" size={13} color="var(--ink-3)"/> 요청
              </div>
              <ApprovalCard/>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 13 }}>
                <div className="spin" style={{ width: 14, height: 14, border: '1.6px solid var(--rust)', borderTopColor: 'transparent', borderRadius: '50%' }}/>
                작업 중...
              </div>
            </div>
          </ClaudeMsg>
        </div>
      </div>
      <TaskComposer busy queued/>
    </main>
  );
}

// Artifact preview side panel (markdown)
function ArtifactPanel({ onClose }) {
  return (
    <aside style={{
      width: 'var(--artifact-w)', flex: '0 0 auto',
      background: 'var(--paper)',
      borderLeft: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--line)',
        flex: '0 0 auto',
      }}>
        <div style={{ display: 'inline-flex', padding: 2, background: 'rgba(0,0,0,.04)', borderRadius: 999 }}>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 9px', borderRadius: 999,
            background: 'var(--paper)', boxShadow: '0 1px 2px rgba(0,0,0,.06)',
          }}>
            <Icon name="eye" size={14}/>
          </button>
          <button style={{ padding: '4px 9px', borderRadius: 999, color: 'var(--ink-3)' }}>
            <Icon name="codeSlash" size={14}/>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Downloads summary</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· MD</span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="tb-icon-btn" style={{ width: 28, height: 28 }}><Icon name="share" size={15} color="var(--ink-3)"/></button>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--bg-2)', color: 'var(--ink-2)',
            fontSize: 12, fontWeight: 500,
          }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#ffba00', display: 'inline-grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>G</span>
            Google Drive
            <Icon name="chevronD" size={11} color="var(--ink-3)"/>
          </button>
          <button className="tb-icon-btn" style={{ width: 28, height: 28 }}><Icon name="refresh" size={15} color="var(--ink-3)"/></button>
          <button className="tb-icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><Icon name="close" size={15} color="var(--ink-3)"/></button>
        </span>
      </div>

      {/* MD body */}
      <div className="scroll" style={{
        flex: 1, minHeight: 0, padding: '24px 28px 60px',
        fontFamily: 'var(--font-serif)',
        color: 'var(--ink)',
        fontSize: 14, lineHeight: 1.65,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 14px', letterSpacing: -0.2 }}>다운로드 폴더 요약</h1>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.9 }}>
          <div><b>경로:</b> <code style={{ background: 'rgba(0,0,0,.04)', padding: '1px 6px', borderRadius: 4, color: 'var(--rust-ink)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>C:\Users\rlaeo\Downloads</code></div>
          <div><b>전체 파일 수:</b> 189개</div>
          <div><b>총 용량:</b> 약 52GB</div>
          <div><b>기준일:</b> 2026-05-17</div>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '22px 0' }}/>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px' }}>유형별 현황</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 64px 1fr',
          rowGap: 16, columnGap: 12,
          fontFamily: 'var(--font-sans)', fontSize: 13,
          alignItems: 'center',
        }}>
          <div style={{ color: 'var(--ink), bottom)', fontWeight: 700 }}>분류</div>
          <div style={{ fontWeight: 700 }}>파일 수</div>
          <div style={{ fontWeight: 700 }}>주요 내용</div>

          {[
            ['📦', '압축파일', '53개', 'Android 펌웨어(yukawa, hikey960, vim3l), Amlogic·HUAWEI 드라이버, Node.js 강의, dify/langflow 등'],
            ['🖼️', '이미지', '36개', '카카오톡 수신 이미지, 웨딩 관련 사진, 케이크·도안 등'],
            ['✳️', '실행파일', '34개', 'Claude Setup, VSCode, Git, Postman, PCManager, Python, Bandizip 등 설치파일 다수'],
            ['📄', 'PDF', '17개', '웨딩 관련 문서, 청구서·계약서·신청서, 카페 관련 문서 등'],
            ['📑', '문서', '17개', 'xlsx(재무제표·가계부·투자 시뮬레이션), pptx(도안·라벨지), hwp, docx 등'],
            ['🛠', '개발/스크립트', '15개', 'Python 스크립트(hisi-idt), 쉘 스크립트, .deb 패키지, firmware 바이너리 등'],
          ].map((r, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15 }}>{r[0]}</span><span>{r[1]}</span>
              </div>
              <div style={{ color: 'var(--ink-2)' }}>{r[2]}</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.6 }}>{r[3]}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ── shared CSS (scoped helpers used by ScreenHome)
function ScreensCSS() {
  React.useEffect(() => {
    if (document.getElementById('scr-css')) return;
    const s = document.createElement('style');
    s.id = 'scr-css';
    s.textContent = `
      .suggest-row { background: transparent; transition: background .12s; }
      .suggest-row:hover { background: var(--hover); }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

Object.assign(window, {
  ScreenHome,
  ModalNewProject, ModalNewProjectStart, ModalNewProjectImport, ModalNewProjectFolder,
  ScreenTaskRunning, ScreenTaskResult, ScreenApproval,
  RightPanel, ArtifactPanel, FolderChartCard,
});
