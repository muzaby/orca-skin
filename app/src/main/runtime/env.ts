import { getRuntimePaths } from './paths'

// Python 런타임 환경변수 단일 소스.
// 초기화(PythonRuntime)와 agent 실행(IpcRouter → ClaudeAdapter → query())이
// 반드시 같은 env 를 사용한다.
//
// 설계 원칙:
//   1. ...process.env 로 시작해 operator 가 미리 심어 둔 UV_*/PIP_*/PROXY 를 흡수한다.
//      UV_PYTHON_INSTALL_MIRROR, UV_DEFAULT_INDEX, PIP_INDEX_URL 등은
//      하드코딩하지 않고 pass-through — 미설정이면 uv 기본(공개 PyPI/github)으로 동작.
//   2. 격리 경로 변수를 덮어써 userData 내부로만 수렴한다.
//   3. UV_CONFIG_FILE 로 앱 전용 config 를 명시 지정 → 사용자 전역 config '대신' 사용
//      (병합·충돌 없음). UV_NO_CONFIG 는 절대 설정하지 않는다(인덱스 설정까지 무력화).
//   4. venvBin + uvDir 을 PATH 최우선에 놓아 agent 셸에서 `python`/`uv` 가 내장 환경을 가리킨다.
export function buildPyEnv(userData: string): Record<string, string> {
  const p = getRuntimePaths(userData)
  const sep = process.platform === 'win32' ? ';' : ':'
  const uvDir = p.binDir // uv 바이너리가 복사되는 디렉토리 (userData 최상위 bin/)

  return {
    ...process.env,
    // ── 위치 격리 ──
    UV_PYTHON_INSTALL_DIR: p.pythonDir,
    UV_CACHE_DIR: p.cacheDir,
    UV_PROJECT_ENVIRONMENT: p.venvDir,
    // ── 정책: 시스템 Python 무시, 내장 관리 인터프리터만 사용 ──
    UV_PYTHON_PREFERENCE: 'only-managed',
    // ── 앱 config 1순위 (사용자 전역 config '대신' 사용 → 충돌 없음) ──
    UV_CONFIG_FILE: p.appUvToml,
    PIP_CONFIG_FILE: p.appPipConf,
    // ── agent 셸: venvBin + uvDir 을 PATH 최우선 ──
    VIRTUAL_ENV: p.venvDir,
    PATH: `${p.venvBin}${sep}${uvDir}${sep}${process.env.PATH ?? ''}`
  } as Record<string, string>
}
