import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import type { DiffRequirementItem } from '../../../../../../shared/ipc'
import { i18n } from '../../../../shared/i18n'
import { ComposerPanelStackView } from '../Composer'
import { GitRowView } from './GitRow'
import { RequirementTray } from './RequirementTray'

const requirement: DiffRequirementItem = {
  id: 'req-1',
  located: true,
  anchor: {
    sessionId: 's',
    baselineCommit: 'head-oid',
    filePath: 'src/a.ts',
    oldLine: null,
    newLine: 2,
    hunkHeader: '@@ -1,2 +1,3 @@',
    contextBefore: ['before'],
    contextAfter: ['after'],
    comment: 'wire this requirement',
    createdAt: 11
  }
}

describe('Composer requirements SSR order', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko')
  })

  it('RequirementTray sits below GitRow and above the input controller surface', () => {
    const html = renderToStaticMarkup(
      createElement(ComposerPanelStackView, {
        beforeGitRow: null,
        gitRow: createElement(GitRowView, {
          view: {
            visible: true,
            repo: 'orca-skin',
            branch: 'main',
            detached: false,
            totals: { added: 1, removed: 0 }
          },
          diffOpen: false,
          onToggleDiff: () => undefined,
          onClose: () => undefined
        }),
        requirementTray: createElement(RequirementTray, {
          requirements: [requirement],
          onRemove: () => undefined
        }),
        afterRequirementTray: null,
        composerInput: createElement('div', { 'data-surface': 'prompt' })
      })
    )
    const gitRow = html.indexOf('data-surface="git-row"')
    const tray = html.indexOf('data-diff-requirement-tray="true"')
    const input = html.indexOf('data-surface="prompt"')

    expect(gitRow).toBeGreaterThan(-1)
    expect(tray).toBeGreaterThan(gitRow)
    expect(input).toBeGreaterThan(tray)
    expect(html).toContain('aria-label="Diff 요구사항"')
  })
})
