// 테스트 시간 예산의 단일 정본 (0294).
//
// 기준 PC 는 "5년 전 사무용 데스크톱" 이다. 예산 숫자는 측정 환경(GitHub windows 러너·로컬
// 병렬)에서 잡은 **기준값** 으로만 적고, 실효값은 언제나 `기준값 × 배율` 이다. 배율 기본값은 3,
// 더 느린 러너는 `ORCINUS_ORCA_TEST_TIME_SCALE` 로 코드 수정 없이 올린다.
//
// 늘려도 멈춤은 그대로 잡힌다 — 예산은 유한하고, 바뀌는 것은 멈춤을 보고하기까지의 시간뿐이다.
// 그래서 배율은 1 이상의 **유한한** 수만 받는다(0·음수·NaN·Infinity 는 시작 시 실패).
//
// 소비자는 기준값만 들고 다시 곱하지 않는다. `vi.waitFor` 는 setup 의 wrapper 가 곱하므로
// 그 옵션에 `scaleMs` 를 쓰면 이중 배율이다.

export const DEFAULT_TEST_TIME_SCALE = 3
export const TEST_TIME_SCALE_ENV = 'ORCINUS_ORCA_TEST_TIME_SCALE'

/** 전역 케이스 예산 기준값 (0211 ΔV5 실측 20s). */
export const BASE_CASE_MS = 20_000
/** 전역 훅 예산 기준값 — vitest 기본 10s 는 저장소를 세우는 훅을 담지 못해 케이스와 같게 둔다. */
export const BASE_HOOK_MS = 20_000
/** `vi.waitFor` 무옵션 기준값 — vitest 기본 1s 는 지연 import 하나에도 모자란다(0294 §8). */
export const BASE_WAIT_FOR_MS = 5_000

/** `ORCINUS_ORCA_TEST_TIME_SCALE` 해석. 미설정·빈 값은 기본값, 그 밖은 1 이상의 유한한 수만. */
export function resolveTestTimeScale(env = process.env) {
  const raw = env[TEST_TIME_SCALE_ENV]
  if (raw === undefined || raw.trim() === '') return DEFAULT_TEST_TIME_SCALE
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${TEST_TIME_SCALE_ENV}=${raw} — 1 이상의 유한한 수여야 한다`)
  }
  return value
}

/** 이 프로세스의 배율. import 시 한 번 해석한다 — 잘못된 값이면 vitest 가 시작하지 않는다. */
export const TEST_TIME_SCALE = resolveTestTimeScale()

/** 기준값(ms) → 실효값(ms). */
export function scaleMs(baseMs, scale = TEST_TIME_SCALE) {
  if (typeof baseMs !== 'number' || !Number.isFinite(baseMs) || baseMs <= 0) {
    throw new Error(`scaleMs: 기준값은 양의 유한한 ms 여야 한다 — ${String(baseMs)}`)
  }
  return Math.ceil(baseMs * scale)
}

/** `vi.setConfig` 인자. 준 키만 환산한다 — 빠진 키를 지어내지 않는다. */
export function scaledBudget(base, scale = TEST_TIME_SCALE) {
  const out = {}
  if (base.testTimeout !== undefined) out.testTimeout = scaleMs(base.testTimeout, scale)
  if (base.hookTimeout !== undefined) out.hookTimeout = scaleMs(base.hookTimeout, scale)
  return out
}

/** `vi.waitFor(cb, options)` 의 options 환산. 숫자·미지정·객체(timeout 유/무) 네 갈래. */
export function scaledWaitForOptions(options, scale = TEST_TIME_SCALE) {
  if (typeof options === 'number') return { timeout: scaleMs(options, scale) }
  if (options === undefined || options === null)
    return { timeout: scaleMs(BASE_WAIT_FOR_MS, scale) }
  return { ...options, timeout: scaleMs(options.timeout ?? BASE_WAIT_FOR_MS, scale) }
}
