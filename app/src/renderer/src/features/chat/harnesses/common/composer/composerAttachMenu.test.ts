// 0259 r1 verify D1 · VP-05 — '+' 메뉴 선택이 컨트롤러 경로에서 커서 자리에 토큰을 넣고 커서를 그 뒤로
// 옮긴다. 실제 스냅샷 규칙(replaceDraftRange)으로 구동하고, 컨트롤러가 이 함수에 자기 상태를 넘기는지
// 원문으로 잠근다.
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { AttachMenuAction } from '../../../lib/attachMenuModel'
import { runAttachMenuAction, type AttachMenuActionDeps } from './composerAttachMenu'
import { createDraftSnapshot, updateDraftText, type DraftSnapshot } from './draftSnapshot'

function harness(
  initial: DraftSnapshot,
  composing = false
): {
  deps: AttachMenuActionDeps & { closeMenu: Mock; pickAttachments: Mock; focus: Mock }
  read: () => DraftSnapshot
} {
  let current = initial
  const deps = {
    closeMenu: vi.fn(),
    pickAttachments: vi.fn(),
    compositionActive: () => composing,
    snapshot: () => current,
    updateSnapshot: (update: (value: DraftSnapshot) => DraftSnapshot) => {
      current = update(current)
    },
    focus: vi.fn()
  }
  return { deps, read: () => current }
}

const at = (text: string, caret: number): DraftSnapshot =>
  updateDraftText(createDraftSnapshot(), text, caret, caret)

const sourceAt = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')

// 공통 컨트롤러에 들어오는 정책/컴포넌트의 실제 공급자까지 관측한다.
function expectPresentationWiring(): void {
  const composer = sourceAt('../../../components/Composer.tsx')
  expect(composer).toContain('const presentation = composerHarness(backend)')
  expect(composer).toMatch(/<ComposerInputController\b[\s\S]*?presentation=\{presentation\}/)
  const registry = sourceAt('../../registries/composer.ts')
  for (const harness of ['claude', 'opencode']) {
    expect(registry).toContain(
      `import { composerModule as ${harness} } from '../${harness}/composer/Module'`
    )
  }
  for (const harness of ['claude', 'opencode'])
    expect(registry).toContain(
      `${harness}: { ...${harness}, sourceIcon: sourceIcon('${harness}') }`
    )
  expect(registry).toContain("return modules[backend ?? 'claude']")
}

describe('runAttachMenuAction (AC2·AC3)', () => {
  it('puts a native command at the start, preserves the draft and only focuses the argument position', () => {
    const { deps, read } = harness(at('keep my draft', 5))
    runAttachMenuAction({ type: 'nativeCommand', name: 'native:review' }, deps)
    expect(read().text).toBe('/native:review keep my draft')
    expect(deps.focus).toHaveBeenCalledWith(15)
    expect(deps.pickAttachments).not.toHaveBeenCalled()
    expect(deps.closeMenu).toHaveBeenCalledOnce()
    const ime = harness(at('keep', 0), true)
    runAttachMenuAction({ type: 'nativeCommand', name: 'native:review' }, ime.deps)
    expect(ime.read().text).toBe('keep')
  })
  it.each([
    ['빈 입력', at('', 0), { type: 'skill', name: 'review' }, '/review ', 8],
    [
      '커서가 글자 사이 · 뒤가 공백',
      at('hello world', 5),
      { type: 'skill', name: 'r' },
      'hello /r world',
      8
    ],
    ['커서가 문장 앞', at('fix it', 0), { type: 'plugin', id: 'jira' }, '@jira fix it', 6],
    ['공백으로 끝남', at('see ', 4), { type: 'plugin', id: 'jira' }, 'see @jira ', 10]
  ] as const)(
    '%s → 커서 자리 삽입 · 커서는 토큰 뒤 · 메뉴 닫힘',
    (_, start, action, text, caret) => {
      const { deps, read } = harness(start)
      runAttachMenuAction(action as AttachMenuAction, deps)
      expect(read().text).toBe(text)
      expect(read().selectionStart).toBe(caret)
      expect(deps.focus).toHaveBeenCalledExactlyOnceWith(caret)
      expect(deps.closeMenu).toHaveBeenCalledOnce()
      expect(deps.pickAttachments).not.toHaveBeenCalled()
    }
  )

  it('파일 추가는 선택 창만 열고 입력을 바꾸지 않는다', () => {
    const { deps, read } = harness(at('keep', 4))
    runAttachMenuAction({ type: 'attach' }, deps)
    expect(deps.pickAttachments).toHaveBeenCalledOnce()
    expect(deps.closeMenu).toHaveBeenCalledOnce()
    expect(read().text).toBe('keep')
    expect(deps.focus).not.toHaveBeenCalled()
  })

  it('조합(IME) 중이면 삽입하지 않는다', () => {
    const { deps, read } = harness(at('ab', 2), true)
    runAttachMenuAction({ type: 'skill', name: 'r' }, deps)
    expect(read().text).toBe('ab')
    expect(deps.focus).not.toHaveBeenCalled()
    expect(deps.closeMenu).toHaveBeenCalledOnce()
  })

  it('컨트롤러는 메뉴 동작을 이 함수에 자기 스냅샷·갱신·포커스와 함께 넘긴다', () => {
    const source = readFileSync(new URL('./ComposerInputController.tsx', import.meta.url), 'utf8')
    expect(source.match(/runAttachMenuAction\(action, \{/g)).toHaveLength(1)
    // r2 verify D5 — 넘기는 의존성 6개 전부를 원문 그대로 잠근다(파일 추가 경로 포함).
    expect(source).toContain(
      [
        '    runAttachMenuAction(action, {',
        '      closeMenu: () => setAttachMenuOpen(false),',
        '      pickAttachments: () => void pickAttachments(),',
        '      compositionActive: () => compositionActive(),',
        '      snapshot: () => snapshotRef.current,',
        '      updateSnapshot,',
        '      focus',
        '    })'
      ].join('\n')
    )
    expect(source).toContain('onAction={onAttachMenuAction}')
    // r3 verify D6·D7 — 메뉴 데이터 = `/` 자동완성과 같은 useSkills 전체 · `@` 훅의 전체 후보(D-006).
    expect(source.match(/const availableSkills = useSkills\(\)/g)).toHaveLength(1)
    expectPresentationWiring()
    expect(source).toMatch(
      /const \{[^}]*\bincludeSkills\b[^}]*\bincludeManagedMcp\b[^}]*\} = presentation/
    )
    // Candidate membership is exercised through Composer.native-menu.test and composerSkills.test.
    expect(sourceAt('../../claude/composer/Module.tsx')).toContain('includeSkills: true')
    expect(sourceAt('../../opencode/composer/Module.tsx')).toContain('includeSkills: false')
    for (const harness of ['claude', 'opencode'])
      expect(sourceAt(`../../${harness}/composer/Module.tsx`)).toContain('includeManagedMcp: true')
    expect(source).toContain(
      [
        '        skills={availableSkills}',
        '        sourceIcon={presentation.sourceIcon}',
        '        includeSkills={includeSkills}',
        '        includeManagedMcp={includeManagedMcp}',
        '        plugins={mentionAutocomplete.plugins}',
        '        native={nativeMenu}',
        '        onAction={onAttachMenuAction}'
      ].join('\n')
    )
  })

  // r5 verify D9 — VP-01 path 첫 edge('+' → AttachMenu): 칩이 메뉴를 열고, 컨트롤러가 열림·앵커('+' 칩)·
  // 닫기를 넘긴다. 그 아래(AttachMenu → CascadeMenu → 선택)는 attachMenu.flow.test.ts 가 실행해 본다.
  it("'+' 칩이 메뉴를 열고 닫으며 컨트롤러가 AttachMenu 에 열림·앵커·닫기를 넘긴다", () => {
    const source = readFileSync(new URL('./ComposerInputController.tsx', import.meta.url), 'utf8')
    expect(source.match(/const attachButtonRef = useRef<HTMLButtonElement>\(null\)/g)).toHaveLength(
      1
    )
    expectPresentationWiring()
    expect(source).toMatch(/const \{[^}]*\bChip\b[^}]*\} = presentation/)
    for (const [harness, chipPath] of [
      ['claude', '../../common/composer/ComposerChip'],
      ['opencode', './Chip']
    ] as const) {
      const module = sourceAt(`../../${harness}/composer/Module.tsx`)
      expect(module).toContain(`import { ComposerChip } from '${chipPath}'`)
      expect(module).toContain('Chip: ComposerChip')
    }
    expect(source).toContain(
      [
        '              <Chip',
        '                ref={attachButtonRef}',
        '                icon="plus"',
        '                onClick={() => setAttachMenuOpen((value) => !value)}',
        '                ariaHasPopup',
        '                ariaExpanded={attachMenuOpen}',
        "                title={tr('chat.composer.attachMenuTitle')}",
        '              />'
      ].join('\n')
    )
    expect(source).toContain(
      [
        '      <AttachMenu',
        '        open={active && attachMenuOpen}',
        '        anchorRef={attachButtonRef}',
        '        onClose={() => setAttachMenuOpen(false)}',
        '        skills={availableSkills}',
        '        sourceIcon={presentation.sourceIcon}',
        '        includeSkills={includeSkills}',
        '        includeManagedMcp={includeManagedMcp}',
        '        plugins={mentionAutocomplete.plugins}',
        '        native={nativeMenu}',
        '        onAction={onAttachMenuAction}',
        '        onManagePlugins={',
        '          onManagePlugins',
        '            ? () => {',
        '                setAttachMenuOpen(false)',
        '                onManagePlugins()',
        '              }',
        '            : undefined',
        '        }',
        '      />'
      ].join('\n')
    )
  })
})
