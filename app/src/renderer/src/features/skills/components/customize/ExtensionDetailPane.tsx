import type { ReactNode } from 'react'
import { DetailSidePane } from '../../../../shared/ui/DetailSidePane'
import type { CatalogTab } from '../../lib/catalogSelection'

// 플러그인 카탈로그의 상세 패널 — 공용 셸에 탭·항목 표식만 얹는다.
export function ExtensionDetailPane({
  tab,
  itemId,
  title,
  width,
  expanded,
  onWidthChange,
  onExpandedChange,
  onClose,
  children
}: {
  tab: CatalogTab
  itemId: string
  title: string
  width: number
  expanded: boolean
  onWidthChange: (width: number) => void
  onExpandedChange: (expanded: boolean) => void
  onClose: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <DetailSidePane
      lifecycleKey={`${tab}:${itemId}`}
      title={title}
      width={width}
      expanded={expanded}
      onWidthChange={onWidthChange}
      onExpandedChange={onExpandedChange}
      onClose={onClose}
      markers={{ 'data-extension-detail-panel': tab, 'data-extension-detail-id': itemId }}
      behavior="extension-detail"
    >
      {children}
    </DetailSidePane>
  )
}
