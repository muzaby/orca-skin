import { Icon } from '../../../../shared/ui/Icon'
import { Dot } from '../../../../shared/ui/Status'
import type { McpServer } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'

export function McpDetail({
  server,
  onToggle
}: {
  server: McpServer
  onToggle: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const summary =
    server.transport === 'http'
      ? server.url
      : [server.command, ...server.args].filter(Boolean).join(' ')
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-r4 bg-bg2 text-ink2">
          <Icon name={server.transport === 'http' ? 'link' : 'cpu'} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 font-serif text-[20px] font-semibold text-ink">{server.name}</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink3">
            <span className="font-mono uppercase">{server.transport}</span>
            <span>·</span>
            <Dot tone={server.enabled ? 'green' : 'slate'} />
            <span>
              {server.enabled ? tr('skills.mcpDetail.active') : tr('skills.mcpDetail.inactive')}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`ml-auto cursor-pointer rounded-r4 border px-3.5 py-1.5 text-[12.5px] font-medium ${
            server.enabled
              ? 'border-border bg-panel text-ink2 hover:bg-fill-uncontained-hover'
              : 'border-0 bg-ink text-bg hover:bg-t8'
          }`}
        >
          {server.enabled ? tr('skills.mcpDetail.disable') : tr('skills.mcpDetail.enable')}
        </button>
      </div>
      <p className="mt-4 text-[13.5px] leading-[1.65] text-ink2">
        {server.description || summary || tr('common.noDescription')}
      </p>
      <div className="mt-5 rounded-r5 border border-border bg-panel p-4 text-[12.5px]">
        <div className="mb-2 text-[11.5px] text-ink3">{tr('skills.mcpDetail.configSummary')}</div>
        <pre className="m-0 whitespace-pre-wrap break-all font-mono text-ink2">
          {JSON.stringify(
            server.transport === 'http'
              ? { url: server.url, authEnvKey: server.authEnvKey }
              : { command: server.command, args: server.args, authEnvKey: server.authEnvKey },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  )
}
