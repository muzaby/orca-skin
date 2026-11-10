import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { load } from 'cheerio'
import { SkillDetail } from './SkillDetail'
import type { SkillInfo } from '../../../../../../shared/ipc'

it('renders no switch for default-path skills', () => {
  for (const sourceId of ['orcinus-orca', 'agents', 'adapter:claude', 'adapter:opencode']) {
    const skill: SkillInfo = {
      name: 'review',
      sourceId,
      sourceLabel: sourceId,
      sourceKind: sourceId === 'orcinus-orca' ? 'orcinus-orca' : 'adapter',
      enabled: true,
      canToggle: sourceId === 'orcinus-orca',
      canRemove: false,
      description: '',
      body: '',
      skillDir: '/fixture',
      skillPath: '/fixture/SKILL.md'
    }
    const $ = load(
      renderToStaticMarkup(
        createElement(SkillDetail, {
          skill,
          onToggle: vi.fn(),
          onTryInChat: vi.fn(),
          onOpenDefault: vi.fn(),
          onShowInFolder: vi.fn(),
          onRemove: vi.fn(async () => {})
        })
      )
    )
    expect($('[role=switch]')).toHaveLength(sourceId === 'orcinus-orca' ? 1 : 0)
    expect($('h2').hasClass('text-ink3')).toBe(false)
  }
})
