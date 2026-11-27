// 보이는 글 판정의 정본 (0331 D-034). 공백·보이지 않는 서식 문자(Unicode `Cf`)만 있거나, 글 전체가
// 공백 엔티티·링크 참조 정의 줄로만 된 text는 화면에 아무것도 그리지 않는다. 그런 text가 메모 행·
// 세그먼트·실시간 표시를 만들면 글 없는 점·빈 행이 남는다.
//
// 판정은 보수 쪽으로 닫는다 — 목록에 없는 엔티티·정의 형태는 보이는 글로 본다. 놓치면 지금처럼 빈
// 행이 남을 뿐 보이는 글이 사라지지는 않는다. 줄 단위로 앞에서부터 보고 보이는 줄을 찾으면 멈추므로
// 스트리밍 중인 긴 글도 첫 보이는 줄까지만 읽는다.

const VISIBLE_CHAR = /[^\s\p{Cf}]/u

// 화면에 공백·보이지 않는 문자로만 그려지는 엔티티. 이름은 대소문자를 구별한다(HTML 규칙).
const BLANK_ENTITY =
  /&(?:nbsp|ensp|emsp|thinsp|ZeroWidthSpace|zwnj|zwj|lrm|rlm|#0*160|#0*8203|#[xX]0*[aA]0|#[xX]0*200[bB]);/gu

// 한 줄짜리 링크 참조 정의(CommonMark) — 렌더 출력이 없다. 각주 정의(`[^1]:`)는 각주 목록을 그리므로
// 제외한다. 제목이 다음 줄로 넘어가는 정의는 보이는 글로 본다(보수).
const LINK_DEFINITION =
  /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*(?:<[^>\n]*>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t\r]*$/u

// 공백·`Cf`가 아닌 글자가 하나라도 있는가 — 조각 단위 판정(`ChunkedText`)이 쓰는 글자 규칙.
export function hasVisibleChar(text: string): boolean {
  return VISIBLE_CHAR.test(text)
}

function lineVisible(line: string): boolean {
  if (!hasVisibleChar(line)) return false
  const text = line.includes('&') ? line.replace(BLANK_ENTITY, ' ') : line
  return hasVisibleChar(text) && !LINK_DEFINITION.test(text)
}

export function hasVisibleText(text: string): boolean {
  let start = 0
  while (start <= text.length) {
    const newline = text.indexOf('\n', start)
    const end = newline < 0 ? text.length : newline
    if (lineVisible(text.slice(start, end))) return true
    start = end + 1
  }
  return false
}
