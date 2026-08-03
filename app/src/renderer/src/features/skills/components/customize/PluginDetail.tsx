import { useState, type ReactNode } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Dot } from '../../../../shared/ui/Status'
import { useI18n } from '../../../../shared/i18n'
import { pluginApi } from '../../../../shared/api/ipc'
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../../shared/ipc'
import type { PluginRow } from '../../lib/pluginCatalog'
import { connectorActions, runReconnect } from '../../lib/connectorActions'
import { ConnectorConnectModal } from './ConnectorConnectModal'

// 레퍼런스(claude.ai 설정 상세)의 구성 — 제목 → 라벨/값 메타 열 → 섹션별 hairline 목록.
// 항목을 카드로 감싸지 않는다(테두리 상자가 겹치면 밀도만 올라가고 스캔은 느려진다).
const sectionTitleClass = 'text-caption text-ink3'
const itemClass = 'border-b border-border py-p5 last:border-b-0'

function Meta({ label, value }: { label: string; value: ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-g1 text-caption text-ink3">{label}</div>
      <div className="truncate text-footnote text-ink2">{value}</div>
    </div>
  )
}

export function PluginDetail({
  plugin,
  providers,
  onChanged
}: {
  plugin: PluginRow
  // **등록된 provider 전체.** 이 행이 기여한 것만이 아니다 — 사용자가 만든 커넥터는 공용
  // 패키지의 provider 를 참조하므로(0161 패키지 2분할) 자기 행만 보면 인증 방식이 0개가 된다.
  // 실제로 어느 것을 쓸 수 있는지는 `buildConnectOptions` 가 `acceptedAuthProviders` 로 좁힌다.
  providers: AuthProviderInfo[]
  // 연결 상태가 바뀌면 카탈로그를 다시 읽는다 — connected 는 main 이 소유한다.
  onChanged?: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [connecting, setConnecting] = useState<PluginConnectorInfo | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // 사용자가 추가한 서버만 지울 수 있다 — 정적 connector 는 코드로 배포된 것이라 main 이
  // `not_found` 로 거부한다. 버튼을 아예 그리지 않아 눌러보고 실패하는 경험을 막는다.
  const removeInstance = (connectorId: string): void => {
    setBusyId(connectorId)
    void pluginApi
      .deleteInstance(connectorId)
      .catch(() => undefined)
      .finally(() => {
        setBusyId(null)
        onChanged?.()
      })
  }

  const disconnect = (connectorId: string): void => {
    setBusyId(connectorId)
    void pluginApi
      .disconnect(connectorId)
      .catch(() => undefined)
      .finally(() => {
        setBusyId(null)
        onChanged?.()
      })
  }

  // 재연결 — PAT·비밀번호가 바뀌었을 때 쓰는 경로다(사용자 요구). 자격증명은 연결 해제 시
  // vault 에서 지워지므로(`broker.ts` logout) 저장된 값으로 되붙는 길은 없다. 끊고 다시 받는다.
  // 순서·실패 분기는 `runReconnect` 가 갖는다 — 붙은 채로 붙이면 `already_connected` 다.
  const reconnect = (connector: PluginConnectorInfo): void => {
    setBusyId(connector.connectorId)
    void runReconnect({
      disconnect: () => pluginApi.disconnect(connector.connectorId),
      open: () => setConnecting(connector)
    }).finally(() => {
      setBusyId(null)
      onChanged?.()
    })
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      {/* 인스턴스 행이면 사용자가 붙인 이름이 제목이다(0163) — pluginId 는 주소에서 파생한
          기계값이라 사용자가 자기가 만든 서버를 알아볼 수 없었다. */}
      <h2 className="m-0 text-heading text-ink">{plugin.title}</h2>
      {plugin.title !== plugin.pluginId && (
        <div className="mt-g1 text-caption text-ink3">{plugin.pluginId}</div>
      )}
      <div className="mt-p8 grid grid-cols-3 gap-g6">
        <Meta label={tr('skills.table.providers')} value={plugin.providerCount} />
        <Meta label={tr('skills.table.connectors')} value={plugin.connectorCount} />
        <Meta label={tr('skills.table.connected')} value={plugin.connectedCount} />
      </div>
      <section className="mt-6">
        <h3 className={sectionTitleClass}>{tr('skills.pluginDetail.providers')}</h3>
        {plugin.providers.map((provider) => (
          <div key={provider.id} className={itemClass}>
            <div className="text-footnote text-ink">{provider.label}</div>
            <div className="mt-g1 text-caption text-ink3">
              {provider.id} · {provider.targets.join(', ')}
            </div>
          </div>
        ))}
      </section>
      <section className="mt-6">
        <h3 className={sectionTitleClass}>{tr('skills.pluginDetail.connectors')}</h3>
        {plugin.connectors.map((connector) => {
          // 점 색과 버튼 구성은 순수 모듈이 정한다(0162) — 렌더링은 그 결과를 그리기만 한다.
          const { tone, actions } = connectorActions(connector)
          const busy = busyId === connector.connectorId
          return (
            <div key={connector.connectorId} className={itemClass}>
              <div className="flex items-center gap-g3 text-footnote">
                {/* 초록 점 = 자격증명 확인까지 끝난 연결. 색만으로 상태를 전달하지 않도록
                    옆의 글자 라벨은 지우지 않는다. */}
                <Dot tone={tone} />
                <span className="min-w-0 truncate text-ink">{connector.label}</span>
                <span className="ml-auto flex-none pl-p5 text-caption text-ink3">
                  {connector.connected
                    ? tr('skills.pluginDetail.connectedLabel')
                    : tr('skills.pluginDetail.disconnectedLabel')}
                </span>
              </div>
              <div className="mt-g1 text-caption text-ink3">
                {tr('skills.pluginDetail.origin')}: {connector.origin}
              </div>
              {/* 액션은 **줄을 따로 쓴다** (0163) — 이름과 같은 줄에 넣으면 버튼 4개가
                  서버 이름을 밀어내 무엇에 대한 버튼인지 알 수 없다. */}
              <div className="mt-p3 flex flex-wrap items-center gap-g1">
                {actions.includes('connect') && (
                  <Button
                    variant="uncontained"
                    size="small"
                    busy={busy}
                    onClick={() => setConnecting(connector)}
                  >
                    {tr('skills.connect.connect')}
                  </Button>
                )}
                {actions.includes('reconnect') && (
                  <Button
                    variant="uncontained"
                    size="small"
                    busy={busy}
                    onClick={() => reconnect(connector)}
                  >
                    {tr('skills.connect.reconnect')}
                  </Button>
                )}
                {actions.includes('disconnect') && (
                  <Button
                    variant="uncontained"
                    size="small"
                    disabled={busy}
                    onClick={() => disconnect(connector.connectorId)}
                  >
                    {tr('skills.connect.disconnect')}
                  </Button>
                )}
                {actions.includes('remove') && (
                  <Button
                    variant="danger-ghost"
                    size="small"
                    disabled={busy}
                    onClick={() => removeInstance(connector.connectorId)}
                  >
                    {tr('skills.instance.delete')}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </section>
      {connecting !== null && (
        <ConnectorConnectModal
          open
          connector={connecting}
          providers={providers}
          onClose={() => setConnecting(null)}
          onConnected={() => {
            setConnecting(null)
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}
