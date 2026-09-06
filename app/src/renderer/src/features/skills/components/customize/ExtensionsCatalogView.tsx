import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { useCustomizeSkills } from '../../hooks/useCustomizeSkills'
import { useMcpServers } from '../../hooks/useMcpServers'
import { useProviders } from '../../hooks/useProviders'
import { back, openDetail, selectTab, type CatalogSelection } from '../../lib/catalogSelection'
import { toggleGroup, type CollapsedGroups } from '../../lib/catalogGroups'
import { CustomizeRail } from './CustomizeRail'
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
  const [selection, setSelection] = useState<CatalogSelection>({ tab: 'skills', selectedId: null })
  // 그룹 접힘 — 키가 탭으로 네임스페이스돼 탭을 오가도 유지되고, 모달 언마운트 시 초기화된다
  // (영속 키 계약을 만들지 않기 위해 의도적으로 메모리 전용, plan 0159 r5).
  const [collapsed, setCollapsed] = useState<CollapsedGroups>({})
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
  const selectedSkill = skills.list.find(
    (item) => skillKey(item.sourceId, item.name) === selection.selectedId
  )
  const selectedMcp = mcp.list.find((item) => item.id === selection.selectedId)
  const editingMcp = mcp.list.find((item) => item.id === mcpEditId)
  const selectedProvider = providers.list.find((item) => item.id === selection.selectedId)
  const detail = selectedSkill ?? selectedMcp ?? selectedProvider
  const title = tr(
    selection.tab === 'skills'
      ? 'skills.rail.skills'
      : selection.tab === 'mcp'
        ? 'skills.rail.mcp'
        : 'skills.rail.providers'
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
                onClick={() => {
                  providers.clearStep()
                  setSelection((state) => back(state))
                }}
                aria-label={tr('skills.view.backAria', { section: title })}
              />
              <span className="text-footnote text-ink2">{title}</span>
            </>
          ) : (
            <h1 className="m-0 text-heading text-ink">{title}</h1>
          )}
          {/* skills 는 메뉴, mcp 는 모달. */}
          {/* provider 는 빌드타임 선언이라 UI 추가 경로가 없다 — 버튼 자체를 내지 않는다. */}
          {!detail && selection.tab !== 'providers' && (
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
            onEdit={() => setMcpEditId(selectedMcp.id)}
            onRemove={() => mcp.remove(selectedMcp.id)}
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
        ) : skills.loading || mcp.loading || providers.loading ? (
          <div className="grid flex-1 place-items-center text-ink3">{tr('common.loading')}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <CustomizeList
              tab={selection.tab}
              skills={skills.list}
              mcpServers={mcp.list}
              providers={providers.list}
              collapsed={collapsed}
              onToggleGroup={(key) => setCollapsed((state) => toggleGroup(state, key))}
              onSelect={(id) => setSelection((state) => openDetail(state, id))}
            />
          </div>
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
              setSelection((state) => openDetail(state, values.name))
            }
            setMcpEditId(null)
          }}
        />
      )}
    </section>
  )
}
