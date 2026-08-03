import { useRef, useState } from 'react'
import type { PluginConnectorInfo } from '../../../../../../shared/ipc'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'
import { usePluginCatalog } from '../../hooks/usePluginCatalog'
import { back, openDetail, selectTab, type CatalogSelection } from '../../lib/catalogSelection'
import { toggleGroup, type CollapsedGroups } from '../../lib/catalogGroups'
import { CustomizeRail } from './CustomizeRail'
import { CustomizeList } from './CustomizeList'
import { SkillDetail } from './SkillDetail'
import { McpDetail } from './McpDetail'
import { PluginDetail } from './PluginDetail'
import { SkillAddMenu } from './SkillAddMenu'
import { SkillAuthorModal } from './SkillAuthorModal'
import { SkillUploadModal } from './SkillUploadModal'
import { CustomMcpModal } from './CustomMcpModal'
import { ConnectorInstanceModal } from './ConnectorInstanceModal'
import { ConnectorConnectModal } from './ConnectorConnectModal'

const skillKey = (sourceId: string, name: string): string => `${sourceId}/${name}`

export function ExtensionsCatalogView(): React.JSX.Element {
  const { tr } = useI18n()
  const navigate = useNavigate()
  const [selection, setSelection] = useState<CatalogSelection>({ tab: 'skills', selectedId: null })
  // 그룹 접힘 — 키가 탭으로 네임스페이스돼 탭을 오가도 유지되고, 모달 언마운트 시 초기화된다
  // (영속 키 계약을 만들지 않기 위해 의도적으로 메모리 전용, plan 0159 r5).
  const [collapsed, setCollapsed] = useState<CollapsedGroups>({})
  const skills = useCustomizeSkills()
  const mcp = useMcpServers()
  const plugins = usePluginCatalog()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  // 0161 — 서버 추가 → 만들어진 connector 로 곧바로 인증 모달을 잇는다.
  const [instanceModalOpen, setInstanceModalOpen] = useState(false)
  const [connecting, setConnecting] = useState<PluginConnectorInfo | null>(null)
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
        {/* 레퍼런스(claude.ai 설정) 헤더 구성 — 목록은 제목 + 우측 액션, 상세는 조용한
            `← 섹션` 되돌아가기 줄. 상세의 큰 제목은 각 detail 패널이 소유한다(중복 heading 제거).
            "찾아보기"는 사용자 지시로 배치하지 않는다. */}
        <header className="flex flex-none items-center gap-g3 px-7 pb-p7 pt-6">
          {detail ? (
            <>
              <Button
                iconOnly
                leadingIcon="arrowL"
                size="small"
                onClick={() => setSelection((state) => back(state))}
                aria-label={tr('skills.view.backAria', { section: title })}
              />
              <span className="text-footnote text-ink2">{title}</span>
            </>
          ) : (
            <h1 className="m-0 text-heading text-ink">{title}</h1>
          )}
          {/* 0161 — plugins 탭에도 추가 버튼을 둔다(이전에는 이 탭에서만 숨겨져 있었다).
              탭마다 여는 것이 다르다: skills=메뉴, mcp=커스텀 MCP, plugins=서버 추가. */}
          {!detail && (
            <Button
              ref={addRef}
              className="ml-auto"
              variant="contained"
              size="small"
              dropdown={selection.tab === 'skills'}
              expanded={selection.tab === 'skills' ? menuOpen : undefined}
              onClick={() => {
                if (selection.tab === 'skills') setMenuOpen((value) => !value)
                else if (selection.tab === 'mcp') setMcpModalOpen(true)
                else setInstanceModalOpen(true)
              }}
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
          <PluginDetail plugin={selectedPlugin} onChanged={plugins.refresh} />
        ) : skills.loading || mcp.loading || plugins.loading ? (
          <div className="grid flex-1 place-items-center text-ink3">{tr('common.loading')}</div>
        ) : (
          <CustomizeList
            tab={selection.tab}
            skills={skills.list}
            mcpServers={mcp.list}
            plugins={plugins.rows}
            collapsed={collapsed}
            onToggleGroup={(key) => setCollapsed((state) => toggleGroup(state, key))}
            onSelect={(id) => setSelection((state) => openDetail(state, id))}
          />
        )}
      </div>
      <ConnectorInstanceModal
        open={instanceModalOpen}
        onClose={() => setInstanceModalOpen(false)}
        onCreated={(connector) => {
          plugins.refresh()
          // 서버를 만들었으면 곧바로 자격증명을 받는다 — 사용자 요구의 "url 및 인증 정보"가
          // 한 흐름이다. 인증을 취소해도 서버는 남는다.
          setConnecting(connector)
        }}
      />
      {connecting !== null && (
        <ConnectorConnectModal
          open
          connector={connecting}
          providers={plugins.rows.flatMap((row) => row.providers)}
          onClose={() => setConnecting(null)}
          onConnected={() => {
            setConnecting(null)
            plugins.refresh()
          }}
        />
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
