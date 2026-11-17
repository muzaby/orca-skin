import type { OoApi } from './oo'

// renderer 가 preload 다리 위에 만드는 `window.oo`(0324 D-058 — `install.ts`). 형상은 preload 가 노출하던
// 것과 같다. 다리 선언(`window.ooBridge`)은 `src/preload/index.d.ts` 다.
declare global {
  interface Window {
    oo: OoApi
  }
}
