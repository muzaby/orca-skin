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
  // __dirname = out/main (빌드 후) 또는 src/main (dev). 프로젝트 루트로 거슬러 올라간다.
  const projectRoot = join(__dirname, '../../..')
  const plat = `${process.platform}-${process.arch}`
  return join(projectRoot, 'resources', 'bin', plat, UV_BIN)
}

// userData 기준 경로 모음 — 초기화·실행 모두 이 함수에서 도출한다.
export function getRuntimePaths(userData: string): {
  runtimeDir: string
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
  const configDir = join(userData, 'config')
  const isWin = process.platform === 'win32'
  const venvDir = join(runtimeDir, 'venv')
  return {
    runtimeDir,
    configDir,
    uvBin: join(runtimeDir, UV_BIN),
    pythonDir: join(runtimeDir, 'python'),
    venvDir,
    venvBin: join(venvDir, isWin ? 'Scripts' : 'bin'),
    cacheDir: join(runtimeDir, 'uv-cache'),
    readyFile: join(configDir, '.ready'),
    appUvToml: join(configDir, 'app-uv.toml'),
    appPipConf: join(configDir, 'app-pip.conf')
  }
}
