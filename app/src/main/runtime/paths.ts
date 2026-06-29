import { app } from 'electron'
import { join } from 'node:path'

// uv 바이너리 파일명 (플랫폼별)
const UV_BIN = process.platform === 'win32' ? 'uv.exe' : 'uv'

// 번들 uv 위치 해석:
//   개발: app/resources/bin/<platform>-<arch>/uv(.exe)
//   프로덕션: process.resourcesPath/bin/uv(.exe)  ← electron-builder extraResources
export function getBundledUvPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', UV_BIN)
  }
  // electron-vite 는 dev 에서도 main 을 out/main 으로 번들한다 → __dirname = <app>/out/main.
  // 앱 프로젝트 루트(<app> = resources 의 부모)로 두 단계 거슬러 올라간다: out/main → out → <app>.
  const projectRoot = join(__dirname, '../..')
  const plat = `${process.platform}-${process.arch}`
  return join(projectRoot, 'resources', 'bin', plat, UV_BIN)
}

// userData 기준 경로 모음 — 초기화·실행 모두 이 함수에서 도출한다.
export function getRuntimePaths(userData: string): {
  runtimeDir: string
  binDir: string
  configDir: string
  uvBin: string
  pythonDir: string
  venvDir: string
  venvBin: string
  cacheDir: string
  readyFile: string
  appUvToml: string
  appPipConf: string
} {
  const runtimeDir = join(userData, 'runtime')
  // 모든 써드파티 실행 바이너리(uv 등)는 userData 최상위 bin/ 에서 관리한다.
  const binDir = join(userData, 'bin')
  const configDir = join(userData, 'config')
  const isWin = process.platform === 'win32'
  const venvDir = join(runtimeDir, 'venv')
  return {
    runtimeDir,
    binDir,
    configDir,
    uvBin: join(binDir, UV_BIN),
    pythonDir: join(runtimeDir, 'python'),
    venvDir,
    venvBin: join(venvDir, isWin ? 'Scripts' : 'bin'),
    cacheDir: join(runtimeDir, 'uv-cache'),
    readyFile: join(configDir, '.ready'),
    appUvToml: join(configDir, 'app-uv.toml'),
    appPipConf: join(configDir, 'app-pip.conf')
  }
}
