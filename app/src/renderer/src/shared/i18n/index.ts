// 렌더러 i18n 진입점(0096) — i18next 를 번들 리소스로 **동기** 초기화한다(백엔드 로딩 없음).
// main.tsx 가 createRoot 전에 side-effect import 해 첫 렌더부터 t() 가 동작한다.
// 언어 전환은 TweakProvider 가 settings.uiLocale 변경 시 i18n.changeLanguage 로 반영.

import i18next, { type TFunction } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { ko } from './resources/ko'
import { en } from './resources/en'
import type { UiLocale } from './datetime'

void i18next.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en }
  },
  lng: 'ko',
  fallbackLng: 'ko',
  // React 가 XSS 를 이미 이스케이프하므로 i18next 이중 이스케이프는 끈다(react-i18next 권장).
  interpolation: { escapeValue: false },
  react: { useSuspense: false }
})

export { i18next as i18n }
export type { UiLocale, DateTimeOpts } from './datetime'
export {
  formatTimeShort,
  formatTimeFull,
  formatMonthDay,
  formatDateLong,
  formatDateMedium,
  formatRelativeDay,
  systemTimeZone
} from './datetime'

// 컴포넌트용 훅 — tr(번역)과 locale(날짜 포맷터 인자)을 함께 준다. useTranslation 을
// 경유하므로 languageChanged 시 소비 컴포넌트가 리렌더된다. 이름을 t 가 아닌 tr 로 둔 것은
// Tweak 컨텍스트의 관례적 `t`(Tweaks)와의 충돌 회피.
export function useI18n(): { tr: TFunction; locale: UiLocale } {
  const { t, i18n } = useTranslation()
  return { tr: t, locale: i18n.resolvedLanguage === 'en' ? 'en' : 'ko' }
}
