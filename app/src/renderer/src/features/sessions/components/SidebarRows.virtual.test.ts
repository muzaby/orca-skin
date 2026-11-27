import { createElement } from 'react'
import { it } from 'vitest'
import { expectVirtualKeys } from '../../../shared/ui/virtual/rowKeys.testfixture'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../shared/ui/virtual/limits'

import { SidebarRows } from './SidebarRows'

it('keys the sidebar window by session ID', () => {
  const items = Array.from({ length: CATALOG_VIRTUALIZE_AFTER + 1 }, (_, i) => ({
    id: 'session-' + (100 - i)
  }))
  expectVirtualKeys(
    createElement(SidebarRows, { items, documentKey: 'recent', renderRow: () => null }),
    items.map((session) => session.id)
  )
})
