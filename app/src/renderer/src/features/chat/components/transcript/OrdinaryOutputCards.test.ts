import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { OrdinaryOutputCards } from './OrdinaryOutputCards'
import { acquireArtifacts, refreshArtifactList, useArtifactStore } from '../../store/artifactStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'
import { ingestChatEvent, useChatStore } from '../../store/chatStore'
import type { ArtifactRef } from '../../../../../../shared/artifacts'

const file: ArtifactRef = {
  publicationId: 'ordinary',
  artifactFileId: 'file',
  title: 'Final report',
  filename: 'final.pptx',
  kind: 'file',
  category: 'file',
  sizeBytes: 123,
  publishedAt: 1
}
const artifact: ArtifactRef = {
  ...file,
  publicationId: 'published',
  artifactFileId: 'published-file',
  category: 'artifact',
  title: 'Published report'
}

function render(): string {
  // Zustand's SSR snapshot is distinct from its live state.
  Object.assign(useChatStore.getInitialState(), useChatStore.getState())
  Object.assign(useArtifactStore.getInitialState(), useArtifactStore.getState())
  return renderToStaticMarkup(createElement(OrdinaryOutputCards))
}

beforeEach(() => {
  installChatStoreHarness()
  useArtifactStore.setState({ sessions: {} })
})

it('renders ordinary latest outputs as cards independently of the right panel and refreshes after capture', async () => {
  const list = vi.fn().mockResolvedValue([artifact, file])
  Object.assign(window.orca, { artifacts: { list } })
  const release = acquireArtifacts('s', [], true)
  await refreshArtifactList('s')
  let html = render()
  expect(html).toContain('data-artifact-preview="ordinary"')
  expect(html).toContain('PPTX')
  expect(html).not.toContain('data-artifact-preview="published"')
  const replacement = { ...file, publicationId: 'updated', artifactFileId: 'updated-file' }
  list.mockResolvedValue([artifact, replacement])
  ingestChatEvent({ type: 'artifact.published', sessionId: 's', artifact: replacement })
  await Promise.resolve()
  await Promise.resolve()
  html = render()
  expect(html).toContain('data-artifact-preview="updated"')
  expect(html).not.toContain('data-artifact-preview="ordinary"')
  useChatStore.setState((state) => ({
    sessions: {
      ...state.sessions,
      s: {
        ...state.sessions.s,
        session: {
          ...state.sessions.s.session,
          messages: [
            {
              role: 'assistant',
              createdAt: 1,
              parts: [{ type: 'artifact', artifact: replacement }]
            }
          ]
        }
      }
    }
  }))
  expect(render()).not.toContain('data-artifact-preview="updated"')
  release()
})

it('reload reads persisted latest outputs and another session never displays the first session files', async () => {
  Object.assign(window.orca, { artifacts: { list: vi.fn().mockResolvedValue([file]) } })
  const release = acquireArtifacts('s', [], true)
  await refreshArtifactList('s')
  useChatStore.setState((state) => ({
    activeKey: 'other',
    sessions: {
      ...state.sessions,
      other: { ...state.sessions.s, session: { ...state.sessions.s.session, sessionId: 'other' } }
    }
  }))
  expect(render()).not.toContain('ordinary')
  useChatStore.setState({ activeKey: 's' })
  release()
  useArtifactStore.setState({ sessions: {} })
  const reacquire = acquireArtifacts('s', [], true)
  await refreshArtifactList('s')
  expect(render()).toContain('data-artifact-preview="ordinary"')
  reacquire()
})
