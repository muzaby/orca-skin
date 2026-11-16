// 두 문자열의 줄 단위 차이 — **React 없이 돌아가는 순수 파생**만 갖는다(0206 D-019).
//
// 도구 카드(`DiffBody`)와 diff 타일 두 곳이 같은 diff 를 그린다. 파생 규칙이 두 벌이 되면
// `+`/`-` 표기와 줄번호 기준이 갈라지므로 여기 한 곳이 소유한다. 렌더는 `components/DiffTable`
// 이 갖고, 이 파일은 그것이 그릴 줄 배열만 만든다. 실제 파일 좌표를 가진 구조화 패치는
// `lib/diffPatchLines` 가 같은 `DiffLine` 으로 편다(0211 ΔV4).

// 줄 축 표기 — `+새줄` · `-옛줄` · 축 없는 줄은 맨숫자. **이 규칙은 여기가 소유한다**(위 헤더가
// 선언한 그 계약이다). 패널·컴포저 트레이·전송된 메시지가 각자 사본을 갖고 있었고(0218 r2),
// 사본이 갈리면 같은 요구사항이 화면마다 다른 줄을 가리킨다.
//
// 구조적 타입이라 `DiffLine` 과 `DiffRequirementAnchor` 가 모두 만족한다 — 둘은 다른 모듈의
// 타입이지만 축 두 개를 같은 의미로 들고 있다.
export interface LineAxis {
  oldLine: number | null
  newLine: number | null
}

export function lineAxisLabel(line: LineAxis): string {
  if (line.oldLine === null && line.newLine !== null) return `+${line.newLine}`
  if (line.newLine === null && line.oldLine !== null) return `-${line.oldLine}`
  return lineNumberLabel(line)
}

// 축 기호 없이 줄번호만. 새 축을 우선하고 없으면 옛 축을 쓴다.
export function lineNumberLabel(line: LineAxis): string {
  return String(line.newLine ?? line.oldLine ?? '?')
}

// 줄 모델과 줄 계산은 `shared/compute` 가 갖는다(0324) — 상한 이하의 입력은 `inline.ts` 가 UI
// 스레드에서, 넘는 입력은 계산 워커가 만든다. 소비자는 `hooks/useDiffLines` 를 쓴다.
export type { DiffLine } from '../../../shared/compute/diffModel'
