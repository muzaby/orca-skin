import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n'
import type { PluginRow } from '../../lib/pluginCatalog'

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

export function PluginDetail({ plugin }: { plugin: PluginRow }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <h2 className="m-0 text-heading text-ink">{plugin.pluginId}</h2>
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
        {plugin.connectors.map((connector) => (
          <div key={connector.connectorId} className={itemClass}>
            <div className="flex text-footnote">
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
          </div>
        ))}
      </section>
    </div>
  )
}
