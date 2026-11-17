// 호스트가 쓰는 앱 경로·버전 (0324 §11 단계 4 — "경로·버전은 fork 인자로 받는다").
//
// 호스트 코드(조립·DB·로그)는 `app.getPath`·`app.getVersion` 을 부르지 않고 이 값을 읽는다.
// 셸은 `index.ts` 가 Electron 에서 읽어 정하고, 두 호스트는 진입점이 fork 인자에서 정한다
// (`app/host-process.ts`). 프로세스마다 로그를 열기 전에 한 번 정한다. 이 파일은 electron 을 import 하지 않는다.

export interface HostEnvironment {
  // `app.getPath('userData')` — dev 격리 뒤의 값이다.
  readonly userData: string
  // `app.getPath('desktop')` — 프로젝트 미소속 기본 작업 폴더의 부모.
  readonly desktop: string
  readonly appVersion: string
  readonly isPackaged: boolean
  // `app.getAppPath()` — 번들 리소스의 기준.
  readonly appPath: string
}

let current: HostEnvironment | null = null

export function setHostEnvironment(environment: HostEnvironment | null): void {
  current = environment
}

export function hostEnvironment(): HostEnvironment {
  if (!current)
    throw new Error('호스트 환경이 정해지지 않았다 — 프로세스 시작에서 setHostEnvironment')
  return current
}
