import { app } from 'electron'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 운영자(operator) env 파일 로더.
//
// 폐쇄망 배포에서 IT 가 사내 미러/인덱스/프록시/TLS 를 main 부팅 시 주입할 입력구.
// 더블클릭으로 실행되는 production 앱은 ambient process.env 만 상속하므로,
// 운영자가 배포 후에도 수정 가능한 파일을 process.env 로 흡수시킨다.
// 흡수된 값은 buildPyEnv 의 ...process.env pass-through 로 uv/pip 에 그대로 흐른다.
//
// 우선순위(낮음→높음): 설치 디렉토리 → 머신 전역 → 사용자별.
// 단, 실제 OS 환경변수가 항상 최우선 — 표준 dotenv 시맨틱(기존 키는 덮어쓰지 않음).
//   1. <resourcesPath>/orca.env        (packaged) / <projectRoot>/orca.env (dev) — IT 대량배포
//   2. %PROGRAMDATA%\orca\orca.env (win) / /etc/orca/orca.env (posix)            — 머신 전역
//   3. <userData>/orca.env                                                       — 사용자별

// orca.env.example 템플릿. PythonRuntime 이 초기화 시 <userData>/orca.env.example 로 기록하고,
// 동일 내용을 build/orca.env.example 로도 추적해 설치 디렉토리에 동봉한다(둘은 동기 유지).
export const ORCA_ENV_TEMPLATE = `# Orca 폐쇄망 런타임 설정 (orca.env)
# 이 파일을 같은 디렉토리의 "orca.env" 로 복사한 뒤 필요한 값의 주석(#)을 풀고 채우세요.
#
# 적용 위치(우선순위 낮음→높음, 높은 쪽이 낮은 파일을 덮어씀):
#   1. <설치 디렉토리>/orca.env        — IT 대량배포 (resources/orca.env)
#   2. %PROGRAMDATA%\\orca\\orca.env (Windows) / /etc/orca/orca.env (macOS·Linux) — 머신 전역
#   3. <userData>/orca.env             — 사용자별 (이 파일이 있는 위치)
# 단, 실제 OS 환경변수가 항상 최우선입니다.

# ── Python 인터프리터(python-build-standalone) 사내 미러 ──
# uv python install 3.12 가 github.com 대신 사내 미러에서 받도록 합니다.
# UV_PYTHON_INSTALL_MIRROR=https://mirror.corp.example/python-build-standalone

# ── 패키지 인덱스 (uv / pip) ──
# UV_DEFAULT_INDEX=https://mirror.corp.example/simple
# PIP_INDEX_URL=https://mirror.corp.example/simple

# ── TLS ──
# 기본값은 1 (OS 신뢰저장소 사용 → 사내 CA 가 OS 에 설치돼 있으면 'UnknownIssuer' 극복).
# 끄려면 0 으로 설정하세요.
# UV_NATIVE_TLS=1
# 또는 사내 CA 번들을 명시:
# SSL_CERT_FILE=C:\\ProgramData\\orca\\corp-ca.pem

# ── 프록시 (필요 시) ──
# HTTPS_PROXY=http://proxy.corp.example:8080
# HTTP_PROXY=http://proxy.corp.example:8080
# NO_PROXY=.corp.example,localhost,127.0.0.1
`

// 후보 경로를 낮음→높음 우선순위로 반환.
function candidatePaths(): string[] {
  const installDir = app.isPackaged
    ? join(process.resourcesPath, 'orca.env')
    : // dev: main 번들은 <app>/out/main → 프로젝트 루트로 두 단계 거슬러 올라간다.
      join(__dirname, '../..', 'orca.env')

  const machineDir =
    process.platform === 'win32'
      ? join(process.env.PROGRAMDATA ?? 'C:\\ProgramData', 'orca', 'orca.env')
      : '/etc/orca/orca.env'

  const userDir = join(app.getPath('userData'), 'orca.env')

  return [installDir, machineDir, userDir]
}

// KEY=VALUE 한 파일을 파싱. 빈 줄/`#` 주석 스킵, `export ` 접두 허용, 앞뒤 따옴표 제거.
// dotenv 의존을 피하기 위한 최소 파서 — 멀티라인/변수확장은 지원하지 않는다.
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    let key = line.slice(0, eq).trim()
    if (key.startsWith('export ')) key = key.slice('export '.length).trim()
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    // 앞뒤 동일 따옴표 한 쌍만 제거.
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

// 후보 env 파일을 우선순위대로 process.env 에 주입. 적용된 파일 경로 목록 반환(로깅용).
// 실제 OS 환경변수(부팅 시점 키)는 절대 덮어쓰지 않는다. 파일끼리는 높은 우선순위가 override.
export function loadOperatorEnv(): string[] {
  // 부팅 시점의 실제 OS env 키 스냅샷 — 이 키들은 파일로 덮어쓰지 않는다.
  const osKeys = new Set(Object.keys(process.env))
  const applied: string[] = []

  for (const file of candidatePaths()) {
    if (!existsSync(file)) continue
    let parsed: Record<string, string>
    try {
      parsed = parseEnv(readFileSync(file, 'utf-8'))
    } catch {
      continue // 읽기/파싱 실패한 파일은 조용히 스킵 — 부팅을 막지 않는다.
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (osKeys.has(k)) continue // 실 OS env 최우선
      process.env[k] = v // 낮음→높음 순회라 높은 우선순위가 자연히 override
    }
    applied.push(file)
  }

  return applied
}
