import { useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    if (
      tab === 'skills' &&
      selectedId &&
      !skills.list.some((s) => skillKey(s.sourceId, s.name) === selectedId)
    ) {
      setSelectedId(skills.list[0] ? skillKey(skills.list[0].sourceId, skills.list[0].name) : null)
    }
    if (tab === 'mcp' && selectedId && !mcp.list.some((s) => s.id === selectedId)) {
      setSelectedId(mcp.list[0]?.id ?? null)
    }
  }, [mcp.list, selectedId, skills.list, tab])

  const selectedSkill = skills.list.find((s) => skillKey(s.sourceId, s.name) === selectedId)
  const selectedMcp = mcp.list.find((s) => s.id === selectedId)

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
            selectedId={selectedId}
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
              onToggle={() =>
                void skills.setEnabled({
                  name: selectedSkill.name,
                  sourceId: selectedSkill.sourceId,
                  enabled: !selectedSkill.enabled
                })
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
