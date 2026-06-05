// Capability(능력 탐지) — 런타임 계층 (provider-runtime.md §4/§5/§15).
//
// ※ 어휘 주의 (GLOSSARY §1/§2): 이 디렉토리의 "capability" 는 **능력 탐지** 다.
//   - 방향: 백엔드 → 앱 (탐지/게이팅).   시점: 세션 중 (런타임 계층).
//   - 무엇: 백엔드가 *지원하는* 라이프사이클 기능(fork/revert/abort…)의 서술.
//   이는 src/main/extensions/ 의 "Extension"(주입 묶음, 앱→백엔드, 세션 전)과 무관한
//   별개 개념이다. 두 어휘가 충돌하지 않도록 per-turn 묶음을 Extension 으로 개명했고,
//   비워진 capabilities/ 를 능력-탐지 전용으로 되살린다.
//
// 순수 데이터 DTO(SessionCapabilities/RevertCapabilities/CancellationCapability/
// ProviderDescriptor)는 IPC 경계를 넘으므로 shared/ipc.ts 가 SSOT 다 — 여기서 재노출만 한다
// (drift 방지). 본 파일은 그 위에 main 전용 탐지 추상화(CapabilityProbe)를 더한다.

import type {
  ProviderId,
  ProviderDescriptor,
  SessionCapabilities,
  RevertCapabilities,
  CancellationCapability
} from '../../shared/ipc'

export type { ProviderDescriptor, SessionCapabilities, RevertCapabilities, CancellationCapability }

// 한 provider 의 능력을 탐지하는 main 전용 추상화. discover() 는 async — opencode SDK
// introspection(메서드 존재 여부 등)을 seam 으로 열어두기 위함이다. claude 어댑터는 두 SDK
// 미설치 상태에서 SDK 메서드를 호출할 수 없으므로 정적 서술자(문서 지식 기반)를 반환한다(§13).
export interface CapabilityProbe {
  provider: ProviderId
  discover(): Promise<ProviderDescriptor>
}
