import { useRef, useState } from 'react'
import type { PluginConnectorInfo } from '../../../../../../shared/ipc'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { useTweakContext } from '../../../../shared/theme'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'
import { usePluginCatalog } from '../../hooks/usePluginCatalog'
import { back, openDetail, selectTab, type CatalogSelection } from '../../lib/catalogSelection'
import { handleCreated } from '../../lib/connectorCreate'
import { showsAddButton } from '../../lib/pluginAddGate'
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
import { ConnectorAddMenu } from './ConnectorAddMenu'
import { ConnectorInstanceModal } from './ConnectorInstanceModal'
import { ConnectorConnectModal } from './ConnectorConnectModal'

const skillKey = (sourceId: string, name: string): string => `${sourceId}/${name}`

export function ExtensionsCatalogView(): React.JSX.Element {
  const { tr } = useI18n()
  // 서버 목록의 정본은 빌드타임(`servers.ts`)이라 추가 버튼은 기본으로 숨긴다 (0164).
  // 디버그 패널 토글로만 열린다.
  const { t } = useTweakContext()
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
  // 0161·0162 — 추가 메뉴에서 템플릿을 고르면 그 템플릿으로 서버 추가 모달을 열고,
  // 만들어진 connector 로 곧바로 인증 모달을 잇는다.
  const [connectorMenuOpen, setConnectorMenuOpen] = useState(false)
  const [pickedTemplate, setPickedTemplate] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<PluginConnectorInfo | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const selectedSkill = skills.list.find(
    (item) => skillKey(item.sourceId, item.name) === selection.selectedId
  )
  const selectedMcp = mcp.list.find((item) => item.id === selection.selectedId)
  const selectedPlugin = plugins.rows.find((item) => item.connectorId === selection.selectedId)
  // 등록된 provider 전체 — connector 가 어느 패키지의 provider 든 참조할 수 있다.
  const allProviders = plugins.providers
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
              0162 — plugins 도 skills 처럼 **메뉴**를 연다. 고를 것이 하나뿐이어도 무엇을
              추가하는지가 화면에 있어야 한다(이전에는 곧바로 주소 폼이 떠 나열이 없었다).
              mcp 만 커스텀 MCP 모달로 직행한다. */}
          {!detail && showsAddButton(selection.tab, t.pluginAddEnabled) && (
            <Button
              ref={addRef}
              className="ml-auto"
              variant="contained"
              size="small"
              dropdown={selection.tab !== 'mcp'}
              expanded={
                selection.tab === 'skills'
                  ? menuOpen
                  : selection.tab === 'plugins'
                    ? connectorMenuOpen
                    : undefined
              }
              onClick={() => {
                if (selection.tab === 'skills') setMenuOpen((value) => !value)
                else if (selection.tab === 'mcp') setMcpModalOpen(true)
                else setConnectorMenuOpen((value) => !value)
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
          <PluginDetail
            row={selectedPlugin}
            // **전체** provider 를 넘긴다 (0163). 인스턴스 커넥터는 공용 패키지의 provider 를
            // 참조하므로(0161 의 패키지 2분할) 자기 행의 provider 만 넘기면 인증 방식이
            // 하나도 없다고 나온다. 좁히는 것은 `buildConnectOptions` 가 한다.
            providers={allProviders}
            onChanged={plugins.refresh}
          />
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
      <ConnectorAddMenu
        open={connectorMenuOpen}
        anchorRef={addRef}
        onClose={() => setConnectorMenuOpen(false)}
        onPick={(templateId) => setPickedTemplate(templateId)}
      />
      {pickedTemplate !== null && (
        <ConnectorInstanceModal
          open
          templateId={pickedTemplate}
          onClose={() => setPickedTemplate(null)}
          onCreated={(connectors) => {
            // **갱신은 무조건, 인증은 새것을 찾았을 때만** (0163). 0162 는 둘을 묶어놔서
            // 새것을 못 찾으면 목록도 안 바뀌고 오류도 안 떠 "아무 일도 없었다" 가 됐다.
            // 서버를 만들었으면 곧바로 자격증명을 받는다 — 사용자 요구의 "url 및 인증 정보"가
            // 한 흐름이다. 인증을 취소해도 서버는 남는다.
            handleCreated({
              before: plugins.rows.map((row) => row.connector),
              after: connectors,
              refresh: plugins.refresh,
              connect: setConnecting
            })
          }}
        />
      )}
      {connecting !== null && (
        <ConnectorConnectModal
          open
          connector={connecting}
          providers={allProviders}
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
