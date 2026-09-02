// 0211 ΔV1 §10 EP-13 — **조회 소유자는 열거된 것뿐이다**(D-031). ΔV4 가 본문 축을
// `diffPatch` 로 바꾼다(§10 EP-34 ③ — 패치는 요약 세대당 1회다).
//
// 술어는 불변식의 주어로 쓴다: "`gitApi.status`/`gitApi.diffSummary`/`gitApi.diffPatch` 를 부르는
// renderer 파일"
// 이고, 해법 이름(`useGitSnapshot`)으로 세지 않는다 — 해법 이름으로 세면 이미 고친 자리만
// 분모에 오르고, 자기 effect 를 되살린 컴포넌트는 분모 밖에 남는다.
//
// 분모의 단위는 **파일이 아니라 (파일 × 조회 종류)** 다. 파일 수만 세면 이미 목록에 오른
// 소유자 안에서 **다른 조회 종류**를 하나 더 부르는 변이가 분모를 바꾸지 않아 보이지 않는다.
//
// 이 스윕은 **없다** 와 **있다** 를 함께 잠근다 — 각 소유자가 자기 조회를 실제로 부르는지도
// 단언한다(§5 방향 규칙). 계기 판정의 양성 짝은 `gitSnapshotQuery.test.ts` 가 갖는다.
//
// **허용 예외는 하나이고 여기서 열거한다**: 랜딩 브랜치 칩(`BranchChip`, 0201)이다. 그 칩은
// `CwdPanel`(`data-state="landing"`) 안에만 살고 세션이 서면 사라지므로 D-031 이 말하는
// "세션 git 행/타일" 표면이 아니다. 예외를 술어에서 빼되 **그 파일이 아직 그 자리에 있는지**
// 함께 단언한다 — 예외 목록이 사라진 파일을 가리키면 그 구멍은 조용히 열린다.

import { readdir, readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER_SRC = join(__dirname, '..', '..', '..', '..')
const QUERY_CALL = /gitApi\s*\.\s*(status|diffSummary|diffPatch)\s*\(/g

async function tsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await tsFiles(full)))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

const LANDING_CHIP = 'features/chat/components/composer/BranchChip.tsx'

// `diffPatch` 소유자. 비교 범위 전체의 본문은 **한 훅**만 가져온다 — 문맥 확장·비교 모드
// 전환이 자기 조회를 붙이면 여기 분모가 늘어난다(제안서 §13 "context expansion 은 navigation 이
// 아니다" · D-088 "표시 옵션은 순수 파생").
const BODY_OWNER = 'features/chat/hooks/useGitPatch.ts'
const SUMMARY_OWNER = 'features/chat/components/composer/useGitSnapshot.ts'

describe('git 조회 소유자 (EP-13 · EP-18 · EP-19)', () => {
  it('조회 종류마다 소유자가 정확히 하나다 — 열거된 예외 하나만 뺀다', async () => {
    const files = await tsFiles(RENDERER_SRC)
    // 대상 집합이 비면 스윕은 아무것도 보지 않는다 — 분모부터 세운다.
    expect(files.length).toBeGreaterThan(50)

    // (파일 × 조회 종류) 쌍이 이 스윕의 단위다.
    const pairs: Array<{ file: string; api: string }> = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const match of source.matchAll(QUERY_CALL)) {
        pairs.push({ file: file.split(sep).join('/'), api: match[1] })
      }
    }

    // 예외가 실재하는지 먼저 본다 — 사라졌으면 술어에서 빼는 행위 자체가 구멍이다.
    const landing = pairs.filter((pair) => pair.file.endsWith(LANDING_CHIP))
    expect(landing.length).toBeGreaterThan(0)
    // 예외가 넓어지지 않았는지도 본다 — 랜딩 칩은 `status` 축만 갖는다(호출 횟수는 자유).
    expect([...new Set(landing.map((pair) => pair.api))]).toEqual(['status'])

    const owned = pairs.filter((pair) => !pair.file.endsWith(LANDING_CHIP))
    const ownersOf = (api: string): string[] =>
      [...new Set(owned.filter((pair) => pair.api === api).map((pair) => pair.file))].sort()

    // 양성 짝 — 세 조회가 **실제로** 분모에 잡혀야 스윕이 눈을 가진 것이다.
    expect(ownersOf('status')).toHaveLength(1)
    expect(ownersOf('status')[0]).toMatch(new RegExp(`${SUMMARY_OWNER}$`))
    expect(ownersOf('diffSummary')).toHaveLength(1)
    expect(ownersOf('diffSummary')[0]).toMatch(new RegExp(`${SUMMARY_OWNER}$`))
    expect(ownersOf('diffPatch')).toHaveLength(1)
    expect(ownersOf('diffPatch')[0]).toMatch(new RegExp(`${BODY_OWNER}$`))

    // 음성 짝 — 두 소유자는 서로의 조회를 부르지 않는다.
    expect(
      owned.filter((pair) => pair.file.endsWith(BODY_OWNER) && pair.api !== 'diffPatch')
    ).toEqual([])
    expect(
      owned.filter((pair) => pair.file.endsWith(SUMMARY_OWNER) && pair.api === 'diffPatch')
    ).toEqual([])
  })
})
