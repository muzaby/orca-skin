import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { afterEach, describe, expect, it } from 'vitest'
import type { DiffRequirementItem } from '../../../../../../shared/ipc'
import { i18n } from '../../../../shared/i18n'
import { ComposerPanelStackView } from '../Composer'
import { GitRowView } from './GitRow'
import { RequirementTray } from './RequirementTray'
import { ComposerInputController } from './ComposerInputController'

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

  it('RequirementTray belongs inside the input surface below GitRow and before text entry', () => {
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
        afterGitRow: null,
        composerInput: createElement(ComposerInputController, {
          active: true,
          backendLabel: 'Claude',
          canAbort: true,
          inflight: false,
          steerBlocked: false,
          toolApprovalPending: false,
          cwd: null,
          onSend: () => true,
          onCancel: () => undefined,
          diffRequirementSnapshot: {
            sessionKey: 's',
            sessionId: 's',
            ids: ['req-1'],
            revision: 1,
            anchors: [requirement.anchor]
          },
          onClearDiffRequirementsIfUnchanged: () => undefined,
          controlsStart: null,
          controlsEnd: null,
          requirementTray: createElement(RequirementTray, {
            requirements: [requirement],
            onRemove: () => undefined
          })
        })
      })
    )
    const gitRow = html.indexOf('data-surface="git-row"')
    const tray = html.indexOf('data-diff-requirement-tray="true"')
    const input = html.indexOf('data-surface="prompt"')

    expect(gitRow).toBeGreaterThan(-1)
    expect(tray).toBeGreaterThan(gitRow)
    expect(input).toBeGreaterThan(gitRow)
    expect(tray).toBeGreaterThan(input)
    const $ = load(html)
    expect($('[data-surface="prompt"] [data-diff-requirement-tray]')).toHaveLength(1)
    expect($('[data-surface="prompt"]').find('textarea')).toHaveLength(1)
    expect(html).toContain('aria-label="Diff 요구사항"')
  })
})
