// diff 타일의 데이터 파생 (0211) — **React 없이 도는 순수 규칙만**. 0206 의 `diffTileMock`
// 자리를 대신하지만 역할이 다르다: 그것은 고정 데이터였고 이것은 실데이터의 변환이다.
//
// 트리는 **평탄 배열 + depth** 다(0206 D-011 승계) — 중첩 리스트가 아니라 형제 버튼 목록이라
// 키보드 이동과 접힘 파생이 인덱스 하나로 끝난다. `visibleTreeRows` 가 그 형태를 계속 쓴다.

import type { GitDiffFileEntry } from '../../../../../../shared/ipc'

export interface DiffTreeRow {
  kind: 'dir' | 'file'
  /** 접힘 집합의 키이자 React key. 디렉토리는 경로, 파일은 파일 경로. */
  key: string
  label: string
  depth: number
  added?: number
  removed?: number
}

interface TreeNode {
  name: string
  children: Map<string, TreeNode>
  file?: GitDiffFileEntry
}

function emptyNode(name: string): TreeNode {
  return { name, children: new Map() }
}

// 단독 디렉토리는 한 노드로 압축한다(`a/b/c` 에 파일이 하나뿐이면 `a/b/c` 한 줄).
// 압축하지 않으면 깊은 저장소에서 트리의 대부분이 자식 하나짜리 디렉토리 줄로 찬다.
function collapseSingleDirs(node: TreeNode): TreeNode {
  const children = new Map<string, TreeNode>()
  for (const [key, child] of node.children) {
    let merged = collapseSingleDirs(child)
    while (merged.file === undefined && merged.children.size === 1) {
      const only = [...merged.children.values()][0]
      if (only.file !== undefined) break
      merged = { ...only, name: `${merged.name}/${only.name}` }
    }
    children.set(key, merged)
  }
  return { ...node, children }
}

function walk(node: TreeNode, prefix: string, depth: number, out: DiffTreeRow[]): void {
  // 디렉토리 먼저, 그 다음 파일 — 각각 이름순. git 이 주는 순서는 저장소 내부 순서라
  // 사람이 찾는 순서가 아니다.
  const entries = [...node.children.values()]
  const dirs = entries.filter((entry) => entry.file === undefined)
  const files = entries.filter((entry) => entry.file !== undefined)
  for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = prefix ? `${prefix}/${dir.name}` : dir.name
    out.push({ kind: 'dir', key, label: depth === 0 ? key : dir.name, depth })
    walk(dir, key, depth + 1, out)
  }
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const entry = file.file!
    out.push({
      kind: 'file',
      key: entry.path,
      label: file.name,
      depth,
      added: entry.added,
      removed: entry.removed
    })
  }
}

/** 파일 목록 → 평탄 트리 행. 경로 구분자는 git 이 주는 `/` 하나다. */
export function buildDiffTreeRows(files: readonly GitDiffFileEntry[]): DiffTreeRow[] {
  const root = emptyNode('')
  for (const file of files) {
    const segments = file.path.split('/').filter((seg) => seg.length > 0)
    if (segments.length === 0) continue
    let cursor = root
    for (let i = 0; i < segments.length - 1; i += 1) {
      const name = segments[i]
      let next = cursor.children.get(name)
      if (!next) {
        next = emptyNode(name)
        cursor.children.set(name, next)
      }
      cursor = next
    }
    const leaf = segments[segments.length - 1]
    cursor.children.set(leaf, { ...emptyNode(leaf), file })
  }
  const out: DiffTreeRow[] = []
  walk(collapseSingleDirs(root), '', 0, out)
  return out
}

/** 파일 항목 헤더가 쓰는 이름/경로 분해. `dir` 이 빈 문자열이면 저장소 루트의 파일이다. */
export function splitFilePath(path: string): { name: string; dir: string } {
  const cut = path.lastIndexOf('/')
  return cut < 0 ? { name: path, dir: '' } : { name: path.slice(cut + 1), dir: path.slice(0, cut) }
}

export type DiffSummaryState =
  // 요약이 아직 안 왔다. **빈 상태 문구를 여기서 띄우지 않는다** — "변경 없음" 과
  // "아직 안 왔음" 을 섞으면 사용자가 첫 프레임에 거짓을 읽는다.
  { kind: 'loading' } | { kind: 'not-repo' } | { kind: 'empty' } | { kind: 'ready' }

export function diffSummaryState(
  summary: { isRepo: boolean; files: readonly unknown[] } | null
): DiffSummaryState {
  if (!summary) return { kind: 'loading' }
  if (!summary.isRepo) return { kind: 'not-repo' }
  return summary.files.length === 0 ? { kind: 'empty' } : { kind: 'ready' }
}
