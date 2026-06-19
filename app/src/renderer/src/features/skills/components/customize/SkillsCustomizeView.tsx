import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CustomizeRail, type CustomizeTab } from './CustomizeRail'
import { CustomizeList } from './CustomizeList'
import { CustomizeLanding } from './CustomizeLanding'
import { SkillDetail } from './SkillDetail'
import { McpDetail } from './McpDetail'
import { SkillAddMenu } from './SkillAddMenu'
import { SkillAuthorModal } from './SkillAuthorModal'
import { SkillUploadModal } from './SkillUploadModal'
import { CustomMcpModal } from './CustomMcpModal'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'

function skillKey(sourceId: string, name: string): string {
  return `${sourceId}/${name}`
}

export function SkillsCustomizeView(): React.JSX.Element {
  const [tab, setTab] = useState<CustomizeTab | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navigate = useNavigate()
  const skills = useCustomizeSkills()
  const mcp = useMcpServers()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)

  const selectTab = (t: CustomizeTab): void => {
    setTab(t)
    const first =
      t === 'skills'
        ? skills.list[0] && skillKey(skills.list[0].sourceId, skills.list[0].name)
        : mcp.list[0]?.id
    setSelectedId(first ?? null)
  }

  const effectiveSelectedId =
    tab === 'skills'
      ? skills.list.some((skill) => skillKey(skill.sourceId, skill.name) === selectedId)
        ? selectedId
        : skills.list[0]
          ? skillKey(skills.list[0].sourceId, skills.list[0].name)
          : null
      : tab === 'mcp'
        ? mcp.list.some((server) => server.id === selectedId)
          ? selectedId
          : (mcp.list[0]?.id ?? null)
        : selectedId

  const selectedSkill = skills.list.find(
    (s) => skillKey(s.sourceId, s.name) === effectiveSelectedId
  )
  const selectedMcp = mcp.list.find((s) => s.id === effectiveSelectedId)

  return (
    <section className="flex h-full min-h-0 w-full" data-context="customize">
      <CustomizeRail tab={tab} onSelect={selectTab} />
      {tab === null ? (
        <CustomizeLanding
          onConnect={() => selectTab('mcp')}
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
            skills={skills.list}
            mcpServers={mcp.list}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
            addRef={addRef}
            onAdd={() => {
              if (tab === 'skills') setMenuOpen((v) => !v)
              else setMcpModalOpen(true)
            }}
          />
          {tab === 'skills' && selectedSkill ? (
            <SkillDetail
              skill={selectedSkill}
              onToggle={() => {
                if (!selectedSkill.canToggle) return
                void skills.setEnabled({
                  name: selectedSkill.name,
                  sourceId: selectedSkill.sourceId,
                  enabled: !selectedSkill.enabled
                })
              }}
              onTryInChat={() => {
                void navigator.clipboard?.writeText(`/${selectedSkill.name} `)
                navigate('/new')
              }}
              onOpenDefault={() =>
                void skills.open({ name: selectedSkill.name, sourceId: selectedSkill.sourceId })
              }
              onShowInFolder={() =>
                void skills.showInFolder({
                  name: selectedSkill.name,
                  sourceId: selectedSkill.sourceId
                })
              }
              onRemove={() =>
                skills.remove({ name: selectedSkill.name, sourceId: selectedSkill.sourceId })
              }
            />
          ) : tab === 'mcp' && selectedMcp ? (
            <McpDetail
              server={selectedMcp}
              onToggle={() => void mcp.toggle(selectedMcp.id, !selectedMcp.enabled)}
            />
          ) : (
            <div className="grid flex-1 place-items-center text-[13px] text-ink3">
              {skills.loading || mcp.loading ? '불러오는 중…' : '항목을 선택하세요.'}
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
        onCreate={skills.author}
      />
      <SkillUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={skills.upload}
      />
      <CustomMcpModal open={mcpModalOpen} onClose={() => setMcpModalOpen(false)} onAdd={mcp.add} />
    </section>
  )
}
