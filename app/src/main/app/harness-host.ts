// 로그인 프리 연결 로직(배포)이 받는 호스트 하네스 능력 (0291).
//
// 고정 질의 둘만 노출한다 — 설치 확인과 모델 목록. 설치 판정은 웜업·서버 시작이 쓰는 같은
// `isInstalled()` 이고, 모델 목록은 adapter 가 자기 실행 파일로 읽는다. 배포는 프로세스 실행
// 능력을 직접 받지 않는다(`child_process` 경계는 adapter 안에 머문다).
import type { HostHarnessPort } from '../adapters/common/harness-config'
import type { AdapterRegistry } from '../adapters/common/registry'

export function createHostHarnessPort(registry: Pick<AdapterRegistry, 'get'>): HostHarnessPort {
  return {
    async installed(harnessId) {
      const adapter = registry.get(harnessId)
      if (!adapter) return { installed: false }
      const info = await adapter.isInstalled()
      return {
        installed: info.installed,
        ...(info.version !== undefined ? { version: info.version } : {})
      }
    },
    async listModels(harnessId, provider, options) {
      const adapter = registry.get(harnessId)
      if (!adapter?.listProviderModels) {
        throw new Error(`${harnessId} 하네스는 모델 목록 조회를 지원하지 않습니다.`)
      }
      return adapter.listProviderModels(provider, options)
    }
  }
}
