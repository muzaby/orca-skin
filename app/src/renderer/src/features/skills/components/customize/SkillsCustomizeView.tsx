import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CustomizeRail } from './CustomizeRail'
import { CustomizeList } from './CustomizeList'
import { SkillDetail } from './SkillDetail'
import { McpDetail } from './McpDetail'
import { SkillAddMenu } from './SkillAddMenu'
import { SkillAuthorModal } from './SkillAuthorModal'
import { SkillUploadModal } from './SkillUploadModal'
import { CustomMcpModal } from './CustomMcpModal'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'
import { splitSkillCatalog } from '../../lib/catalog'
import { useExtensionsModalStore, type CustomizeTab } from '../../store/extensionsModalStore'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { Modal } from '../../../../shared/ui/Modal'

function skillKey(sourceId: string, name: string): string {
  return `${sourceId}/${name}`
}

export function SkillsCustomizeView(): React.JSX.Element | null {
  const { tr } = useI18n()
  const open = useExtensionsModalStore((state) => state.open)
  const tab = useExtensionsModalStore((state) => state.tab)
  const setTab = useExtensionsModalStore((state) => state.setTab)
  const hide = useExtensionsModalStore((state) => state.hide)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navigate = useNavigate()
  const skills = useCustomizeSkills()
  const mcp = useMcpServers()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const catalog = splitSkillCatalog(skills.list)

  const selectTab = (nextTab: CustomizeTab): void => {
    setTab(nextTab)
    setSelectedId(null)
    setMenuOpen(false)
  }

  const close = (): void => {
    setSelectedId(null)
    setMenuOpen(false)
    hide()
  }

  const tabSkills = tab === 'plugins' ? catalog.plugins : catalog.skills
  const selectedSkill = tabSkills.find(
    (skill) => skillKey(skill.sourceId, skill.name) === selectedId
  )
  const selectedMcp =
    tab === 'connectors' ? mcp.list.find((server) => server.id === selectedId) : undefined
  const detailOpen = selectedSkill != null || selectedMcp != null
  const title =
    tab === 'skills'
      ? tr('skills.rail.skills')
      : tab === 'connectors'
        ? tr('skills.rail.connectors')
        : tr('skills.rail.plugins')

  const add = (): void => {
    if (tab === 'skills') setMenuOpen((value) => !value)
    else if (tab === 'connectors') setMcpModalOpen(true)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      ariaLabel={tr('skills.modalTitle')}
      panelClassName="flex h-[640px] max-h-[86vh] w-[960px] max-w-[94vw] overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
    >
      <CustomizeRail tab={tab} onSelect={selectTab} />

      <section
        className="relative flex min-w-0 flex-1 flex-col"
        data-context="extensions-catalog"
        data-state={detailOpen ? 'detail' : 'list'}
      >
        <header className="flex h-16 flex-none items-center gap-2 border-b border-border px-5">
          {detailOpen ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label={tr('skills.view.backAria', { section: title })}
              className="flex cursor-pointer items-center gap-2 rounded-r4 border-0 bg-transparent px-1.5 py-1 text-[14px] font-medium text-ink hover:bg-fill-uncontained-hover"
            >
              <Icon name="arrowL" size={17} />
              <span>{title}</span>
            </button>
          ) : (
            <h1 className="m-0 font-serif text-[17px] font-semibold text-ink">{title}</h1>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {!detailOpen && tab !== 'plugins' && (
              <Button
                ref={addRef}
                size="small"
                variant="contained"
                leadingIcon="plus"
                onClick={add}
              >
                {tr('common.add')}
              </Button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label={tr('common.close')}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink2 hover:bg-fill-uncontained-hover"
            >
              <Icon name="x" size={17} />
            </button>
          </div>
        </header>

        {detailOpen && selectedSkill ? (
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
              close()
              navigate('/new', { state: { composerDraft: `/${selectedSkill.name} ` } })
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
            onRemove={async () => {
              await skills.remove({ name: selectedSkill.name, sourceId: selectedSkill.sourceId })
              setSelectedId(null)
            }}
          />
        ) : detailOpen && selectedMcp ? (
          <McpDetail
            server={selectedMcp}
            onToggle={() => void mcp.toggle(selectedMcp.id, !selectedMcp.enabled)}
          />
        ) : (
          <CustomizeList
            tab={tab}
            skills={catalog.skills}
            plugins={catalog.plugins}
            mcpServers={mcp.list}
            onSelect={setSelectedId}
          />
        )}
      </section>

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
    </Modal>
  )
}
