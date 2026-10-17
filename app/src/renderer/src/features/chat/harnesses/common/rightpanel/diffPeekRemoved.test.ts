// 0211 ΔV4 VP-61 / AT-53 — 대체된 표면이 제품에서 사라졌는가.
//
// **0건 스윕 단독으로는 "대체가 붙었다" 를 증명하지 못한다** — 지우고 아무것도 만들지 않아도
// 초록이다. plan 은 이것을 AT-45(연속 화면)·AT-46(패치 1회)의 양성 단언과 짝지었고, 여기서는
// 잔여물만 센다.
//
// 술어는 불변식의 주어로 쓴다: "사라진 모듈을 **가져다 쓰는** 코드"·"사라진 채널을 **부르는**
// 코드" 이지 "그 이름이 아무 데도 없다" 가 아니다 — 후자로 세면 이 파일과 이력 주석이 잡혀
// 분모를 파일 이름으로 깎게 된다.

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
const PRODUCTION = FILES.filter(({ path }) => !/\.test\.tsx?$/.test(path))

describe('사라진 표면 (AT-53)', () => {
  it('대상 집합이 비어 있지 않다 — 분모부터 세운다', () => {
    expect(FILES.length).toBeGreaterThan(200)
  })

  it('삭제된 모듈을 import 하는 코드가 0건이다', () => {
    const gone = [
      './DiffPeek',
      './SessionChangesList',
      './diffBodyCache',
      './diffFileCache',
      './peekNavigation',
      './diffRequirementBridge',
      './DiffTileHeader'
    ]
    const importers = FILES.filter(({ source }) =>
      gone.some((name) => new RegExp(`from '[^']*${name.slice(1)}'`).test(source))
    ).map(({ path }) => path)

    expect(importers).toEqual([])
  })

  it('사라진 본문 채널을 부르는 코드가 0건이다 — 계약·배선·소비 네 자리 모두', () => {
    // 술어의 주어는 **프로덕션 코드**다 — 사라진 이름을 단언하는 테스트가 분모에 들면
    // 그 테스트 자신 때문에 스윕이 영원히 red 다.
    const callers = PRODUCTION.filter(
      ({ source }) =>
        /gitDiffFile\b/.test(source) ||
        /GitDiffFileContent\b/.test(source) ||
        /orca:git:diffFile/.test(source) ||
        /gitApi\s*\.\s*diffFile\s*\(/.test(source)
    ).map(({ path }) => path)

    expect(callers).toEqual([])
  })

  it('상단 요약 여섯 값의 i18n 키가 두 카탈로그에서 사라졌다 (D-081)', () => {
    const catalogs = FILES.filter(({ path }) => /i18n[\\/]resources[\\/](ko|en)\.ts$/.test(path))
    expect(catalogs).toHaveLength(2)

    for (const { source } of catalogs)
      for (const key of [
        'diffTrackedFiles',
        'diffUntrackedExcluded',
        'diffCommitChip',
        'diffFileChip',
        'diffUncommittedChip',
        'diffBaselineCurrent'
      ])
        expect(source).not.toContain(`${key}:`)
  })

  it('peek 화면 마커와 이동 컨트롤이 프로덕션 코드에 없다', () => {
    const residue = PRODUCTION.filter(
      ({ source }) =>
        /data-session-changes-screen/.test(source) ||
        /diffPeekPosition|diffPreviousFile|diffNextFile/.test(source)
    ).map(({ path }) => path)

    expect(residue).toEqual([])
  })
})
