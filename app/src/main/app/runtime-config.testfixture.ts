// production 조립(`bootstrap.ts`)이 늘 주입하는 런타임 구성 의존성의 테스트용 최소 구현.
// 카탈로그는 settings 행을 그대로 통과시키고 실행 구성은 settings 서비스가 준 값을 싣는다.
// 런타임 관리 key·캐시 분기를 시험하는 테스트는 이 위에 자기 fake 를 덮어쓴다.
type Target = { key: string; harnessId: string; modelProviderId: string }

export function passthroughRuntimeConfig(settings?: {
  resolve?: (target: Target) => Promise<unknown>
}): {
  runtimeModelCatalog: {
    merge: <T>(rows: T[]) => T[]
    isReadOnly: () => boolean
    invalidate: () => Promise<void>
  }
  harnessRuntime: {
    resolve: (target: Target) => Promise<object>
    cached: () => undefined
    invalidate: () => void
  }
} {
  return {
    runtimeModelCatalog: {
      merge: (rows) => rows,
      isReadOnly: () => false,
      invalidate: async () => {}
    },
    harnessRuntime: {
      resolve: async (target) => ({
        ...target,
        runtimeEnv: {},
        ...(settings?.resolve ? { settings: await settings.resolve(target) } : {})
      }),
      cached: () => undefined,
      invalidate: () => {}
    }
  }
}
