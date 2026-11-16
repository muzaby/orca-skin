// 테스트용 호스트 환경 — 형제 값끼리 구별되게 채운다(맞바꾸면 관측이 달라지도록).

import { setHostEnvironment, type HostEnvironment } from './host-environment'

export function testHostEnvironment(overrides: Partial<HostEnvironment> = {}): HostEnvironment {
  return {
    userData: '/fixture/user-data',
    desktop: '/fixture/desktop',
    appVersion: 'test',
    isPackaged: false,
    appPath: '/fixture/app',
    ...overrides
  }
}

export function installTestHostEnvironment(
  overrides: Partial<HostEnvironment> = {}
): HostEnvironment {
  const environment = testHostEnvironment(overrides)
  setHostEnvironment(environment)
  return environment
}
