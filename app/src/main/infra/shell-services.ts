// 셸 서비스 포트 (0324 EP-10). 호스트 코드(핸들러·인프라)는 Electron 권한 작업을 직접 부르지 않고
// 이 포트로 부탁한다. 두 호스트가 프로세스 시작 때 한 번, 셸로 보내는 클라이언트
// (`app/host-shell-client.ts`)로 정한다(`app/host-process.ts`). 셸은 구현을 직접 갖는다.
// 전송 선택(`infra/ipc/transport.ts`)과 같은 모양이다. 이 파일은 electron 을 import 하지 않는다.

import type {
  ShellServiceArgs,
  ShellServiceName,
  ShellServiceResults,
  WakeReason
} from '../../shared/shell-services'

export interface ShellServicesPort {
  call<N extends ShellServiceName>(
    name: N,
    ...args: ShellServiceArgs<N>
  ): Promise<ShellServiceResults[N]>
  // 시스템이 깨어났다(셸이 알린다). 반환값은 구독 해제다.
  onWake(listener: (reason: WakeReason) => void): () => void
}

let current: ShellServicesPort | null = null

// 프로세스 시작 때 한 번 부른다. 테스트는 가짜를 넣고 `null` 로 되돌린다.
export function setShellServices(port: ShellServicesPort | null): void {
  current = port
}

export function shellServices(): ShellServicesPort {
  if (!current) throw new Error('셸 서비스가 정해지지 않았다 — 프로세스 시작에서 setShellServices')
  return current
}
