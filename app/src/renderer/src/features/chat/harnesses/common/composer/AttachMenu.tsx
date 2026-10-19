import { useMemo, type RefObject } from 'react'
import { CascadeMenu } from '../../../../../shared/ui/CascadeMenu'
import { useI18n } from '../../../../../shared/i18n'
import type { SkillInfo } from '../../../../../../../shared/ipc'
import {
  buildAttachMenu,
  nativeAttachItems,
  type AttachMenuAction
} from '../../../lib/attachMenuModel'
import type { PluginMention } from '../../../lib/pluginMention'
import type { NativeResourcesView } from '../../../hooks/useNativeResources'
import { nativeResourcesNotice } from '../../../lib/nativeResourcesMenu'

interface AttachMenuProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  skills: readonly SkillInfo[]
  plugins: readonly PluginMention[]
  onAction: (action: AttachMenuAction) => void
  /** '플러그인 관리' — 페이지가 주입한다(0259 D-010). 없으면 그 항목을 그리지 않는다. */
  onManagePlugins?: () => void
  includeExtensions?: boolean
  native?: { label: string; view: NativeResourcesView }
}

// 컴포저 '+' 메뉴(0259) — 파일 추가 / 스킬 ▸(출처 ▸ 스킬) / 플러그인 ▸(목록 · 관리).
export function AttachMenu({
  open,
  anchorRef,
  onClose,
  skills,
  plugins,
  onAction,
  onManagePlugins,
  includeExtensions = true,
  native
}: AttachMenuProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const notice = native && nativeResourcesNotice(native.view)
  const items = useMemo(() => {
    const nativeItems = (kind: 'skills' | 'mcp'): ReturnType<typeof nativeAttachItems> =>
      nativeAttachItems(
        native!.view,
        {
          loading: tr('chat.nativeResources.loading'),
          error: tr('chat.nativeResources.error'),
          partial: tr('chat.nativeResources.partial'),
          notice: notice ? tr(notice) : undefined,
          noCommands: tr('chat.nativeResources.noCommands'),
          useMcp: (name) => tr('chat.nativeResources.useMcp', { name }),
          resourceStatus: (status) => tr(`chat.nativeResources.${status}`)
        },
        kind
      )
    return buildAttachMenu({
      skills,
      plugins,
      canManagePlugins: !!onManagePlugins,
      includeExtensions,
      native: native
        ? {
            label: native.label,
            items: nativeItems('mcp'),
            skills: nativeItems('skills')
          }
        : undefined,
      labels: {
        addFiles: tr('chat.composer.attachMenu.addFiles'),
        skills: tr('chat.composer.attachMenu.skills'),
        plugins: tr('chat.composer.attachMenu.plugins'),
        managePlugins: tr('chat.composer.attachMenu.managePlugins'),
        noSkills: tr('chat.composer.attachMenu.noSkills'),
        noPlugins: tr('chat.composer.attachMenu.noPlugins')
      }
    })
  }, [skills, plugins, onManagePlugins, includeExtensions, native, notice, tr])
  return (
    <CascadeMenu
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      items={items}
      ariaLabel={tr('chat.composer.attachMenuTitle')}
      closeOnSelect={false}
      onSelect={(action) => {
        if (action.type === 'managePlugins') onManagePlugins?.()
        else onAction(action)
        onClose()
      }}
    />
  )
}
