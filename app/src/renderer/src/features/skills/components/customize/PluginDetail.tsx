import { useI18n } from '../../../../shared/i18n'
import type { PluginRow } from '../../lib/pluginCatalog'

export function PluginDetail({ plugin }: { plugin: PluginRow }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <h2 className="m-0 font-serif text-[20px] font-semibold text-ink">{plugin.pluginId}</h2>
      <section className="mt-6">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink3">
          {tr('skills.pluginDetail.providers')}
        </h3>
        {plugin.providers.map((provider) => (
          <div key={provider.id} className="mt-2 rounded-r4 border border-border bg-panel p-3">
            <div className="font-medium text-ink">{provider.label}</div>
            <div className="mt-1 font-mono text-[11px] text-ink3">
              {provider.id} · {provider.targets.join(', ')}
            </div>
          </div>
        ))}
      </section>
      <section className="mt-6">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink3">
          {tr('skills.pluginDetail.connectors')}
        </h3>
        {plugin.connectors.map((connector) => (
          <div
            key={connector.connectorId}
            className="mt-2 rounded-r4 border border-border bg-panel p-3"
          >
            <div className="flex">
              <span className="font-medium text-ink">{connector.label}</span>
              <span className="ml-auto text-[11px] text-ink3">
                {connector.connected
                  ? tr('skills.pluginDetail.connectedLabel')
                  : tr('skills.pluginDetail.disconnectedLabel')}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-ink3">
              {tr('skills.pluginDetail.origin')}: {connector.origin}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
