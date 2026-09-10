import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'
import { useProviders } from '../../hooks/useProviders'
import { back, openDetail, selectTab, type CatalogSelection } from '../../lib/catalogSelection'
import { ExtensionDetailPane } from './ExtensionDetailPane'
import { CustomizeTabs } from './CustomizeTabs'
import { CustomizeList } from './CustomizeList'
import { SkillDetail } from './SkillDetail'
import { McpDetail } from './McpDetail'
import { ProviderDetail } from './ProviderDetail'
import { SkillAddMenu } from './SkillAddMenu'
import { SkillAuthorModal } from './SkillAuthorModal'
import { SkillUploadModal } from './SkillUploadModal'
import { CustomMcpModal } from './CustomMcpModal'
import { AddMcpServerModal } from '../AddMcpServerModal'

const skillKey = (sourceId: string, name: string): string => `${sourceId}/${name}`

export function ExtensionsCatalogView(): React.JSX.Element {
  const { tr } = useI18n()
  const navigate = useNavigate()
  const id = useId()
  const [selection, setSelection] = useState<CatalogSelection>({ tab: 'skills', selectedId: null })
  const [panelWidth, setPanelWidth] = useState(640)
  const [expanded, setExpanded] = useState(false)
  const originRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selectionEpoch = useRef(0)
  const skills = useCustomizeSkills()
  const mcp = useMcpServers()
  const providers = useProviders()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  // 편집 대상은 id 로 들고 목록에서 되찾는다 — 서버 객체를 복사해 두면 갱신 후 낡은 값이 남는다.
  const [mcpEditId, setMcpEditId] = useState<string | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const selectedSkill =
    selection.tab === 'skills'
      ? skills.list.find((item) => skillKey(item.sourceId, item.name) === selection.selectedId)
      : undefined
  const selectedMcp =
    selection.tab === 'mcp' ? mcp.list.find((item) => item.id === selection.selectedId) : undefined
  const editingMcp = mcp.list.find((item) => item.id === mcpEditId)
  const selectedProvider =
    selection.tab === 'providers'
      ? providers.list.find((item) => item.id === selection.selectedId)
      : undefined
  const detail = selectedSkill ?? selectedMcp ?? selectedProvider
  const title = tr(
    selection.tab === 'skills'
      ? 'skills.rail.skills'
      : selection.tab === 'mcp'
        ? 'skills.rail.mcp'
        : 'skills.rail.providers'
  )
  const closeDetail = (): void => {
    selectionEpoch.current += 1
    const epoch = selectionEpoch.current
    providers.clearStep()
    setExpanded(false)
    setSelection((state) => back(state))
    window.requestAnimationFrame(() => {
      if (selectionEpoch.current !== epoch) return
      if (originRef.current?.isConnected) originRef.current.focus({ preventScroll: true })
      else
        listRef.current
          ?.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')
          ?.focus({ preventScroll: true })
    })
  }
  const removeDetail = async (remove: () => Promise<void>): Promise<void> => {
    const epoch = selectionEpoch.current
    await remove()
    if (selectionEpoch.current === epoch) closeDetail()
  }
  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 pb-2 pr-2"
      data-side-pane-host=""
      data-context="extensions-catalog"
      data-state={detail ? 'detail' : 'list'}
    >
      <div
        ref={listRef}
        data-extensions-catalog-list=""
        inert={!!detail && expanded}
        className="@container/catalog min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        <div className={`mx-auto w-full max-w-[960px] pb-10 pt-10 ${detail ? 'px-4' : 'px-8'}`}>
          <h1 className="m-0 font-serif text-[30px] font-medium tracking-[-0.02em] text-ink">
            {tr('skills.pageTitle')}
          </h1>
          <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
            <CustomizeTabs
              id={id}
              tab={selection.tab}
              onSelect={(tab) => {
                selectionEpoch.current += 1
                providers.clearStep()
                setMenuOpen(false)
                setExpanded(false)
                setSelection((state) => selectTab(state, tab))
              }}
            />
            {/* skills 는 메뉴, mcp 는 모달. */}
            {/* provider 는 빌드타임 선언이라 UI 추가 경로가 없다 — 버튼 자체를 내지 않는다. */}
            {selection.tab !== 'providers' && (
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
                }}
              >
                {tr('common.add')}
              </Button>
            )}
          </div>
          <div role="tabpanel" id={`${id}-items`} aria-labelledby={`${id}-${selection.tab}`}>
            {skills.loading || mcp.loading || providers.loading ? (
              <div role="status" className="grid h-48 place-items-center text-footnote text-ink3">
                {tr('common.loading')}
              </div>
            ) : (
              <CustomizeList
                tab={selection.tab}
                skills={skills.list}
                mcpServers={mcp.list}
                providers={providers.list}
                selectedId={selection.selectedId}
                onSelect={(id, origin) => {
                  selectionEpoch.current += 1
                  originRef.current = origin
                  providers.clearStep()
                  setExpanded(false)
                  setSelection((state) => openDetail(state, id))
                }}
              />
            )}
          </div>
        </div>
      </div>
      {detail && selection.selectedId && (
        <ExtensionDetailPane
          key={`${selection.tab}:${selection.selectedId}`}
          tab={selection.tab}
          itemId={selection.selectedId}
          title={title}
          width={panelWidth}
          expanded={expanded}
          onWidthChange={setPanelWidth}
          onExpandedChange={setExpanded}
          onClose={closeDetail}
        >
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
                removeDetail(() =>
                  skills.remove({ name: selectedSkill.name, sourceId: selectedSkill.sourceId })
                )
              }
            />
          ) : selectedMcp ? (
            <McpDetail
              server={selectedMcp}
              onToggle={() => void mcp.toggle(selectedMcp.id, !selectedMcp.enabled)}
              onEdit={() => setMcpEditId(selectedMcp.id)}
              onRemove={() => removeDetail(() => mcp.remove(selectedMcp.id))}
            />
          ) : selectedProvider ? (
            <ProviderDetail
              // provider 를 갈아타면 방식 선택·입력값이 남지 않도록 리마운트한다.
              key={selectedProvider.id}
              provider={selectedProvider}
              step={providers.step}
              onLogin={(authKind) => void providers.login(selectedProvider.id, authKind)}
              onSubmit={(input) => void providers.submit(selectedProvider.id, input)}
              onReauth={(authKind) => void providers.reauth(selectedProvider.id, authKind)}
              onRevoke={() => void providers.revoke(selectedProvider.id)}
            />
          ) : null}
        </ExtensionDetailPane>
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
      {editingMcp && (
        <AddMcpServerModal
          open
          initial={editingMcp}
          onClose={() => setMcpEditId(null)}
          onSave={async (values) => {
            await mcp.update({
              id: editingMcp.id,
              name: values.name,
              description: values.description,
              transport: values.transport,
              command: values.command,
              args: values.args,
              authEnvKey: values.authEnvKey,
              url: values.url,
              // undefined = 비밀 미변경. 키를 넣으면 '' 이 "비밀 제거"로 읽힌다.
              ...(values.auth !== undefined ? { auth: values.auth } : {})
            })
            // id 는 서버 이름이라 rename 이 곧 재키잉이다 — 상세 선택을 새 id 로 옮기지 않으면
            // 저장 직후 상세가 사라지고 목록으로 튕긴다.
            if (values.name !== editingMcp.id) {
              setSelection((state) =>
                state.tab === 'mcp' && state.selectedId === editingMcp.id
                  ? openDetail(state, values.name)
                  : state
              )
            }
            setMcpEditId(null)
          }}
        />
      )}
    </section>
  )
}
