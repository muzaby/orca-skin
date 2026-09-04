// Claude 실행 파일 경로 해석 — SDK query() 의 pathToClaudeCodeExecutable 로 넘길 실경로를 고른다.
// 출처는 **앱이 동봉한 번들 바이너리 하나뿐**이다. 호스트 설치본(PATH·~/.local/bin)은 보지 않는다
// (0215 D-028, 0105 의 "공식/PATH 우선"을 대체). 이유: SDK 는 자기 버전에 잠긴 CLI 를 동봉하는데
// 호스트 설치본은 혼자 자동 갱신돼 버전이 무한히 드리프트한다 — 그러면 SDK 계약 밖 CLI 가 돌고,
// SDK 패키지 버전을 올려도 실행되는 바이너리는 바뀌지 않는다.
//
// 패키징 배경: electron-builder 는 node_modules 를 app.asar 로 묶는데, SDK 가 require.resolve 로 찾는
// 번들 바이너리(@anthropic-ai/claude-agent-sdk-<plat>-<arch>/claude[.exe])는 asar *내부* 경로라
// existsSync 는 true 지만 spawn 은 실패한다("native binary … exists but failed to launch").
// asarUnpack 로 실디스크에 꺼낸 뒤 그 언팩 경로를 명시 지정해 asar 를 우회한다(electron-builder.yml).
//
// 비패키징(dev)에서는 undefined 를 반환해 SDK 기본 해석에 위임한다 — SDK 가 같은 번들 파일을
// 실디스크에서 찾으므로 결과가 같다. 번들 자체가 없으면 SDK 가 "Native CLI binary … not found" 로
// 실패한다. 그것이 조용히 남의 CLI 로 폴백하는 것보다 낫다.

import { createRequire } from 'node:module'

const PKG = '@anthropic-ai/claude-agent-sdk'

// asar 내부 경로를 언팩 형제 경로로 리맵. 순수 함수 — asar 를 안 담은 경로는 무변경.
export function toUnpackedPath(p: string): string {
  return p.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
}

// 플랫폼별 claude 실행 파일명 — win 만 .exe.
function claudeBinName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'claude.exe' : 'claude'
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

// 번들 npm native binary → asar 언팩 경로. asar 안일 때만 값을 반환하고, 비패키징(dev)에서는
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

// 최종 해석: 번들 언팩본 단일 출처. 미해결이면 undefined(SDK 기본 해석에 위임).
export function resolveClaudeExecutable(): string | undefined {
  return resolveBundledExecutable()
}
