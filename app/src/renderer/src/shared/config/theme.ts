import type { TranscriptTextSize, TranscriptWidth } from '../../../../shared/ipc'

export type ThemeId = 'white' | 'dark'

/** 대화 내용 텍스트 배율(0256 D-004). 트랜스크립트 루트만 이 값을 받아들이고
 *  (`--chat-text-scale` → `--transcript-text-scale`), 그 안의 글자 크기가 곱한다. */
export const TRANSCRIPT_TEXT_SCALE: Record<TranscriptTextSize, number> = {
  small: 13 / 14,
  medium: 1,
  large: 15 / 14
}

/** 트랜스크립트·채팅 입력창 열의 최대 너비(px, 0256 D-005). `--reading-column` 으로 적용된다.
 *  `tokens.css` 의 기본값은 `medium` 과 같아야 한다(typeScale.test.ts 가 대조). */
export const TRANSCRIPT_WIDTH_PX: Record<TranscriptWidth, number> = {
  narrow: 768,
  medium: 960,
  wide: 1200
}
