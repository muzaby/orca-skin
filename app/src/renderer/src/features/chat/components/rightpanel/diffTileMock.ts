// diff 타일의 **배치 확인용 예시 데이터**(0206 D-010). 실제 변경이 아니다 — 저장소 diff 를
// 읽을 IPC 채널이 없어서 골격만 세운다(plan §6 비범위).
//
// 사용자가 이것을 실제 변경으로 읽지 않도록 본문 최상단이 예시 문구를 갖고(D-012), 파일 항목은
// 기본으로 접혀 있다(D-017). 이름을 `sample` 로 둔 것도 같은 이유다.
//
// 실제 데이터가 붙을 때 **이 파일만 사라지면 된다** — View 들은 전부 props 로만 읽는다.

export interface MockTreeRow {
  kind: 'dir' | 'file'
  // 접힘 집합의 키이자 React key. 디렉토리는 경로, 파일은 파일 경로.
  key: string
  label: string
  depth: number
  added?: number
  removed?: number
}

export interface MockDiffFile {
  path: string
  name: string
  dir: string
  added: number
  removed: number
  oldValue: string
  newValue: string
}

export interface MockCommit {
  sha: string
  subject: string
  author: string
  when: string
}

// 트리는 **평탄 배열 + depth** 다 — 중첩 리스트가 아니라 형제 버튼 목록이라 키보드 이동과
// 접힘 파생이 인덱스 하나로 끝난다(조사: epitaxy 02 §2). 단독 디렉토리는 한 노드로 압축한다.
export const MOCK_TREE: readonly MockTreeRow[] = [
  {
    kind: 'dir',
    key: 'src/renderer/src/features/sample',
    label: 'src/renderer/src/features/sample',
    depth: 0
  },
  {
    kind: 'dir',
    key: 'src/renderer/src/features/sample/components',
    label: 'components',
    depth: 1
  },
  {
    kind: 'file',
    key: 'src/renderer/src/features/sample/components/SampleView.tsx',
    label: 'SampleView.tsx',
    depth: 2,
    added: 18,
    removed: 4
  },
  { kind: 'dir', key: 'src/renderer/src/features/sample/lib', label: 'lib', depth: 1 },
  {
    kind: 'file',
    key: 'src/renderer/src/features/sample/lib/sampleState.ts',
    label: 'sampleState.ts',
    depth: 2,
    added: 32,
    removed: 0
  },
  { kind: 'dir', key: 'docs', label: 'docs', depth: 0 },
  { kind: 'file', key: 'docs/SAMPLE.md', label: 'SAMPLE.md', depth: 1, added: 7, removed: 2 }
]

export const MOCK_FILES: readonly MockDiffFile[] = [
  {
    path: 'src/renderer/src/features/sample/components/SampleView.tsx',
    name: 'SampleView.tsx',
    dir: 'src/renderer/src/features/sample/components',
    added: 18,
    removed: 4,
    oldValue:
      'export function SampleView() {\n  const rows = useRows()\n  return <List rows={rows} />\n}\n',
    newValue:
      'export function SampleView({ filter }: Props) {\n  const rows = useRows(filter)\n  if (rows.length === 0) return <Empty />\n  return <List rows={rows} />\n}\n'
  },
  {
    path: 'src/renderer/src/features/sample/lib/sampleState.ts',
    name: 'sampleState.ts',
    dir: 'src/renderer/src/features/sample/lib',
    added: 32,
    removed: 0,
    oldValue: '',
    newValue: 'export function sampleView(input: string) {\n  return input.trim()\n}\n'
  },
  {
    path: 'docs/SAMPLE.md',
    name: 'SAMPLE.md',
    dir: 'docs',
    added: 7,
    removed: 2,
    oldValue: '# 예시\n\n한 줄.\n',
    newValue: '# 예시\n\n두 줄로 늘렸다.\n추가된 줄.\n'
  }
]

export const MOCK_COMMITS: readonly MockCommit[] = [
  {
    sha: '83a748e',
    subject: 'feat(sample): 빈 상태를 목록 앞에 세운다',
    author: 'sample',
    when: '10m'
  },
  {
    sha: '4e60c14',
    subject: 'refactor(sample): 파생을 순수 파일로 뗀다',
    author: 'sample',
    when: '45m'
  },
  { sha: 'c1d09f2', subject: 'docs(sample): 예시 문서를 추가한다', author: 'sample', when: '2h' }
]
