// 프롬프트 블록의 **속성값 이스케이프** 단일 소유자.
//
// `attachment-prompt.ts`·`plan-feedback.ts`·`diff-requirements.ts` 가 각각 같은 본문을 사본으로
// 갖고 있었다(0218). 사본이 셋이면 한쪽에 이스케이프를 하나 더해도 나머지 둘은 조용히 약한
// 채로 남는데, 여기는 사용자 콘텐츠가 모델 입력의 **구조**로 새는 인젝션 경계다 — 규율이
// 갈리면 안 되는 자리라 한 함수가 갖는다.
//
// `null` 은 `"null"` 로 직렬화된다 — 줄번호가 없는 앵커(`diff-requirements.ts`)가 기대하는 값.
export function escapeAttribute(value: string | number | boolean | null): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
