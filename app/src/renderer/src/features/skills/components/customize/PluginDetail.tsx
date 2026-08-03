import { useI18n } from '../../../../shared/i18n'
import type { PluginRow } from '../../lib/pluginCatalog'

// 카드는 bg-bg2 — 모달 패널이 bg-panel 이라 같은 토큰을 쓰면 카드 면이 배경에 묻힌다
// (tokens.css §bg2 "so bordered cards read").
const cardClass = 'mt-g4 rounded-r4 border border-border bg-bg2 p-p6'
const sectionTitleClass = 'text-caption font-semibold text-ink3'

export function PluginDetail({ plugin }: { plugin: PluginRow }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <h2 className="m-0 font-serif text-heading text-ink">{plugin.pluginId}</h2>
      <section className="mt-6">
        <h3 className={sectionTitleClass}>{tr('skills.pluginDetail.providers')}</h3>
        {plugin.providers.map((provider) => (
          <div key={provider.id} className={cardClass}>
            <div className="text-footnote font-medium text-ink">{provider.label}</div>
            <div className="mt-g2 font-mono text-caption text-ink3">
              {provider.id} · {provider.targets.join(', ')}
            </div>
          </div>
        ))}
      </section>
      <section className="mt-6">
        <h3 className={sectionTitleClass}>{tr('skills.pluginDetail.connectors')}</h3>
        {plugin.connectors.map((connector) => (
          <div key={connector.connectorId} className={cardClass}>
            <div className="flex text-footnote">
              <span className="font-medium text-ink">{connector.label}</span>
              <span className="ml-auto text-caption text-ink3">
                {connector.connected
                  ? tr('skills.pluginDetail.connectedLabel')
                  : tr('skills.pluginDetail.disconnectedLabel')}
              </span>
            </div>
            <div className="mt-g2 text-caption text-ink3">
              {tr('skills.pluginDetail.origin')}: {connector.origin}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
