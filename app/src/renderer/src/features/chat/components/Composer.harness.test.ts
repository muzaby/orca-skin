import { composerHarness } from '../harnesses/registries/composer'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { ComposerInputController } from '../harnesses/common/composer/ComposerInputController'
import { OpenCodeAgentControl } from '../harnesses/opencode/composer/Controls'
import { ComposerInputSurface } from '../harnesses/common/composer/ComposerInputSurface'
import { createDraftSnapshot } from '../harnesses/common/composer/draftSnapshot'
import { ModelMenu } from './composer/ModelMenu'
import { installChatStoreHarness } from '../store/chatStore.testHarness'
import type { AgentEnvironment } from '../../../../../shared/ipc'

vi.mock('../store/chatStore', async (original) => {
  const module = await original<typeof import('../store/chatStore')>()
  return {
    ...module,
    useChatSession: (
      selector: (state: ReturnType<typeof module.getActiveChatSession>) => unknown
    ) => selector(module.getActiveChatSession())
  }
})

describe('harness composer surface', () => {
  it.each(['claude', 'opencode'] as const)(
    'renders the %s surface around the shared editable draft',
    (backend) => {
      installChatStoreHarness({ sessionId: null, backend, agentKind: 'code' })
      const html = renderToStaticMarkup(
        createElement(ComposerInputController, {
          presentation: composerHarness(backend),
          active: true,
          initialDraft: 'my unchanged draft',
          backendLabel: backend,
          canAbort: true,
          inflight: false,
          steerBlocked: false,
          toolApprovalPending: false,
          cwd: null,
          onSend: () => true,
          onCancel: () => {},
          controlsStart:
            backend === 'opencode'
              ? createElement(OpenCodeAgentControl, { agents: [{ name: 'build' }] })
              : null,
          controlsEnd: null,
          diffRequirementSnapshot: {
            sessionKey: 's',
            sessionId: null,
            ids: [],
            revision: 0,
            anchors: []
          },
          onClearDiffRequirementsIfUnchanged: () => {}
        })
      )
      const $ = load(html)
      expect($('textarea')).toHaveLength(1)
      const input = renderToStaticMarkup(
        createElement(ComposerInputSurface, {
          appearance: composerHarness(backend).appearance,
          snapshot: createDraftSnapshot('my unchanged draft'),
          onTextChange: () => {},
          onSelectionChange: () => {},
          onCompositionChange: () => {},
          knownSkillNames: new Set<string>(),
          validFilePaths: new Set<string>()
        })
      )
      expect(load(input)('textarea').text()).toBe('my unchanged draft')
      expect($('textarea')).toHaveLength(1)
      expect($(`[data-harness="${backend}"]`)).toHaveLength(1)
      expect($('[data-component="opencode-select"][aria-haspopup="menu"]')).toHaveLength(
        backend === 'opencode' ? 1 : 0
      )
      expect(html.includes('shadow-oc-raised')).toBe(backend === 'opencode')
    }
  )
  it('shows both harness model groups for a draft and only the bound group for a session', () => {
    const agents: AgentEnvironment[] = ['claude', 'opencode'].map((adapter) => ({
      adapter,
      key: `${adapter}-local`,
      supported: true,
      models: [
        {
          alias: adapter,
          model: `${adapter}/model`,
          isCustom: true,
          isDefault: true,
          oneMillionContext: false
        }
      ]
    }))
    const render = (sessionBackend: string | null): string =>
      renderToStaticMarkup(
        createElement(ModelMenu, { agents, sessionBackend, selection: null, onPick: () => {} })
      )
    const $ = load(render(null))
    expect($('[role="menuitemradio"]')).toHaveLength(2)
    expect(render(null)).toContain('viewBox="0 0 248 248"')
    expect(render(null)).toContain('viewBox="0 0 16 20"')
    expect(render(null)).toContain('text-spinner')
    expect(render(null)).toContain('text-oc-ink')
    for (const [backend, viewBox, color, otherColor] of [
      ['claude', '0 0 248 248', 'text-spinner', 'text-oc-ink'],
      ['opencode', '0 0 16 20', 'text-oc-ink', 'text-spinner']
    ]) {
      const logo = $('[data-menu-heading]')
        .filter((_, heading) => $(heading).text() === `${backend}-local`)
        .find('svg')
      expect(logo).toHaveLength(1)
      expect(logo.attr('viewBox')).toBe(viewBox)
      expect(logo.hasClass(color)).toBe(true)
      expect(logo.hasClass(otherColor)).toBe(false)
    }
    const locked = render('opencode')
    expect(load(locked)('[role="menuitemradio"]')).toHaveLength(1)
    expect(locked).not.toContain('claude/model')
  })
})
