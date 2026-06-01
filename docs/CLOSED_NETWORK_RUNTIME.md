# 폐쇄망 uv 런타임 배포 가이드

Orca 는 agent 의 Python 실행을 위해 `<userData>/runtime` 에 **uv 격리 환경**을 둔다. 첫 실행 시
`uv python install 3.12` 로 인터프리터(python-build-standalone)를 받고 venv 를 만든다. 폐쇄망에서는
이 다운로드가 `github.com` 도달 실패 또는 사내 MITM 프록시의 `UnknownIssuer` 인증서로 막힌다.

이 문서는 **운영자가 배포 후에도 사내 미러/인덱스/프록시/TLS 를 주입**하는 방법을 설명한다.

## 1. 동작 원리 — `orca.env` 주입

main 프로세스는 부팅 시 `loadOperatorEnv()` (`app/src/main/runtime/envFile.ts`) 로 `orca.env` 파일을
읽어 `process.env` 에 흡수한다. 흡수된 값은 `buildPyEnv` (`app/src/main/runtime/env.ts`) 의
`...process.env` pass-through 로 **인터프리터 설치 단계와 agent 실행 단계 모두**에 흐른다.

> 더블클릭으로 실행되는 production 앱은 IT 가 per-app 환경변수를 주입하기 어렵다. `orca.env` 파일이
> 그 입력구다.

### 파일 위치 (우선순위 낮음 → 높음)

| 순위 | 위치 | 용도 |
|---|---|---|
| 1 (낮음) | `<설치 디렉토리>/orca.env` — packaged 시 `resources/orca.env` | MSI/GPO 대량배포, 사용자 읽기전용 |
| 2 | `%PROGRAMDATA%\orca\orca.env` (Windows) / `/etc/orca/orca.env` (macOS·Linux) | 머신 전역, 관리자 1회 배포 |
| 3 (높음) | `<userData>/orca.env` | 사용자별 override |

- 높은 순위 파일이 낮은 순위 파일의 같은 키를 **덮어쓴다**.
- **실제 OS 환경변수가 항상 최우선** — 파일은 이미 설정된 OS env 키를 덮어쓰지 않는다(표준 dotenv 시맨틱).
- 형식: `KEY=VALUE` 한 줄씩. 빈 줄과 `#` 주석 무시, `export ` 접두 허용, 앞뒤 따옴표 한 쌍 제거.

`<userData>` 경로(Windows): `%APPDATA%\orca`. 첫 실행 후 같은 위치에 주석 처리된
**`orca.env.example`** 가 생성되니 복사해서 쓰면 된다. 설치 디렉토리에도 동일 템플릿이 동봉된다.

## 2. 설정할 변수

```ini
# Python 인터프리터(python-build-standalone) 사내 미러
UV_PYTHON_INSTALL_MIRROR=https://mirror.corp.example/python-build-standalone

# 패키지 인덱스 (uv / pip)
UV_DEFAULT_INDEX=https://mirror.corp.example/simple
PIP_INDEX_URL=https://mirror.corp.example/simple

# TLS — 기본값 1 (OS 신뢰저장소). 사내 CA 가 OS 에 설치돼 있으면 UnknownIssuer 극복.
UV_NATIVE_TLS=1
# 또는 사내 CA 번들 명시:
# SSL_CERT_FILE=C:\ProgramData\orca\corp-ca.pem

# 프록시 (필요 시)
HTTPS_PROXY=http://proxy.corp.example:8080
NO_PROXY=.corp.example,localhost,127.0.0.1
```

### `UV_PYTHON_INSTALL_MIRROR` — 사내 미러 구성

uv 는 이 URL 아래에서 `astral-sh/python-build-standalone` 릴리스 자산과 동일한 경로 구조의 tarball 을
찾는다. 사내 미러에 해당 릴리스 자산(예:
`cpython-3.12.13+20260510-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`)을 동일 경로로 미러링하면
된다. 미러는 `.../python-build-standalone/releases/download/<tag>/<asset>` 형태를 그대로 반영해야 한다.

### TLS (`UV_NATIVE_TLS`)

- 기본값 `1`. uv 의 번들 rustls(webpki) 대신 **OS 신뢰저장소**로 TLS 를 검증한다. 사내 CA 가 GPO 등으로
  OS 에 설치돼 있으면 사내 MITM 프록시의 `invalid peer certificate: UnknownIssuer` 가 해소된다.
- 일반망에서도 무해하다(공개 CA 는 OS 저장소의 부분집합).
- OS 저장소에 CA 를 넣을 수 없으면 `SSL_CERT_FILE` 로 CA 번들 파일을 직접 지정한다.
- 끄려면 `UV_NATIVE_TLS=0`.

## 3. 빌드 단계 (uv 바이너리 다운로드)

`uv` **바이너리 자체**는 빌드 전에 `scripts/fetch-uv.mjs` 가 GitHub 릴리스에서 받아
`resources/bin/<platform>-<arch>/` 에 둔다(`npm run fetch-uv`). 이 스크립트는:

- 표준 프록시 환경변수(`HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY`, 소문자 변형, `NO_PROXY`)를 자동 감지해
  undici `ProxyAgent` 로 다운로드한다.
- `node --use-system-ca` 로 OS 신뢰저장소를 사용한다(사내 CA 지원).
- `UV_VERSION` 으로 버전 고정 가능.

빌드 머신이 폐쇄망이면 `fetch-uv` 단계에 위 프록시/CA 가 필요하다. 런타임의 `orca.env` 와는 별개다.

## 4. 트러블슈팅 — 보고된 오류

```
uv python install 3.12 …
error: Failed to install cpython-3.12.13-windows-x86_64-none
  Caused by: Failed to download https://github.com/astral-sh/python-build-standalone/...
  Caused by: client error (Connect)
  Caused by: invalid peer certificate: UnknownIssuer
```

| 증상 | 원인 | 조치 |
|---|---|---|
| `client error (Connect)` | github.com 도달 불가 | `UV_PYTHON_INSTALL_MIRROR` 를 사내 미러로 지정 |
| `invalid peer certificate: UnknownIssuer` | 사내 MITM 프록시 CA 미신뢰 | 사내 CA 를 OS 신뢰저장소에 설치(`UV_NATIVE_TLS=1` 기본) 또는 `SSL_CERT_FILE` 지정 |
| 프록시 경유 필요 | 직접 연결 차단 | `HTTPS_PROXY` / `NO_PROXY` 설정 |

런타임 초기화가 실패하면 RuntimeModal 에 위 항목을 안내하는 한국어 remediation 힌트가 자동 표시된다
(`PythonRuntime._withRemediation`). 값을 채운 뒤 재시도하면 된다.

## 5. 검증

1. `<userData>/orca.env` 또는 머신 전역 경로에 `UV_PYTHON_INSTALL_MIRROR` 등을 작성.
2. dev: `npm run dev` → 터미널에 `[runtime] env: <적용된 orca.env 경로>` 로그 확인.
3. 헤드리스 사전 준비: `npm run prepare-runtime` → `ready` 면 0, 실패면 1 종료.
4. 인터프리터 설치 로그가 사내 미러로 요청하는지 확인 → `ready` 도달.
