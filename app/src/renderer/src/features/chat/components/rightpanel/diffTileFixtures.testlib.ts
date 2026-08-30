// diff 타일 테스트 fixture (0211) — 0206 의 `diffTileMock` 이 하던 **테스트 입력** 역할만
// 승계한다. 그 파일은 프로덕션 데이터원이기도 했으나 실 IPC 가 붙어 사라졌고, 그것이 잠그던
// 배치·접힘·펼침 계약(AT-11·AT-16·AT-17·AT-18)은 그대로 살아야 한다(0211 VP-17).
//
// **트리를 손으로 적지 않고 프로덕션 파생으로 만든다** — 손으로 적으면 `buildDiffTreeRows`
// 가 깨져도 트리 테스트는 초록이다. 여기서 실제 파생을 부르면 그 경로가 함께 잠긴다.

import type { GitDiffCommit, GitDiffFileEntry } from '../../../../../../shared/ipc'
import { buildDiffTreeRows, type DiffTreeRow } from './diffTileData'

export const SAMPLE_PATH = 'src/renderer/src/features/sample/components/SampleView.tsx'

export const FIXTURE_FILES: readonly GitDiffFileEntry[] = [
  {
    path: SAMPLE_PATH,
    status: 'modified',
    added: 12,
    removed: 3,
    binary: false
  },
  {
    path: 'src/renderer/src/features/sample/lib/sampleState.ts',
    status: 'modified',
    added: 4,
    removed: 1,
    binary: false
  },
  { path: 'docs/SAMPLE.md', status: 'added', added: 20, removed: 0, binary: false }
]

// `DiffTable` 에 실릴 old/new 전문. 본문 단언(AT-18)이 헤더 수치가 아니라 실제 줄을 보게 한다.
export const FIXTURE_CONTENT = {
  oldValue: 'const rows = useRows()\nreturn rows\n',
  newValue: 'const rows = useRows(filter)\nreturn rows\n'
}

export const FIXTURE_COMMITS: readonly GitDiffCommit[] = [
  {
    sha: '9f1c2ab3d4e5f60718293a4b5c6d7e8f90123456',
    subject: 'feat(sample): 목록 필터를 붙인다',
    author: 'codex',
    committedAt: Date.UTC(2026, 7, 30, 4, 0)
  },
  {
    sha: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
    subject: 'test(sample): 필터 파생을 잠근다',
    author: 'claude',
    committedAt: Date.UTC(2026, 7, 30, 6, 30)
  }
]

/** 프로덕션 파생을 그대로 통과한 트리 행 — 0206 MOCK_TREE 와 같은 키 집합을 낸다. */
export const FIXTURE_TREE: readonly DiffTreeRow[] = buildDiffTreeRows(FIXTURE_FILES)
