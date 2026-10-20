// 0259 AC1·AC5·AC7·AC9·AC10 — '+' 메뉴 렌더 · 하위 패널 위치(DOM 포함 관계) · 자동완성 헤더.
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// Popover 는 body 포털이라 서버 렌더가 못 그린다 — 열린 상태의 내용만 그대로 그린다.
vi.mock('../../../../../shared/ui/Popover', () => ({
  Popover: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement('div', { 'data-popover': '' }, children) : null
}))
vi.mock('./AnchoredDropdown', () => ({
  AnchoredDropdown: ({ children }: { children: ReactNode }) => createElement('div', null, children)
}))

import { AttachMenu } from './AttachMenu'
import { SkillAutocomplete } from './SkillAutocomplete'
import { CascadeBody } from '../../../../../shared/ui/CascadeMenu'
import { buildAttachMenu } from '../../../lib/attachMenuModel'
import type { SkillInfo } from '../../../../../../../shared/ipc'

const skills = [
  { name: 'a', sourceId: 'orca', sourceLabel: 'Orcinus orca 스킬', description: '설명 A' },
  { name: 'c', sourceId: 'adapter:claude', sourceLabel: 'CLAUDE 스킬', description: '' }
] as SkillInfo[]
const plugins = [{ kind: 'plugin' as const, id: 'jira', label: 'Jira' }]

describe('AttachMenu 렌더', () => {
  it('최상위 4행 · 하위 표시 · 하위는 닫힌 채 시작 (AC1)', () => {
    const html = renderToStaticMarkup(
      createElement(AttachMenu, {
        open: true,
        anchorRef: { current: null },
        onClose: vi.fn(),
        skills,
        plugins,
        onAction: vi.fn(),
        onManagePlugins: vi.fn()
      })
    )
    expect(html).toContain('파일 또는 사진 추가')
    expect(html).toContain('viewBox="0 0 24 24"')
    expect(html).toContain('role="separator"')
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(2)
    expect(html).not.toContain('Orcinus orca 스킬')
  })

  it('열린 경로의 하위 패널은 최상위 메뉴 DOM 안에 그려지고 항목에 hover 설명 title 이 있다 (AC5·AC7)', () => {
    const items = buildAttachMenu({
      skills,
      plugins,
      canManagePlugins: true,
      labels: {
        addFiles: 'add',
        skills: 'skills',
        plugins: 'plugins',
        managePlugins: 'manage',
        noSkills: 'none',
        noPlugins: 'none'
      }
    })
    const html = renderToStaticMarkup(
      createElement(CascadeBody, {
        items,
        onSelect: vi.fn(),
        onClose: vi.fn(),
        anchorRef: { current: null },
        initialState: { open: [2], focus: null }
      })
    )
    // 루트 안에 스킬 패널 하나만 중첩된다. 출처 제목은 추가 패널을 열지 않는다.
    expect(html.startsWith('<div role="menu"')).toBe(true)
    expect(html.match(/role="menu"/g)).toHaveLength(2)
    expect(html).toContain('title="설명 A\nOrcinus orca 스킬"')
    expect(html).toContain('aria-expanded="true"')
  })
})

describe('자동완성 정돈 (AC9·AC10)', () => {
  it('/ 후보가 출처 헤더 아래 묶이고 활성 인덱스가 화면 순서와 같다', () => {
    const html = renderToStaticMarkup(
      createElement(SkillAutocomplete, {
        open: true,
        anchorRef: { current: null },
        suggestions: skills,
        activeIndex: 1,
        onHover: vi.fn(),
        onPick: vi.fn()
      })
    )
    const orca = html.indexOf('Orcinus orca 스킬')
    const claude = html.indexOf('CLAUDE 스킬')
    expect(orca).toBeGreaterThan(-1)
    expect(claude).toBeGreaterThan(orca)
    expect(html.indexOf('/a')).toBeGreaterThan(orca)
    expect(html.indexOf('/c')).toBeGreaterThan(claude)
    expect(html).toMatch(/aria-selected="true"[^>]*data-index="1"/)
  })

  it('/ 와 @ 헤더가 같은 컴포넌트를 쓴다', () => {
    for (const file of ['./SkillAutocomplete.tsx', './MentionAutocomplete.tsx'])
      expect(readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')).toContain(
        '<AutocompleteSectionHeader'
      )
  })
})

describe('플러그인 관리 배선 (AC3 · W1)', () => {
  const read = (rel: string): string =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  it("페이지 5자리가 navigate('/plugins') 를 만들고 랜딩·대화 중계를 통해 넘긴다", () => {
    const count = (src: string, needle: string): number => src.split(needle).length - 1
    expect(
      count(
        read('../../../../../pages/ChatPage.tsx'),
        "onManagePlugins={() => navigate('/plugins')}"
      )
    ).toBe(1)
    const landing = read('../../../../../pages/NewChatLandingPage.tsx')
    expect(landing).toContain("navigate('/plugins')")
    // 빈 대화는 Landing의 props 객체, 대화 시작 후에는 ChatTile의 직접 prop으로 전달한다.
    expect(landing).toMatch(/<Landing\b[\s\S]*?composerProps=\{\{[^}]*\bonManagePlugins\s*,/)
    expect(count(landing, 'onManagePlugins={onManagePlugins}')).toBe(1)
    const landingRelay = read('../../../components/Landing.tsx')
    expect(landingRelay).toMatch(/<Composer\s+\{\.\.\.composerProps\}/)
    expect(
      count(
        read('../../../../../pages/ProjectLandingPage.tsx'),
        "onManagePlugins={() => navigate('/plugins')}"
      )
    ).toBe(2)
    for (const relay of [
      '../../../components/ChatView.tsx',
      '../../../components/ChatTile.tsx',
      '../../../components/Composer.tsx'
    ])
      expect(read(relay)).toContain('onManagePlugins={onManagePlugins}')
    expect(read('./ComposerInputController.tsx')).toContain('onManagePlugins()')
  })
})
