// 0211 ΔV1 §10 EP-13 — **조회 소유자는 하나다**(D-031).
//
// 술어는 불변식의 주어로 쓴다: "`gitApi.status`/`gitApi.diffSummary` 를 부르는 renderer 파일"
// 이고, 해법 이름(`useGitSnapshot`)으로 세지 않는다 — 해법 이름으로 세면 이미 고친 자리만
// 분모에 오르고, 자기 effect 를 되살린 컴포넌트는 분모 밖에 남는다.
//
// 이 스윕은 **없다** 만 잠근다. "조회가 실제로 일어난다" 는 양성 짝은 `gitSnapshotQuery.test.ts`
// 의 owner 케이스가 갖는다(§5 방향 규칙).
//
// **허용 예외는 하나이고 여기서 열거한다**: 랜딩 브랜치 칩(`BranchChip`, 0201)이다. 그 칩은
// `CwdPanel`(`data-state="landing"`) 안에만 살고 세션이 서면 사라지므로 D-031 이 말하는
// "세션 git 행/타일" 표면이 아니다. 예외를 술어에서 빼되 **그 파일이 아직 그 자리에 있는지**
// 함께 단언한다 — 예외 목록이 사라진 파일을 가리키면 그 구멍은 조용히 열린다.

import { readdir, readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER_SRC = join(__dirname, '..', '..', '..', '..')
const QUERY_CALL = /gitApi\s*\.\s*(status|diffSummary)\s*\(/

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

describe('git 조회 소유자 (EP-13)', () => {
  it('세션 표면에서 status·diffSummary 를 부르는 파일이 정확히 하나다', async () => {
    const files = await tsFiles(RENDERER_SRC)
    // 대상 집합이 비면 스윕은 아무것도 보지 않는다 — 분모부터 세운다.
    expect(files.length).toBeGreaterThan(50)
    const callers: string[] = []
    for (const file of files) {
      if (QUERY_CALL.test(await readFile(file, 'utf8'))) callers.push(file.split(sep).join('/'))
    }
    // 예외가 실재하는지 먼저 본다 — 사라졌으면 술어에서 빼는 행위 자체가 구멍이다.
    expect(callers.filter((f) => f.endsWith(LANDING_CHIP))).toHaveLength(1)
    const owned = callers.filter((f) => !f.endsWith(LANDING_CHIP))
    expect(owned).toHaveLength(1)
    expect(owned[0]).toMatch(/features\/chat\/components\/composer\/useGitSnapshot\.ts$/)
  })
})
