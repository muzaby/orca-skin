import { beforeEach, expect, it, vi } from 'vitest'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { acquireArtifacts, refreshArtifactList, useArtifactStore } from './artifactStore'
import { partsArtifacts } from '../lib/parts'

const artifact = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown' as const,
  sizeBytes: 10,
  publishedAt: 1
}
beforeEach(() => {
  installChatStoreHarness()
  useArtifactStore.setState({ sessions: {} })
})
it('an explicit repeat open requests the same offscreen tile again; background publication does not', () => {
  chatActions.setRightPanelTileActive('plan', true)
  const first = useChatStore.getState().sessions.s.panelReveal
  chatActions.setRightPanelTileActive('plan', true)
  const second = useChatStore.getState().sessions.s.panelReveal
  expect(second?.id).toBe('plan')
  expect(second).not.toBe(first)
  ingestChatEvent({ type: 'artifact.published', sessionId: 's', artifact })
  expect(useChatStore.getState().sessions.s.panelReveal).toBe(second)
})
it('background publication refreshes a mounted list without changing chat layout or reveal identity', async () => {
  Object.assign(window.orca, { artifacts: { list: vi.fn().mockResolvedValue([artifact]) } })
  const release = acquireArtifacts('s', [], true)
  chatActions.setRightPanelTileActive('artifacts', true)
  chatActions.setRightPanelTileActive('plan', true)
  const before = useChatStore.getState()
  const changed = vi.fn()
  const unsubscribe = useChatStore.subscribe(changed)
  ingestChatEvent({ type: 'artifact.published', sessionId: 's', artifact })
  await Promise.resolve()
  await Promise.resolve()
  expect(useArtifactStore.getState().sessions.s.list).toEqual([artifact])
  expect(useChatStore.getState()).toBe(before)
  expect(changed).not.toHaveBeenCalled()
  expect(useChatStore.getState().sessions.s.panelReveal?.id).toBe('plan')
  unsubscribe()
  release()
})
it('session invalidation discards a pending artifact list and does not recreate its surface', async () => {
  let resolve!: (refs: (typeof artifact)[]) => void
  const list = vi.fn(
    () =>
      new Promise<(typeof artifact)[]>((done) => {
        resolve = done
      })
  )
  Object.assign(window.orca, { artifacts: { list } })
  acquireArtifacts('s', [], true)
  const pending = refreshArtifactList('s')
  chatActions.invalidateSessionCache('s')
  resolve([artifact])
  await pending
  expect(useArtifactStore.getState().sessions.s).toBeUndefined()
})
it('nested late completion retains the main live preview and attaches only to its original call', () => {
  ingestChatEvent({
    type: 'tool.call.started',
    sessionId: 's',
    toolRunId: 'nested',
    toolName: 'publish_artifact',
    args: {},
    parentToolRunId: 'parent'
  })
  ingestChatEvent({
    type: 'message.committed',
    messageId: 2,
    sessionId: 's',
    text: 'next',
    ids: ['next'],
    createdAt: 2
  })
  ingestChatEvent({
    type: 'tool.call.completed',
    sessionId: 's',
    toolRunId: 'nested',
    result: 'ok',
    isError: false,
    parentToolRunId: 'parent',
    artifact
  })
  const messages = useChatStore.getState().sessions.s.session.messages
  expect(partsArtifacts(messages[0].parts)).toEqual([artifact])
  expect(messages.slice(1).flatMap((message) => partsArtifacts(message.parts))).toEqual([])
})
