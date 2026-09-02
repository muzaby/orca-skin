// 변경 파일 트리 (0211 ΔV4 D-084).
//
// **저장소 탐색기가 아니다** — 현재 비교 범위에서 바뀐 파일만 담는다. 그래서 입력은 경로 배열
// 하나이고 파일 시스템을 읽지 않는다. 중간에 자식이 하나뿐인 폴더는 접어 한 줄로 보인다
// (`docs/handoff/0213-x` → 한 행) — 좁은 패널에서 빈 들여쓰기가 폭을 먹지 않게 한다.

export interface ChangedFileTreeFile {
  kind: 'file'
  /** 저장소 루트 기준 전체 경로 — 선택 시 그 파일 섹션을 찾는 키다. */
  path: string
  /** 이 행에 그릴 이름(마지막 세그먼트). */
  label: string
  added: number
  removed: number
}

export interface ChangedFileTreeDir {
  kind: 'dir'
  /** 접힘 토글의 키. 조상 경로를 포함한 전체 경로라 같은 이름의 형제가 섞이지 않는다. */
  path: string
  /** 자식이 하나뿐인 폴더가 접힌 결과라 `a/b/c` 처럼 여러 세그먼트일 수 있다. */
  label: string
  children: ChangedFileTreeNode[]
}

export type ChangedFileTreeNode = ChangedFileTreeDir | ChangedFileTreeFile

export interface ChangedFileInput {
  path: string
  added: number
  removed: number
}

export function buildChangedFileTree(files: readonly ChangedFileInput[]): ChangedFileTreeNode[] {
  interface Building {
    dirs: Map<string, Building>
    files: ChangedFileInput[]
  }
  const root: Building = { dirs: new Map(), files: [] }
  for (const file of files) {
    const segments = file.path.split('/')
    const name = segments.pop()
    if (name === undefined) continue
    let node = root
    for (const segment of segments) {
      const next = node.dirs.get(segment) ?? { dirs: new Map(), files: [] }
      node.dirs.set(segment, next)
      node = next
    }
    node.files.push({ ...file, path: file.path })
  }

  const emit = (node: Building, prefix: string): ChangedFileTreeNode[] => {
    const dirs: ChangedFileTreeNode[] = []
    for (const [segment, child] of node.dirs) {
      let label = segment
      let path = prefix.length > 0 ? `${prefix}/${segment}` : segment
      let current = child
      // 자식이 폴더 하나뿐이면 그 폴더와 합친다 — `docs` → `handoff` → `0213` 이 세 줄을
      // 먹는 대신 한 줄이 된다.
      while (current.files.length === 0 && current.dirs.size === 1) {
        const [nextSegment, nextChild] = [...current.dirs][0]
        label = `${label}/${nextSegment}`
        path = `${path}/${nextSegment}`
        current = nextChild
      }
      dirs.push({ kind: 'dir', path, label, children: emit(current, path) })
    }
    const leaves: ChangedFileTreeNode[] = node.files.map((file) => ({
      kind: 'file',
      path: file.path,
      label: file.path.split('/').pop() ?? file.path,
      added: file.added,
      removed: file.removed
    }))
    return [...dirs, ...leaves]
  }
  return emit(root, '')
}

/** 접힌 폴더의 자손을 뺀 **평탄 행 목록**. 렌더가 재귀 없이 한 번에 그린다. */
export interface ChangedFileTreeRow {
  node: ChangedFileTreeNode
  depth: number
}

export function visibleTreeRows(
  nodes: readonly ChangedFileTreeNode[],
  collapsed: ReadonlySet<string>,
  depth = 0
): ChangedFileTreeRow[] {
  const rows: ChangedFileTreeRow[] = []
  for (const node of nodes) {
    rows.push({ node, depth })
    if (node.kind === 'dir' && !collapsed.has(node.path))
      rows.push(...visibleTreeRows(node.children, collapsed, depth + 1))
  }
  return rows
}
