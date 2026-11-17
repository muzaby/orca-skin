import type { OoBridge } from './index'

// preload 가 노출하는 다리(0324 D-058). 다리가 없으면(preload 실패) renderer 는 실패 화면을 보인다(D-059).
// renderer 가 다리 위에 만드는 `window.oo` 의 선언은 `renderer/src/shared/api/transport/window.d.ts` 다.
declare global {
  interface Window {
    ooBridge?: OoBridge
  }
}
