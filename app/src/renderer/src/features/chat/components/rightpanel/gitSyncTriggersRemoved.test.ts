// 0211 ΔV5 VP-63·VP-67·VP-68 / AT-62·AT-66·AT-67 — 없어진 계기·집합·진입점의 잔여물.
//
// **0건 스윕 단독으로는 목적을 증명하지 못한다**(§5 방향 규칙). "사라졌다" 만 말하고 "남은
// 계기가 실제로 동작한다" 를 말하지 않는다 — 양성 짝은 `gitQueryReason.test.ts`(턴 종료
// `'turn-end'`)와 `diffSyncState.render.test.ts`(기본 접힘 첫 출력)가 같은 라운드에 갖는다.
//
// 술어는 불변식의 주어로 쓴다: "그 액션을 **디스패치하는** 코드"·"그 필드를 **읽는** 코드"
// 이지 "그 문자열이 아무 데도 없다" 가 아니다 — 후자면 이 파일과 이력 주석이 잡힌다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../../../../../../', import.meta.url))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

const FILES = walk(SRC).map((path) => ({ path, source: readFileSync(path, 'utf8') }))
const PRODUCTION = FILES.filter(
  ({ path }) => !/\.test\.tsx?$/.test(path) && !path.endsWith('gitSyncTriggersRemoved.ts')
)

function hits(needles: readonly string[]): string[] {
  return PRODUCTION.filter(({ source }) => needles.some((needle) => source.includes(needle))).map(
    ({ path }) => path
  )
}

describe('사라진 싱크 계기 (AT-62)', () => {
  it('대상 집합이 비어 있지 않다 — 분모부터 세운다', () => {
    expect(FILES.length).toBeGreaterThan(200)
  })

  it('수동 새로고침·창 재포커스 계기가 프로덕션에 0건이다', () => {
    expect(
      hits([
        'refreshGitSnapshot',
        'REFRESH_GIT_SNAPSHOT',
        'subscribeGitExternalChange',
        'refreshGeneration'
      ])
    ).toEqual([])
  })

  it('`⋮` 메뉴의 새로고침 라벨 키가 카탈로그에서 사라졌다', () => {
    expect(hits(['diffRefresh'])).toEqual([])
  })
})

describe('뒤집힌 집합의 옛 이름 (AT-66)', () => {
  it('`collapsedFiles` 계열이 프로덕션에 0건이다 — 반전이 절반만 되면 여기서 잡힌다', () => {
    expect(
      hits(['collapsedFiles', 'TOGGLE_DIFF_FILE_COLLAPSED', 'SET_ALL_DIFF_FILES_COLLAPSED'])
    ).toEqual([])
  })
})

describe('사라진 비교 범위 (AT-67)', () => {
  it('`uncommitted` 비교 모드를 만드는 코드가 renderer 프로덕션에 0건이다', () => {
    const renderer = PRODUCTION.filter(({ path }) => path.includes('renderer'))
    const offenders = renderer
      .filter(({ source }) => /kind:\s*'uncommitted'|kind === 'uncommitted'/.test(source))
      .map(({ path }) => path)

    expect(offenders).toEqual([])
  })

  it('`diffUncommittedBlock` 라벨 키가 카탈로그에서 사라졌다', () => {
    expect(hits(['diffUncommittedBlock'])).toEqual([])
  })
})
