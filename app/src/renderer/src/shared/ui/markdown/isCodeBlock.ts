// react-markdown v9 는 `code` 컴포넌트의 `inline` prop 을 제거했다. 공식 FAQ 는
// `className` 의 `language-*` 매칭으로 블록을 판정하라고 하지만, 언어를 지정하지 않은
// 펜스(``` 뒤 트리 본문 등)와 4칸 들여쓰기 코드블록은 `language-*` 클래스가 붙지 않아
// `!className` 휴리스틱으로는 인라인으로 오분류된다(단일 백틱처럼 깨져 보임).
//
// 인라인 코드는 실제 개행(\n)을 절대 포함하지 않으므로(CommonMark 인라인 코드의
// 줄바꿈은 공백으로 접힘), 언어 클래스가 있거나 본문에 개행이 있으면 블록으로 판정한다.
// mdast→hast 변환은 펜스/들여쓰기 코드블록에만 후행 개행을 붙이므로 단일행 언어 없는
// 펜스도 이 규칙에 걸린다.
export function isCodeBlock(className: string | undefined, text: string): boolean {
  return Boolean(className) || text.includes('\n')
}
