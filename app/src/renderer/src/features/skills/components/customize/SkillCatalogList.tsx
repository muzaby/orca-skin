import { useMemo, type RefObject } from 'react'
import type { SkillInfo } from '../../../../../../shared/ipc'
import { extensionSourceLabels } from '../../../../../../shared/extension-sources'
import { formatDateMedium, useI18n } from '../../../../shared/i18n'
import { CatalogListRow } from '../../../../shared/ui/CatalogListRow'
import { Icon } from '../../../../shared/ui/Icon'
import {
  VirtualCatalogList,
  type CatalogRowPosition
} from '../../../../shared/ui/virtual/VirtualCatalogList'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../../shared/ui/virtual/limits'
import { orderSkills } from '../../lib/catalogOrder'
import { skillRowMeta } from '../../lib/catalogRows'
import { SourceHeading } from './SourceHeading'
import { CatalogToggle } from './CatalogToggle'

type Row = { id: string; skill: SkillInfo } | { id: string; source: string; spaced: boolean }
const rowKey = (row: Row): string => row.id
export function SkillCatalogList({
  skills,
  owner,
  selectedId,
  onSelect,
  onSkillToggle
}: {
  skills: SkillInfo[]
  owner?: RefObject<HTMLDivElement | null>
  selectedId?: string | null
  onSelect: (id: string, origin: HTMLButtonElement) => void
  onSkillToggle?: (skill: SkillInfo) => void | Promise<void>
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  const rows = useMemo(() => {
    const result: Row[] = []
    let previous: string | undefined
    for (const skill of orderSkills(skills)) {
      if (previous !== skill.sourceId) {
        result.push({
          id: 'heading:' + skill.sourceId,
          source: skill.sourceId,
          spaced: result.length > 0
        })
        previous = skill.sourceId
      }
      result.push({ id: skill.sourceId + '/' + skill.name, skill })
    }
    return result
  }, [skills])
  const render = (row: Row, position?: CatalogRowPosition): React.JSX.Element => {
    if ('source' in row)
      return (
        <SourceHeading
          key={row.id}
          position={position}
          spaced={row.spaced}
          source={row.source}
          label={extensionSourceLabels[row.source]}
        />
      )
    const { skill, id } = row
    const meta = skillRowMeta(skill)
    return (
      <CatalogListRow
        key={id}
        {...position}
        data-extensions-row={id}
        selected={selectedId === id}
        openProps={{ onClick: (event) => onSelect(id, event.currentTarget) }}
        icon={<Icon name="doc" size={20} className="shrink-0 text-ink3" />}
        title={
          <span className="truncate" title={skill.name}>
            {skill.name}
          </span>
        }
        trailing={
          <span className="hidden shrink-0 text-caption text-ink3 @[560px]/catalog:block">
            {meta.updatedAtMs === null
              ? tr('common.unknown')
              : formatDateMedium(meta.updatedAtMs, locale)}
          </span>
        }
        actions={
          skill.canToggle ? (
            <CatalogToggle
              name={skill.name}
              enabled={skill.enabled}
              canToggle={skill.canToggle}
              onToggle={() => onSkillToggle?.(skill)}
            />
          ) : undefined
        }
      />
    )
  }
  if (owner && rows.length > CATALOG_VIRTUALIZE_AFTER)
    return (
      <VirtualCatalogList
        owner={owner}
        items={rows}
        documentKey="extension-skills"
        keyOf={rowKey}
        renderRow={render}
      />
    )
  return (
    <ul className="@container/catalog m-0 list-none divide-y divide-border p-0">
      {rows.map((row) => render(row))}
    </ul>
  )
}
