import { useState, type ReactNode } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Dot } from '../../../../shared/ui/Status'
import { useI18n } from '../../../../shared/i18n'
import { pluginApi } from '../../../../shared/api/ipc'
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../../shared/ipc'
import type { ConnectorRow } from '../../lib/pluginCatalog'
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
  row,
  providers,
  onChanged
}: {
  // 행 하나 = **서버 하나** (0164). 이전에는 패키지였고, 그래서 사용자가 만든 서버의
  // "인증 제공자" 가 0으로 보였다(provider 는 공용 패키지에 살기 때문).
  row: ConnectorRow
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

  // 점 색과 버튼 구성은 순수 모듈이 정한다(0162) — 렌더링은 그 결과를 그리기만 한다.
  const { tone, actions } = connectorActions(row.connector)
  const busy = busyId === row.connectorId

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="flex items-center gap-g3">
        {/* 초록 점 = 자격증명 확인까지 끝난 연결. 색만으로 상태를 전달하지 않도록
            아래 "연결 상태" 값은 글자로도 남긴다. */}
        <Dot tone={tone} />
        <h2 className="m-0 min-w-0 truncate text-heading text-ink">{row.title}</h2>
      </div>
      <div className="mt-p8 grid grid-cols-2 gap-g6">
        <Meta label={tr('skills.pluginDetail.origin')} value={row.origin} />
        <Meta
          label={tr('skills.table.connected')}
          value={
            row.connected
              ? tr('skills.pluginDetail.connectedLabel')
              : tr('skills.pluginDetail.disconnectedLabel')
          }
        />
      </div>
      <section className="mt-6">
        {/* "인증 제공자 N" 을 대체한다 (0164). 그 숫자는 *패키지가 기여한 provider 수* 라
            사용자가 ID/비밀번호로 붙여놓고도 0 을 보게 했다. 여기 보이는 것은 **이 서버가
            쓸 수 있는 방식**이고, 연결돼 있으면 무엇으로 붙었는지를 함께 적는다. */}
        <h3 className={sectionTitleClass}>{tr('skills.pluginDetail.authMethods')}</h3>
        <div className={itemClass}>
          <div className="text-footnote text-ink">
            {row.authLabels.length > 0
              ? row.authLabels.join(' · ')
              : tr('skills.connect.noProvider')}
          </div>
          {row.connectedAuthLabel !== null && (
            <div className="mt-g1 text-caption text-ink2">
              {tr('skills.pluginDetail.connectedWith', { method: row.connectedAuthLabel })}
            </div>
          )}
        </div>
      </section>
      <section className="mt-6">
        <h3 className={sectionTitleClass}>{tr('skills.pluginDetail.actions')}</h3>
        <div className="mt-p3 flex flex-wrap items-center gap-g1">
          {actions.includes('connect') && (
            <Button
              variant="uncontained"
              size="small"
              busy={busy}
              onClick={() => setConnecting(row.connector)}
            >
              {tr('skills.connect.connect')}
            </Button>
          )}
          {actions.includes('reconnect') && (
            <Button
              variant="uncontained"
              size="small"
              busy={busy}
              onClick={() => reconnect(row.connector)}
            >
              {tr('skills.connect.reconnect')}
            </Button>
          )}
          {actions.includes('disconnect') && (
            <Button
              variant="uncontained"
              size="small"
              disabled={busy}
              onClick={() => disconnect(row.connectorId)}
            >
              {tr('skills.connect.disconnect')}
            </Button>
          )}
          {/* 정적 서버는 제거 버튼이 없다 — 주소가 빌드타임에 고정돼 있다(0164). */}
          {actions.includes('remove') && (
            <Button
              variant="danger-ghost"
              size="small"
              disabled={busy}
              onClick={() => removeInstance(row.connectorId)}
            >
              {tr('skills.instance.delete')}
            </Button>
          )}
        </div>
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
