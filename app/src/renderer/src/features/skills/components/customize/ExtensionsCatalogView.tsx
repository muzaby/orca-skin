import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'
import { usePluginCatalog } from '../../hooks/usePluginCatalog'
import { back, openDetail, selectTab, type CatalogSelection } from '../../lib/catalogSelection'
import { CustomizeRail } from './CustomizeRail'
import { CustomizeList } from './CustomizeList'
import { SkillDetail } from './SkillDetail'
import { McpDetail } from './McpDetail'
import { PluginDetail } from './PluginDetail'
import { SkillAddMenu } from './SkillAddMenu'
import { SkillAuthorModal } from './SkillAuthorModal'
import { SkillUploadModal } from './SkillUploadModal'
import { CustomMcpModal } from './CustomMcpModal'

const skillKey = (sourceId: string, name: string): string => `${sourceId}/${name}`

export function ExtensionsCatalogView(): React.JSX.Element {
  const { tr } = useI18n()
  const navigate = useNavigate()
  const [selection, setSelection] = useState<CatalogSelection>({ tab: 'skills', selectedId: null })
  const skills = useCustomizeSkills()
  const mcp = useMcpServers()
  const plugins = usePluginCatalog()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const selectedSkill = skills.list.find(
    (item) => skillKey(item.sourceId, item.name) === selection.selectedId
  )
  const selectedMcp = mcp.list.find((item) => item.id === selection.selectedId)
  const selectedPlugin = plugins.rows.find((item) => item.pluginId === selection.selectedId)
  const detail = selectedSkill ?? selectedMcp ?? selectedPlugin
  const title = tr(
    selection.tab === 'skills'
      ? 'skills.rail.skills'
      : selection.tab === 'mcp'
        ? 'skills.rail.mcp'
        : 'skills.rail.plugins'
  )
  return (
    <section
      className="flex h-full min-h-0 w-full"
      data-context="extensions-catalog"
      data-state={detail ? 'detail' : 'list'}
    >
      <CustomizeRail
        tab={selection.tab}
        onSelect={(tab) => setSelection((state) => selectTab(state, tab))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center border-b border-border px-6">
          {detail && (
            <Button
              iconOnly
              leadingIcon="arrowL"
              size="small"
              onClick={() => setSelection((state) => back(state))}
              aria-label={tr('skills.view.backAria', { section: title })}
            />
          )}
          <h1 className="ml-2 font-serif text-[18px] font-semibold text-ink">{title}</h1>
          {!detail && selection.tab !== 'plugins' && (
            <Button
              ref={addRef}
              className="ml-auto"
              leadingIcon="plus"
              size="small"
              onClick={() =>
                selection.tab === 'skills' ? setMenuOpen((value) => !value) : setMcpModalOpen(true)
              }
            >
              {tr('common.add')}
            </Button>
          )}
        </header>
        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            onToggle={() =>
              selectedSkill.canToggle &&
              void skills.setEnabled({
                name: selectedSkill.name,
                sourceId: selectedSkill.sourceId,
                enabled: !selectedSkill.enabled
              })
            }
            onTryInChat={() =>
              navigate('/new', { state: { composerDraft: `/${selectedSkill.name} ` } })
            }
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
        ) : selectedMcp ? (
          <McpDetail
            server={selectedMcp}
            onToggle={() => void mcp.toggle(selectedMcp.id, !selectedMcp.enabled)}
          />
        ) : selectedPlugin ? (
          <PluginDetail plugin={selectedPlugin} />
        ) : skills.loading || mcp.loading || plugins.loading ? (
          <div className="grid flex-1 place-items-center text-ink3">{tr('common.loading')}</div>
        ) : (
          <CustomizeList
            tab={selection.tab}
            skills={skills.list}
            mcpServers={mcp.list}
            plugins={plugins.rows}
            onSelect={(id) => setSelection((state) => openDetail(state, id))}
          />
        )}
      </div>
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
