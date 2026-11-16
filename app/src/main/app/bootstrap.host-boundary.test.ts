// 호스트 조립의 Electron 경계 (0324 EP-10′ — 경로·버전 · 외부 열기 · 전원 이벤트).
//
// Bootstrap·DB·로그는 `app`·`shell`·`powerMonitor` 를 부르지 않고 호스트 환경과 셸 서비스 포트를
// 읽는다. 이 자리들은 대표 테스트가 대역으로 막아(초기화·설정 저장소·업데이터 mock) 행동으로 관측되지
// 않는다 — 배선을 글자로 고정한다(같은 방식: `builtin-resources.test.ts`·`daily-gate.wiring.test.ts`).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripCommentsAndStrings } from '../infra/source-scan'

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')
const code = (path: string): string => stripCommentsAndStrings(read(path))
const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0

describe('호스트 조립은 Electron 을 import 하지 않는다', () => {
  it.each(['./bootstrap.ts', '../infra/db/index.ts', '../infra/log/index.ts'])('%s', (path) => {
    expect(read(path)).not.toMatch(/from 'electron'/)
  })
})

describe('경로·버전은 호스트 환경에서 읽는다', () => {
  const bootstrap = code('./bootstrap.ts')

  it.each([
    ['사용자 데이터 폴더', /private readonly dataDirectory = hostEnvironment\(\)\.userData\b/],
    ['설정 저장소의 앱 버전', /new SettingsStore\(hostEnvironment\(\)\.appVersion,/],
    [
      '확장 빌더의 앱 버전',
      /\(\) => this\.settings\.getAll\(\),\s*hostEnvironment\(\)\.appVersion,/
    ],
    ['기본 작업 폴더', /this\.defaultCwd = hostEnvironment\(\)\.desktop\b/],
    [
      '업데이터의 패키지 여부',
      /loadElectronAutoUpdater\(\{ reportUnavailable: hostEnvironment\(\)\.isPackaged \}\)/
    ]
  ])('Bootstrap — %s', (_name, pattern) => {
    expect(count(bootstrap, new RegExp(pattern.source, 'g'))).toBe(1)
  })

  it('DB 는 호스트 환경의 사용자 데이터 폴더와 앱 버전으로 연다', () => {
    const db = code('../infra/db/index.ts')
    expect(db).toMatch(/const userData = hostEnvironment\(\)\.userData\b/)
    expect(db).toMatch(/appVersion: hostEnvironment\(\)\.appVersion\b/)
  })

  it('셸은 로그를 열기 전에 Electron 값으로 호스트 환경을 정한다', () => {
    const shell = read('../index.ts')
    const set = shell.indexOf('setHostEnvironment({')
    expect(set).toBeGreaterThan(-1)
    expect(set).toBeLessThan(shell.indexOf('const rootLog = initLog()'))
    const block = shell.slice(set, shell.indexOf('})', set))
    for (const pair of [
      "userData: app.getPath('userData')",
      "desktop: app.getPath('desktop')",
      'appVersion: app.getVersion()',
      'isPackaged: app.isPackaged',
      'appPath: app.getAppPath()'
    ]) {
      expect(block).toContain(pair)
    }
  })
})

describe('외부 열기는 셸 서비스로 간다', () => {
  it.each([
    [
      'OAuth 인가 페이지',
      "openExternal: (url) => shellServices().call('external.openExternal', url)"
    ],
    ['산출물 휴지통', "trashItem: (path) => shellServices().call('external.trashItem', path)"]
  ])('%s', (_name, wiring) => {
    expect(read('./bootstrap.ts').split(wiring)).toHaveLength(2)
  })
})
