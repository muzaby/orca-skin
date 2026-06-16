import { useRef, useState } from 'react'
import { CustomizeRail, type CustomizeTab } from './CustomizeRail'
import { CustomizeList } from './CustomizeList'
import { CustomizeLanding } from './CustomizeLanding'
import { SkillDetail } from './SkillDetail'
import { ConnectorDetail } from './ConnectorDetail'
import { SkillAddMenu } from './SkillAddMenu'
import { SkillAuthorModal } from './SkillAuthorModal'
import { SkillUploadModal } from './SkillUploadModal'
import { CustomConnectorModal } from './CustomConnectorModal'
import { SEED_SKILLS, SEED_CONNECTORS, type ConnectorItem, type SkillItem } from './data'

// 맞춤설정(Skills & MCP) 3-pane 오케스트레이터. 정적 스킨 — 목록은 시드 상수로 초기화한
// 로컬 state 이고 추가 플로우는 메모리상 append(비영속). 첫 진입(tab===null)은 목록 없이
// 랜딩만, 탭 진입 시 레일 + 목록 + 상세 3-pane.
export function SkillsCustomizeView(): React.JSX.Element {
  const [tab, setTab] = useState<CustomizeTab | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [skills, setSkills] = useState<SkillItem[]>(SEED_SKILLS)
  const [connectors, setConnectors] = useState<ConnectorItem[]>(SEED_CONNECTORS)

  const [menuOpen, setMenuOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [connectorModalOpen, setConnectorModalOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)

  const selectTab = (t: CustomizeTab): void => {
    setTab(t)
    const first = t === 'skills' ? skills[0]?.id : connectors[0]?.id
    setSelectedId(first ?? null)
  }

  const onAdd = (): void => {
    if (tab === 'skills') setMenuOpen((v) => !v)
    else setConnectorModalOpen(true)
  }

  const toggleSkill = (id: string): void =>
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))

  const addSkill = (s: SkillItem): void => {
    setSkills((prev) => [s, ...prev])
    setTab('skills')
    setSelectedId(s.id)
  }

  const addConnector = (c: ConnectorItem): void => {
    setConnectors((prev) => [...prev, c])
    setTab('connectors')
    setSelectedId(c.id)
  }

  const toggleConnection = (id: string): void =>
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, group: c.group === 'disconnected' ? 'local' : 'disconnected' } : c
      )
    )

  const selectedSkill = skills.find((s) => s.id === selectedId)
  const selectedConnector = connectors.find((c) => c.id === selectedId)

  return (
    <section className="flex h-full min-h-0 w-full" data-context="customize">
      <CustomizeRail tab={tab} onSelect={selectTab} />

      {tab === null ? (
        <CustomizeLanding
          onConnect={() => selectTab('connectors')}
          onCreateSkill={() => {
            selectTab('skills')
            setAuthorOpen(true)
          }}
          onBrowsePlugins={() => selectTab('skills')}
        />
      ) : (
        <>
          <CustomizeList
            tab={tab}
            skills={skills}
            connectors={connectors}
            selectedId={selectedId}
            onSelect={setSelectedId}
            addRef={addRef}
            onAdd={onAdd}
          />
          {tab === 'skills' && selectedSkill ? (
            <SkillDetail skill={selectedSkill} onToggle={() => toggleSkill(selectedSkill.id)} />
          ) : tab === 'connectors' && selectedConnector ? (
            <ConnectorDetail
              connector={selectedConnector}
              onToggleConnection={() => toggleConnection(selectedConnector.id)}
            />
          ) : (
            <div className="grid flex-1 place-items-center text-[13px] text-ink3">
              항목을 선택하세요.
            </div>
          )}
        </>
      )}

      <SkillAddMenu
        open={menuOpen}
        anchorRef={addRef}
        onClose={() => setMenuOpen(false)}
        onAuthor={() => setAuthorOpen(true)}
        onUpload={() => setUploadOpen(true)}
      />
      <SkillAuthorModal
        open={authorOpen}
        onClose={() => setAuthorOpen(false)}
        onCreate={addSkill}
      />
      <SkillUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={addSkill}
      />
      <CustomConnectorModal
        open={connectorModalOpen}
        onClose={() => setConnectorModalOpen(false)}
        onAdd={addConnector}
      />
    </section>
  )
}
