// 메뉴에서 고른 스킬(`/이름`)·플러그인(`@id`)을 커서 자리에 넣는 규칙(0259 D-002·D-003) — 순수 함수.
// 토큰 앞은 줄 시작이거나 공백이어야 자동완성·입력 장식이 같은 토큰으로 인식한다.

export function insertComposerToken(
  text: string,
  caret: number,
  token: string
): { text: string; caret: number; start: number; replacement: string } {
  const at = Math.max(0, Math.min(caret, text.length))
  const before = text.slice(0, at)
  const after = text.slice(at)
  const lead = before === '' || /\s$/.test(before) ? '' : ' '
  const trail = /^\s/.test(after) ? '' : ' '
  const replacement = `${lead}${token}${trail}`
  return {
    text: before + replacement + after,
    caret: at + replacement.length,
    start: at,
    replacement
  }
}
