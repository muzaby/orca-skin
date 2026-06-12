# Backend Architecture — Security & Credentials (보안 경계·자격증명)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (BACKEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [provider-runtime.md](./provider-runtime.md), [adapters.md](./adapters.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 보안 경계 / 자격증명

### 1.1 BrowserWindow webPreferences (실제 값)

`app/src/main/index.ts` 의 명시 값 (줄 21-23):

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,    // ✅ 필수
    nodeIntegration: false,    // ✅ 필수
    sandbox: true,             // ✅ 필수
    preload: join(__dirname, '../preload/index.js')
  }
})
```

기타 보안 옵션:
- `webSecurity: true` (기본값 유지 — CORS, 외부 리소스 제한)
- `autoHideMenuBar: true`

### 1.2 Renderer 가 절대 접근할 수 없는 자원

- ❌ Node.js API (fs, path, child_process 등)
- ❌ Electron Main 모듈
- ❌ 원본 자격증명 / API 키
- ❌ DB 파일 직접 접근 (Phase 3+ 도입 후)

→ 모든 접근은 IPC 채널을 통해서만 가능하며, 채널은 [IPC_CONTRACT.md](./IPC_CONTRACT.md) 에 정의된 것만 사용한다.

### 1.3 현재 자격증명 (Phase 2)

- 앱은 비밀을 디스크에 저장하지 않는다.
- claude-code SDK 가 `~/.claude` 디렉토리의 자격증명 (OAuth / API key) 을 자동 사용.
- 디스크 암호화는 OS 에 위임.

### 1.4 채택된 자격증명 모델 (Phase 3+ 도입 결정)

> **사용자 결정**: 어댑터별 base URL + API key 직접 저장 필요 (custom 백엔드 / 호스트 선택 지원). SDK 자격증명 위임 단독 의존 폐기.

| 항목 | 채택 결정 |
|---|---|
| 저장 메커니즘 | **Electron safeStorage** (OS keychain — macOS Keychain / Windows DPAPI / Linux libsecret) |
| 저장 대상 | 어댑터별 base URL + API key (+ 필요 시 추가 키) |
| 저장 위치 | **TBD (신규 OQ)** — 로컬 DB 의 `credentials` 테이블 (암호화 blob) vs electron-store + safeStorage 조합 |
| 입력 UI | EngineSettings 화면 (../frontend/ux-domains.md §2) |
| 로그 / 에러 메시지 노출 | **절대 금지** — 마스킹 의무 |
| Linux 추가 의존성 | libsecret 필요 (배포 시 의존성 명시) |

> **첫 실사용처 (MCP 서버 설정)**: 전역 MCP 서버 설정의 인증값(stdio API 키 / http Bearer 토큰)이 본 모델의 첫 구현이다. **저장 위치는 electron-store(`orca-secrets`) + safeStorage 조합**. 복호화는 query 직전 resolver 안에서만 수행(메모리 단기 체류). `isEncryptionAvailable()` 이 false 면 저장을 거부(에러). EngineSettings 의 어댑터별 base URL/API key 는 동일 패턴을 따른다(후속).
>
> **MCP & Skill 통합 레이어 (파일-백드 모델로 재설계)**: 초기 구현은 `orca-mcp` 스토어에 풍부한 per-server 레코드(authEnc 포함)를 담았으나, 이후 **정규 소스 = `~/.config/orca/mcp.json`** (순정 Claude `mcpServers` 스키마 + `${VAR}` 플레이스홀더) 로 이전했다. 3출처 분할:
> - **소스** (`mcp.json`, `~/.config/orca`): 정의의 진실. 순정 Claude 스키마만 — Claude Code 로 그대로 복사 가능. `${VAR}` 만 있고 **평문 비밀 0**. atomic write(temp+rename).
> - **비밀** (`secret-store`, `orca-secrets` + safeStorage): **env-var 이름**으로 키잉(서버 id 아님) → 여러 서버가 같은 `${TOKEN}` 공유. mcp.json 엔 `${VAR}` 만, 실제 값은 여기에만.
> - **enabled / description** (settings `mcpEnabled` / `mcpMeta`): per-install UI 상태 + Claude 스키마에 없는 Orca 메타. 정의(mcp.json) 와 분리(D2).
>
> **`${VAR}` resolver 순서 = safeStorage(비밀) → process.env (2단계)**. 미해결 변수가 있으면 해당 **서버를 드롭 + 사유 기록**(`console.warn`) — 조용한 빈 문자열 치환 금지(인증 없는 요청 누출 방지).

> **provider settings 예외 (0009 → 0014 이전)**: 구 orca.json `agents[].authToken` 의 평문 허용 예외는 **`sources/settings/<adapter>/<provider>/settings.json` 의 `env` 블록으로 이전**됐다(orca.json agents 필드 제거 — TRD §6.8). env 값에 평문과 Claude Code 가 지원하는 settings 표현을 사용할 수 있다. 평문을 쓰는 경우 파일 권한·디스크 보호 책임은 사용자에게 있다. settings 원본은 query 시작 직전에 작업 디렉토리의 `.claude/settings.local.json` 으로 복사된다. provider settings 의 env 를 query `options.env` 로 별도 추출·병합하지 않으며, `options.settings`/`settingSources` 도 주입하지 않는다.
>
> **타입 모델**: 정규 컬렉션 타입은 `OrcaMcpConfig`(claude-code 스펙). Claude 형식은 이와 동일하므로 **별칭** `type ClaudeMcpConfig = OrcaMcpConfig` 로 못박는다. 단일 항목 타입 `ClaudeMcp` 의 http/sse 는 분리된 판별 멤버라 SDK `McpServerConfig`(stdio|http|sse) 유니온에 그대로 대입된다. **"IR(중간형)" 표현은 쓰지 않는다** — 정규형이 곧 claude-code 스펙.
>
> **양 백엔드 대칭 변환 파이프라인** (`src/main/mcp/`): `expandEnv`(순수) → `toClaudeConfig` / `toOpencodeConfig`(순수, **동형 시그니처** — 둘 다 `to<Backend>Config(servers, resolve) → { config: <Backend>McpConfig; dropped }`). `OrcaMcpConfig == ClaudeMcpConfig` 이므로 `toClaudeConfig` 는 **구조적으로 항등**(${VAR} 확장만) — "변환 불필요 특례"로 두지 않고 어댑터 경계에서 값이 `ClaudeMcpConfig` 라는 이름으로 다뤄지는 명시적 지점으로 존재한다. SDK 가 sse 트랜스포트를 지원하므로 sse→http 강제는 하지 않는다. `allowedTools` 는 config 에 넣지 않고 호출부(`buildQueryOptions`)에서 `Object.keys` 로 파생. opencode 변환기는 순수 함수 + 단위 테스트만 존재(어댑터·라이프사이클·백엔드 선택 미구현, `Backend`=`'claude-code'` 유지).
>
> **비밀 누출 불변식**: `writeMcpFile` 은 *미확장 정규 소스*(`OrcaMcpConfig`, `${VAR}`)만 받는다(타입 강제). `expandEnv` 의 확장 결과(평문)는 SDK 주입 타깃(`toClaudeConfig`/`toOpencodeConfig` 출력)으로만 흐르고 절대 파일에 기록되지 않는다.
>
> **확장 정규 레이어 (정규 소스 + 어댑터 머티리얼라이저)**: MCP 의 `정규소스→변환기→주입` 패턴을 확장(skill/agent/command) 전반으로 일반화한다. 백엔드-중립 정규 소스를 `~/.config/orca` 한 곳에 두고, 각 어댑터가 실행 시 자기 백엔드 형식으로 *머티리얼라이즈(주입)* 한다. → 이 패턴의 배포 계층 정본은 [standardization.md §5](./standardization.md)(`ExtensionDeployer`·sources/dist 분리)이며, `toClaudeConfig`/`toOpencodeConfig`/`expandEnv`(`src/main/mcp/`)가 그 mcp 축의 현행 구현체다. sources/dist 도입 시 `mcp.json` 은 `sources/mcp/` 로 이동한다.
>
> - **정규 소스**(백엔드 중립): `~/.config/orca/{skills/<name>/SKILL.md, agents/<name>.md, commands/<name>.md}` + `mcp.json`. 비밀은 secret-store(safeStorage)에만.
> - **Claude 어댑터 머티리얼라이즈**(인프로세스 `query()`): ExtensionDeployer 가 `dist/claude-code/plugin/` 에 `.claude-plugin/plugin.json` + skills/agents/commands 를 렌더 → **그 디렉토리가 Claude 로컬 플러그인**이 된다. `plugins:[{type:'local', path: dist/claude-code/plugin}]` + `skills:'all'` 로 로드(같은 플러그인이라 agents/·commands/ 도 자동 로드). MCP 는 `options.mcpServers` 로 별도 주입(이중 주입 없음), provider settings 는 query cwd 의 `.claude/settings.local.json` 으로 복사(TRD §6.8).
> - **opencode 어댑터 머티리얼라이즈**(future anchor, 미구현): `opencode serve` + config-on-disk 모델이라 query 주입 불가 — `toOpencodeConfig(mcp.json)` 를 `opencode.json` `mcp` 키로 쓰고, skills 는 opencode 가 네이티브 글로빙하는 경로로 심링크/복사, agents/commands 는 변환기로 `~/.config/opencode/{agent,command}` 에 셰이핑.
>
> **이식성 경계 (= 변환 가능성)**: **Skill(`SKILL.md`)** 은 변환 없이 양 백엔드 공통(opencode 가 `.claude/skills`·`~/.claude/skills` 네이티브 글로빙). **MCP/Agent/Command** 는 변환 가능(MCP 는 구현됨, agent/command 변환기는 anchor). **Hook·full-plugin 번들** 은 본질적으로 백엔드 종속(Claude=선언형 `hooks.json`+shell·manifest 디렉토리 / opencode=TS 코드 모듈; SDK 도 Claude=인프로세스 vs opencode=`serve` HTTP) → 정규화 대상이 아니며 향후 백엔드별 슬롯으로 둔다. `skill-creator` 같은 full Claude 플러그인은 정규 모델에 포함하지 않는다(필요 시 `SKILL.md` 만 `skills/` 로 추출).
>
> **마이그레이션**: 레거시 `orca-mcp` 레코드 → 파일 모델 1회 이전(부팅 시, `mcp.json` 부재 시에만). 레거시 authEnc 복호화 → secret-store 재저장, enabled → settings. safeStorage 잠김 시 비밀 없이 이전(재입력 필요 로그) — 평문/빈 플레이스홀더 금지. 레거시 스토어는 한 릴리스 보존(롤백 안전망).

### 1.5 외부 콘텐츠 처리

- 마크다운 렌더링: react-markdown 기본값 (raw HTML 비활성). 이미지는 data-uri 만 허용.
- 외부 링크: `shell.openExternal` 경유, 절대 `webContents` 에서 직접 열지 않음.
- `will-navigate` / `setWindowOpenHandler` 에서 외부 URL 모두 거부.
- DevTools 자동 오픈: dev 빌드 (`process.env.NODE_ENV !== 'production'`) 한정.

### 1.6 CSP

`src/renderer/index.html`:
```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com
```

— Google Fonts CDN 허용. 그 외 외부 도메인 금지.

---



### Agent provider auth token (0010 → 0014)

앱에서 추가되는 adapter/provider 조합의 접근 토큰은 secret store(safeStorage) 키 `provider:${provider key}` 에만 저장한다(키 규약 0010 유지). settings 해석 시점에만 복호화해 effective settings 의 `env.ANTHROPIC_API_KEY` 로 합성하며 DB, renderer IPC DTO, 로그, dist 산출물에는 평문·해시를 남기지 않는다. settings.json `env` 의 수동 설정 경로는 권장값이 `${VAR}` placeholder 다(위 "provider settings 예외").
