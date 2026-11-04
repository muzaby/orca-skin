export declare const DEFAULT_TEST_TIME_SCALE: number
export declare const TEST_TIME_SCALE_ENV: string
export declare const BASE_CASE_MS: number
export declare const BASE_HOOK_MS: number
export declare const BASE_WAIT_FOR_MS: number
export declare const TEST_TIME_SCALE: number
export declare function resolveTestTimeScale(env?: Record<string, string | undefined>): number
export declare function scaleMs(baseMs: number, scale?: number): number
export declare function scaledBudget(
  base: { testTimeout?: number; hookTimeout?: number },
  scale?: number
): { testTimeout?: number; hookTimeout?: number }
export declare function scaledWaitForOptions(
  options: number | { timeout?: number; interval?: number } | undefined,
  scale?: number
): { timeout: number; interval?: number }
