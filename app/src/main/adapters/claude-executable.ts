// Claude 실행 파일 경로 해석 — SDK query() 의 pathToClaudeCodeExecutable 로 넘길 실경로를 고른다.
// 우선순위: (1) PATH 의 claude → (2) 공식 네이티브 인스톨러 위치(~/.local/bin) → (3) 번들 npm
// native binary(asar 언팩 경로). 앞의 둘이 사용자 설치본(공식 설치 우선, 사용자 결정), 마지막이
// 자기완결 폴백. 미해결이면 undefined 를 반환해 SDK 기본 해석에 위임한다(dev/비패키징 정상 동작).
//
// 패키징 배경: electron-builder 는 node_modules 를 app.asar 로 묶는데, SDK 가 require.resolve 로 찾는
// 번들 바이너리(@anthropic-ai/claude-agent-sdk-<plat>-<arch>/claude[.exe])는 asar *내부* 경로라
// existsSync 는 true 지만 spawn 은 실패한다("native binary … exists but failed to launch").
// asarUnpack 로 실디스크에 꺼낸 뒤 그 언팩 경로를 명시 지정해 asar 를 우회한다(electron-builder.yml).

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const PKG = '@anthropic-ai/claude-agent-sdk'

// asar 내부 경로를 언팩 형제 경로로 리맵. 순수 함수 — asar 를 안 담은 경로는 무변경.
export function toUnpackedPath(p: string): string {
  return p.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
}

// 플랫폼별 claude 실행 파일명 — win 만 .exe. PATH·공식 위치·번들 후보가 공유한다.
function claudeBinName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'claude.exe' : 'claude'
}

// (1) PATH 에서 claude 실행 파일 탐색. win 은 실행 가능한 .exe 만 본다 — .cmd/.bat 은 shell 없이
// spawn 불가라 SDK 의 native spawn 과 맞지 않는다(공식 인스톨러는 .exe 를 설치).
export function findOnPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  exists: (p: string) => boolean = existsSync
): string | undefined {
  const name = claudeBinName(platform)
  const sep = platform === 'win32' ? ';' : ':'
  for (const dir of (env.PATH ?? '').split(sep).filter(Boolean)) {
    const full = join(dir, name)
    if (exists(full)) return full
  }
  return undefined
}

// (2) 공식 네이티브 인스톨러 기본 위치(~/.local/bin/claude[.exe]) — install.ps1/install.cmd 산출물.
export function officialInstallPath(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
  exists: (p: string) => boolean = existsSync
): string | undefined {
  const full = join(home, '.local', 'bin', claudeBinName(platform))
  return exists(full) ? full : undefined
}

// SDK Q2 와 동일한 플랫폼별 후보 서브패스(설치된 변형만 resolve 된다 — linux 는 glibc/musl 둘 다 시도).
function bundledCandidates(platform: NodeJS.Platform, arch: string): string[] {
  const bin = claudeBinName(platform)
  const names =
    platform === 'linux'
      ? [`${PKG}-linux-${arch}`, `${PKG}-linux-${arch}-musl`]
      : [`${PKG}-${platform}-${arch}`]
  return names.map((n) => `${n}/${bin}`)
}

// (3) 번들 npm native binary → asar 언팩 경로. asar 안일 때만 값을 반환하고, 비패키징(dev)에서는
// undefined 를 반환해 SDK 기본 해석(동일 바이너리, 실디스크)에 위임한다.
export function resolveBundledExecutable(
  requireFn: NodeRequire = createRequire(import.meta.url),
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string | undefined {
  for (const spec of bundledCandidates(platform, arch)) {
    try {
      const resolved = requireFn.resolve(spec)
      return /[\\/]app\.asar[\\/]/.test(resolved) ? toUnpackedPath(resolved) : undefined
    } catch {
      // 이 변형은 미설치 — 다음 후보로.
    }
  }
  return undefined
}

// 최종 해석: 공식/PATH 설치본 우선 → 번들 언팩본 폴백. 전부 미해결이면 undefined(SDK 기본).
export function resolveClaudeExecutable(): string | undefined {
  return findOnPath() ?? officialInstallPath() ?? resolveBundledExecutable()
}
