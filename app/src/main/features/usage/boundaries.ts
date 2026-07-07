// 일/주/월 경계 계산은 공용 `shared/time/clock` 로 이전(단일 출처 — renderer 한도 파생과 공유).
// 본 모듈은 재노출만 유지해 기존 importer(`tracker.ts`)·테스트 무회귀.
export { boundaries } from '../../../shared/time/clock'
export type { PeriodBoundaries as CostBoundaries } from '../../../shared/time/clock'
