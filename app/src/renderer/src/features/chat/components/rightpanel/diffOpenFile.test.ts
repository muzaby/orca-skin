// 0211 ΔV5 AT-68 / VP-69 (renderer 절반) — `↗` 가 **그 파일의 절대 경로**로 reveal 을 부른다.
//
// 헤더에 버튼이 있다는 것만 재면 아무 데도 배선되지 않은 버튼이 통과한다(0198 r5 와 같은 축).
// 여기서는 타일 컨테이너가 실제로 건네는 콜백을 잡아 인자를 센다 — SSR 은 핸들러를 마크업에
// 남기지 않으므로 `DiffReview` 를 double 로 세운다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { joinRepoPath } from '../../lib/repoPath'

let onOpenFile: ((path: string) => void) | null = null
const openPath = vi.fn<(req: { path: string; mode: string }) => Promise<void>>(
  async () => undefined
)

vi.mock('../../../../shared/api/ipc', () => ({
  fileApi: { openPath: (req: { path: string; mode: string }) => openPath(req) },
  gitApi: { diffPatch: vi.fn(async () => null) }
}))

vi.mock('./DiffReview', () => ({
  DiffReview: (props: { onOpenFile: (path: string) => void }) => {
    onOpenFile = props.onOpenFile
    return null
  }
}))

vi.mock('../../hooks/useGitPatch', () => ({ useGitPatch: () => undefined }))

const state = {
  cwd: 'C:\\repo\\orca',
  sessionId: 's1',
  gitSnapshot: {
    summary: null,
    patch: null,
    comparison: { kind: 'all' as const },
    expandedFiles: [] as string[],
    sidebarVisible: false,
    view: {
      layout: 'inline' as const,
      wrapLines: true,
      highlightWords: true,
      ignoreWhitespace: false
    }
  },
  gitSnapshotRequest: null,
  diffRequirements: [],
  diffRequirementDraft: null
}

vi.mock('../../store/chatStore', () => ({
  chatActions: {
    toggleDiffFileExpanded: vi.fn(),
    setDiffComparison: vi.fn(),
    setDiffRequirementDraft: vi.fn(),
    addDiffRequirement: vi.fn(),
    removeDiffRequirement: vi.fn()
  },
  useChatSession: (select: (s: unknown) => unknown) => select(state),
  useChatStore: (select: (s: unknown) => unknown) => select({ activeKey: 's1' })
}))

const { DiffTileContent } = await import('./DiffTileContent')

beforeEach(() => {
  onOpenFile = null
  openPath.mockClear()
  renderToStaticMarkup(createElement(DiffTileContent))
})

describe('`↗` 배선', () => {
  it('저장소 상대 경로를 절대 경로로 올려 reveal 모드로 부른다', () => {
    onOpenFile?.('app/src/main/infra/db/queries.ts')

    expect(openPath).toHaveBeenCalledTimes(1)
    expect(openPath).toHaveBeenCalledWith({
      path: 'C:\\repo\\orca/app/src/main/infra/db/queries.ts',
      mode: 'reveal'
    })
  })

  it('모드가 `directory` 가 아니다 — 섞이면 파일 대신 폴더가 열린다', () => {
    onOpenFile?.('a.ts')

    expect(openPath.mock.calls[0]?.[0]).toMatchObject({ mode: 'reveal' })
  })
})

describe('경로 잇기 (joinRepoPath)', () => {
  it('git 이 주는 `/` 경로를 cwd 뒤에 붙인다', () => {
    expect(joinRepoPath('/repo', 'src/a.ts')).toBe('/repo/src/a.ts')
    expect(joinRepoPath('C:\\repo', 'src/a.ts')).toBe('C:\\repo/src/a.ts')
  })

  it('꼬리 구분자를 겹치지 않는다', () => {
    expect(joinRepoPath('/repo/', 'a.ts')).toBe('/repo/a.ts')
    expect(joinRepoPath('C:\\repo\\', 'a.ts')).toBe('C:\\repo/a.ts')
  })

  it('이미 절대 경로면 그대로 둔다 — cwd 를 두 번 붙이지 않는다', () => {
    expect(joinRepoPath('/repo', '/etc/passwd')).toBe('/etc/passwd')
    expect(joinRepoPath('/repo', 'C:\\other\\x.ts')).toBe('C:\\other\\x.ts')
  })
})
