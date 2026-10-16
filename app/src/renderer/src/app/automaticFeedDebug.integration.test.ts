import { createElement, Fragment, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OverlayLayer } from './OverlayLayer'
import { TranscriptView } from '../features/chat/components/transcript/TranscriptView'
import { AutomaticFeedDebugSection } from '../features/chat/components/AutomaticFeedDebugSection'
import {
  getAutomaticFeedVisibility,
  setAutomaticFeedVisibility
} from '../features/chat/store/automaticFeedDebug'
import {
  harnessSession,
  installChatStoreHarness
} from '../features/chat/store/chatStore.testHarness'
import { ingestChatEvent } from '../features/chat/store/chatStore'
import { chatReducer, initialChatState, type Message } from '../features/chat/reducer/chatReducer'
import type { AgentKind } from '../../../shared/agent-kind'
import type { Backend } from '../../../shared/ipc'

const captured = vi.hoisted(() => ({
  button: null as ReactElement<{ onClick: () => void }> | null
}))
// Capture only the actual native button handler. The app slot, DebugPanel and
// section render unchanged; assertions observe both production Timelines.
vi.mock('../features/chat/components/AutomaticFeedDebugSection', async (original) => {
  const actual =
    await original<typeof import('../features/chat/components/AutomaticFeedDebugSection')>()
  return {
    AutomaticFeedDebugSection: () => {
      const element = actual.AutomaticFeedDebugSection()
      captured.button = element
      return element
    }
  }
})
vi.mock('../features/backend', () => ({
  useInstallerOpen: () => false,
  InstallerDialog: () => null,
  AuthExpiredModal: () => null,
  backendActions: { setInstallerOpen: vi.fn(), refresh: vi.fn() }
}))
vi.mock('../features/sessions', () => ({ SearchModal: () => null }))
vi.mock('../features/update', () => ({
  useUpdateDialogOpen: () => false,
  UpdateDialog: () => null,
  UpdateDebugSection: () => null
}))
vi.mock('../features/providers', () => ({ ProviderDebugSection: () => null }))
vi.mock('../shared/ui/ConfirmDialogHost', () => ({ ConfirmDialogHost: () => null }))
vi.mock('../shared/theme', () => ({
  useTweakContext: () => ({ t: { theme: 'white', sidebarCollapsed: false }, setTweak: vi.fn() })
}))
vi.mock('../features/chat/hooks/useTranscriptVirtualizer', () => ({
  useTranscriptVirtualizer: (items: unknown[]) => ({
    getVirtualItems: () => items.map((_, index) => ({ index, start: index * 100 })),
    getTotalSize: () => items.length * 100,
    measureElement: vi.fn()
  })
}))
vi.mock('@tanstack/react-virtual', async (original) => {
  const module = await original<typeof import('@tanstack/react-virtual')>()
  return {
    ...module,
    useVirtualizer: (options: Parameters<typeof module.useVirtualizer>[0]) =>
      module.useVirtualizer({ ...options, initialRect: { width: 1200, height: 10000 } })
  }
})

beforeEach(() => {
  vi.stubEnv('DEV', true)
  setAutomaticFeedVisibility(false)
  captured.button = null
})
afterEach(() => {
  vi.stubEnv('DEV', true)
  setAutomaticFeedVisibility(false)
  vi.unstubAllEnvs()
})

function render(
  backend: Backend,
  agentKind: AgentKind,
  messages: Message[]
): ReturnType<typeof load> {
  captured.button = null
  return load(
    renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          Fragment,
          null,
          createElement(OverlayLayer, { searchOpen: false, onCloseSearch: () => {} }),
          createElement(TranscriptView, {
            backend,
            agentKind,
            messages,
            pendingSteer: [],
            inflight: false,
            loadingSession: false,
            anchored: false,
            scrollRef: { current: null },
            contentRef: { current: null },
            onScroll: () => {}
          })
        )
      )
    )
  )
}

const cases = [
  { backend: 'claude', agentKind: 'code' },
  { backend: 'claude', agentKind: 'work' },
  { backend: 'opencode', agentKind: 'code' }
] as const

describe('DEV app slot → automatic feed button → production transcript', () => {
  it.each(cases)(
    '$backend/$agentKind preserves mixed human text and attachments without empty metadata rows',
    ({ backend, agentKind }) => {
      installChatStoreHarness({ backend, agentKind })
      const reminder: Message = {
        role: 'user',
        createdAt: 100,
        parts: [
          {
            type: 'text',
            text: '<system-reminder>mixed hidden reminder</system-reminder>',
            origin: { kind: 'automatic' }
          }
        ]
      }
      const mixed: Message = {
        role: 'user',
        createdAt: 200,
        parts: [
          ...reminder.parts,
          { type: 'text', text: 'human mixed text' },
          {
            type: 'text',
            text: 'mixed automatic completion',
            origin: { kind: 'task', format: 'plain' }
          },
          {
            type: 'attachment',
            attachments: [
              { id: 'file', name: 'sample.md', kind: 'file', mimeType: 'text/markdown' }
            ]
          }
        ]
      }
      const messages = [reminder, mixed]
      const original = structuredClone(messages)
      for (const visible of [false, true, false]) {
        setAutomaticFeedVisibility(visible)
        const html = render(backend, agentKind, messages)
        const transcript = html('.app-frame-transcript')
        expect(transcript.text()).toContain('human mixed text')
        expect(transcript.find('[title="sample.md"]')).toHaveLength(1)
        expect(transcript.text().includes('mixed hidden reminder')).toBe(visible)
        expect(transcript.text().includes('mixed automatic completion')).toBe(visible)
        expect(transcript.find('.font-mono.text-caption.tabular-nums')).toHaveLength(1)
        const empty = render(backend, agentKind, [reminder])
        expect(empty('.app-frame-transcript .font-mono.text-caption.tabular-nums')).toHaveLength(
          visible ? 1 : 0
        )
      }
      expect(messages).toEqual(original)
    }
  )

  it.each(cases)(
    '$backend/$agentKind toggles live and reloaded automatic bubbles without sending or changing history',
    ({ backend, agentKind }) => {
      const { chatSend, settingsSet } = installChatStoreHarness({ backend, agentKind })
      const inputs = [
        {
          text: '<system-reminder>hidden reminder</system-reminder>',
          origin: { kind: 'automatic' as const, format: 'system-reminder' as const }
        },
        {
          text: '<system-reminder>legacy hidden reminder</system-reminder>',
          origin: { kind: 'automatic' as const }
        },
        {
          text: '<task-notification>automatic completion</task-notification>',
          origin: { kind: 'task' as const, format: 'tagged' as const }
        },
        {
          text: 'automatic plain feed',
          origin: { kind: 'scheduled' as const, format: 'plain' as const }
        },
        { text: '<system-reminder>human XML stays</system-reminder>' }
      ]
      for (const [index, input] of inputs.entries())
        ingestChatEvent({
          type: 'message.committed',
          sessionId: 's',
          ids: [`feed-${index}`],
          messageId: index + 1,
          createdAt: index + 1,
          ...input
        })
      ingestChatEvent({
        type: 'message.completed',
        sessionId: 's',
        message: { text: 'normal assistant answer' }
      })
      const messages = harnessSession().messages
      const original = structuredClone(messages)
      const loaded = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: { id: 's', backend, agentKind, title: null, messages: structuredClone(messages) }
      })
      for (const source of [messages, loaded.messages]) {
        let html = render(backend, agentKind, source)
        expect(html('#app-frame-debug button[aria-pressed="false"]').text()).toBe('자동 피드 표시')
        expect(html('.app-frame-transcript').text()).not.toContain('automatic completion')
        expect(html('.app-frame-transcript').text()).not.toContain('hidden reminder')
        expect(html('.app-frame-transcript [data-message-origin]')).toHaveLength(0)
        expect(captured.button).not.toBeNull()
        captured.button!.props.onClick()
        html = render(backend, agentKind, source)
        expect(html('#app-frame-debug button[aria-pressed="true"]').text()).toBe('자동 피드 표시')
        const transcript = html('.app-frame-transcript').text()
        expect(transcript).toContain('<task-notification>automatic completion</task-notification>')
        expect(transcript).toContain('automatic plain feed')
        expect(transcript).toContain('<system-reminder>human XML stays</system-reminder>')
        expect(transcript).toContain('normal assistant answer')
        expect(transcript).toContain('<system-reminder>hidden reminder</system-reminder>')
        expect(transcript).toContain('<system-reminder>legacy hidden reminder</system-reminder>')
        expect(html('.app-frame-transcript [data-message-origin]')).toHaveLength(4)
        // Session navigation does not reset this process-local DEV setting.
        render(backend, agentKind, [])
        expect(getAutomaticFeedVisibility()).toBe(true)
        html = render(backend, agentKind, source)
        expect(html('.app-frame-transcript').text()).toContain('automatic completion')
        captured.button!.props.onClick()
        html = render(backend, agentKind, source)
        expect(html('.app-frame-transcript').text()).not.toContain('automatic completion')
        expect(html('.app-frame-transcript').text()).not.toContain('hidden reminder')
        expect(html('#app-frame-debug').text()).toContain('Mock 모드')
        expect(html('#app-frame-debug').text()).toContain('로그')
      }
      expect(messages).toEqual(original)
      expect(loaded.messages).toEqual(
        original.map(({ role, parts, createdAt }) => ({ role, parts, createdAt }))
      )
      expect(chatSend).not.toHaveBeenCalled()
      expect(settingsSet).not.toHaveBeenCalled()
    }
  )

  it.each(cases)(
    '$backend/$agentKind cannot expose feeds or the button in production',
    ({ backend, agentKind }) => {
      installChatStoreHarness({ backend, agentKind })
      setAutomaticFeedVisibility(true)
      vi.stubEnv('DEV', false)
      setAutomaticFeedVisibility(true)
      const messages: Message[] = [
        {
          role: 'user',
          createdAt: 1,
          parts: [
            {
              type: 'text',
              text: 'production automatic feed',
              origin: { kind: 'automatic', format: 'plain' }
            },
            {
              type: 'text',
              text: '<system-reminder>production reminder</system-reminder>',
              origin: { kind: 'automatic', format: 'system-reminder' }
            },
            {
              type: 'text',
              text: '<system-reminder>production legacy reminder</system-reminder>',
              origin: { kind: 'automatic' }
            }
          ]
        }
      ]
      const html = render(backend, agentKind, messages)
      expect(html('#app-frame-debug').text()).toBe('')
      expect(html('.app-frame-transcript').text()).not.toContain('production automatic feed')
      expect(html('.app-frame-transcript').text()).not.toContain('production reminder')
      expect(html('.app-frame-transcript').text()).not.toContain('production legacy reminder')
      expect(html('.app-frame-transcript [data-message-origin]')).toHaveLength(0)
      expect(captured.button).toBeNull()
      expect(renderToStaticMarkup(createElement(AutomaticFeedDebugSection))).toBe('')
      expect(getAutomaticFeedVisibility()).toBe(false)
    }
  )
})
