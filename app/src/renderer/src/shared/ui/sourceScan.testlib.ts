// 0208 — 소스 원문을 술어로 훑는 테스트가 쓰는 **테스트 전용** 헬퍼.
//
// 왜 있는가: 원문 검색 술어는 주석에 반응하기 쉽고, 그러면 "회귀가 없다" 와 "회귀를 설명하는
// 문장이 없다" 를 구분하지 못한다. r1 은 리터럴 가드가 산문의 백틱에 걸려 무조건 red 였고,
// 이번 턴에도 같은 자리에서 두 번(원본 leak 스윕 · `text-rust` 부재) 걸렸다. 술어가 보는
// 대상을 한 곳에서 정의해 그 실수를 파일마다 되풀이하지 않는다.
//
// 프로덕션은 이 파일을 import 하지 않는다 — `sparkCss.test.ts` 의 leak 스윕이 그 0건을 센다.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 주석을 뺀 코드 줄만 돌려준다. 블록 주석 전체와 `//`·`*` 로 시작하는 줄을 지운다.
 * 문자열 안의 `//` 는 남는다 — 코드가 실제로 그 문자열을 갖는다는 뜻이므로 옳다.
 */
export function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

/**
 * `rootDir` 아래의 `.ts`·`.tsx` 전수를 **POSIX 구분자 상대경로**로 돌려준다.
 *
 * 구분자를 고정하는 이유: `join()` 은 Windows 에서 `features\settings\…` 를 만든다. 경로를
 * **값으로 비교하는** 술어(전수 = 1 같은)는 그 한 글자 때문에 red 가 되는데, 그 red 는 회귀가
 * 아니라 실행 OS 다 — 같은 코드가 Linux 에서 초록, Windows 에서 빨강이면 술어가 코드를 보는
 * 것이 아니라 실행 환경을 보고 있는 것이다. 읽을 때는 `/` 를 그대로 넘겨도 Node 가 Windows
 * 에서 해석하므로, 여기서 구분자를 하나로 고정하고 호출부는 값 비교만 한다.
 */
export function walkSourceFiles(rootDir: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(rootDir, dir), { withFileTypes: true })) {
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else if (/\.tsx?$/.test(entry.name)) out.push(rel)
    }
  }
  walk('.')
  return out
}
