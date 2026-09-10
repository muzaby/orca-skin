import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../../shared/ipc'
import { formatDateMedium, useI18n } from '../../../../shared/i18n'
import { CatalogListRow } from '../../../../shared/ui/CatalogListRow'
import { Icon } from '../../../../shared/ui/Icon'
import type { CatalogTab } from '../../lib/catalogSelection'
import { mcpRowMeta, skillRowMeta } from '../../lib/catalogRows'
import { providerRowMeta } from '../../lib/providerRows'
import { mcpGroups, providerGroups, skillGroups } from '../../lib/catalogGroups'

export function CustomizeList({
  tab,
  skills,
  mcpServers,
  providers,
  selectedId,
  onSelect
}: {
  tab: CatalogTab
  skills: SkillInfo[]
  mcpServers: McpServer[]
  providers: ProviderInfo[]
  selectedId?: string | null
  onSelect: (id: string, origin: HTMLButtonElement) => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  const rows = tab === 'skills' ? skills : tab === 'mcp' ? mcpServers : providers
  const emptyKey =
    tab === 'skills'
      ? 'skills.table.noSkills'
      : tab === 'mcp'
        ? 'skills.table.noMcp'
        : 'skills.table.noProviders'

  if (rows.length === 0)
    return (
      <div role="status" className="grid h-48 place-items-center text-footnote text-ink3">
        {tr(emptyKey)}
      </div>
    )

  return (
    <ul className="@container/catalog m-0 list-none divide-y divide-border p-0">
      {tab === 'skills' &&
        skillGroups(skills).flatMap((group) =>
          group.rows.map((skill) => {
            const meta = skillRowMeta(skill)
            const id = `${skill.sourceId}/${skill.name}`
            const author =
              meta.author === 'skills.table.user'
                ? `${tr(meta.author)} · ${skill.sourceLabel}`
                : meta.author
            return (
              <CatalogListRow
                key={id}
                data-extensions-row={id}
                selected={selectedId === id}
                openProps={{ onClick: (event) => onSelect(id, event.currentTarget) }}
                icon={<Icon name="doc" size={20} className="shrink-0 text-ink3" />}
                title={
                  <span
                    className={`truncate ${skill.enabled ? '' : 'text-ink3'}`}
                    title={skill.name}
                  >
                    {skill.name}
                  </span>
                }
                detail={
                  <span className="truncate text-caption text-ink3" title={author}>
                    {author}
                  </span>
                }
                trailing={
                  <span className="hidden shrink-0 text-caption text-ink3 @[560px]/catalog:block">
                    {meta.updatedAtMs === null
                      ? tr('common.unknown')
                      : formatDateMedium(meta.updatedAtMs, locale)}
                  </span>
                }
              />
            )
          })
        )}
      {tab === 'mcp' &&
        mcpGroups(mcpServers).flatMap((group) =>
          group.rows.map((server) => {
            const meta = mcpRowMeta(server)
            return (
              <CatalogListRow
                key={server.id}
                data-extensions-row={server.id}
                selected={selectedId === server.id}
                openProps={{ onClick: (event) => onSelect(server.id, event.currentTarget) }}
                icon={
                  <Icon
                    name={server.transport === 'http' ? 'link' : 'cpu'}
                    size={20}
                    className="shrink-0 text-ink3"
                  />
                }
                title={
                  <span className="truncate" title={server.name}>
                    {server.name}
                  </span>
                }
                detail={
                  <span className="truncate text-caption uppercase text-ink3">
                    {meta.transport}
                  </span>
                }
                trailing={
                  <span className="shrink-0 text-caption text-ink3">{tr(meta.statusKey)}</span>
                }
              />
            )
          })
        )}
      {tab === 'providers' &&
        providerGroups(providers).flatMap((group) =>
          group.rows.map((provider) => {
            const meta = providerRowMeta(provider)
            const detail = `${tr(meta.kindKey)} · ${meta.activeLabel ?? tr('common.unknown')}`
            return (
              <CatalogListRow
                key={provider.id}
                data-extensions-row={provider.id}
                selected={selectedId === provider.id}
                openProps={{ onClick: (event) => onSelect(provider.id, event.currentTarget) }}
                icon={<Icon name="power" size={20} className="shrink-0 text-ink3" />}
                title={
                  <span className="truncate" title={provider.label}>
                    {provider.label}
                  </span>
                }
                detail={
                  <span className="truncate text-caption text-ink3" title={detail}>
                    {detail}
                  </span>
                }
                trailing={
                  <span className="shrink-0 text-caption text-ink3">{tr(meta.statusKey)}</span>
                }
              />
            )
          })
        )}
    </ul>
  )
}
