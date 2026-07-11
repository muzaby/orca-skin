// i18next 타입 확장(0096) — t() 의 키 인자를 ko 카탈로그 구조로 타입 안전하게 만든다.
// 잘못된 키는 컴파일 에러. en.ts 는 `typeof ko` 선언으로 같은 구조를 강제받는다.

import type { ko } from './resources/ko'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof ko }
  }
}
