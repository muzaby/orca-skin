# Backend Architecture — Security & Credentials (보안 경계·자격증명)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [provider-runtime.md](./provider-runtime.md), [adapters.md](./adapters.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.
> Decision rationale: [ADR-003](../../decisions/003-electron-network-stack.md) — 왜 main 이 Node `fetch` 를 쓰지 않는가.

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

→ 모든 접근은 IPC 채널을 통해서만 가능하며, 채널은 [IPC_CONTRACT.md](../../IPC_CONTRACT.md) 에 정의된 것만 사용한다.

### 1.3 현재 자격증명 (Phase 2)

- 앱은 비밀을 디스크에 저장하지 않는다.
- claude-code SDK 가 `~/.claude` 디렉토리의 자격증명 (OAuth / API key) 을 자동 사용.
- 디스크 암호화는 OS 에 위임.

### 1.4-b Provider 플랫폼 — credential 3계층 (0181)

0180 이 지운 자리에 `Provider` 선언 하나를 축으로 다시 세웠다. 계층은 셋이다:

| 계층 | 구현 | 담는 것 |
|---|---|---|
| **Vault** | `infra/vault.ts` (safeStorage 위 네임스페이스 뷰) | 값. 키는 **`provider:<authId>:<authKind>@<세대>`** — 새 자격증명은 매번 새 세대 키에 앉고 `Grant.vaultKey` 가 포인터다(교체 원자성, `auth.md` §4.3). 동결 계약은 **prefix `provider:`** 이고 세대 없는 옛 키를 가리키는 grant 도 그대로 읽힌다 |
| **Browser session** | `infra/browser-session.ts` (Electron `Session`, partition `persist:auth.<group>`) | cookie jar. 값이 아니라 **세션**이라 반출되지 않는다 |
| **Grant** | `features/auth/store.ts` + `store-file.ts`(electron-store) | vault 키·방식·만료. **비밀 없음** |

**복호화 실패와 부재를 구분한다.** safeStorage 는 쓰기가 fail-closed(throw), 읽기는 null 강등이라
비대칭이다. 그 강등은 유지하되(키체인 잠김 하나로 앱이 죽지 않도록) grant 상태를 `unknown` 으로
남겨 **조용한 미인증 진행**을 막는다.

#### raw secret 이 프로세스 밖으로 나가는 문서화된 예외 — **3곳** (표 밖 신규 노출 금지)

| # | 경로 | 왜 불가피한가 | 완화 |
|---|---|---|---|
| 1 | **MCP `.mcp.json`** — `dist/plugins/orcinus-orca/.mcp.json` 에 해석된 값이 평문으로 렌더된다 | claude CLI 가 그 파일을 읽어 MCP 서버를 spawn 한다 — Orca 가 요청 주체가 아니다 | 미해결 참조는 그 **서버를 통째로 드롭**(fail-closed). 소유권이 provider 하나로 일원화돼 회전·해제가 한 곳 |
| 2 | **LLM `--settings` argv** — provider `settings.json` 의 `env` 블록 | 사용자가 `~/.claude/settings.json` 과 같은 방식으로 직접 적는 값(0028) | Orca 는 이 파일에 **쓰지 않는다**. 확장·주입도 하지 않고 verbatim 으로 읽는다 |
| 3 | **LLM `Options.env`** (0181 신규) — 인증된 provider 의 자격증명을 subprocess 환경변수로 병합 | SDK 가 subprocess 를 띄우므로 자격증명은 프로세스 경계를 넘어야 한다 | **디스크에 남지 않는다**(subprocess 수명). 미인증이면 그 키를 **드롭**(빈 문자열 치환 금지). 0028 이 없앤 "설정 파일에 토큰 기록" 은 되살리지 않는다 |

> 세 경로 모두 **값의 소유권은 vault** 이고, 나가는 시점이 다를 뿐이다. 새 노출 경로를 추가하려면
> 이 표에 행을 더하는 것이 선행 조건이다.

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

> **첫 실사용처 (MCP 서버 설정)**: 전역 MCP 서버 설정의 인증값(stdio API 키 / http Bearer 토큰)이 본 모델의 첫 구현이다. **저장 위치는 electron-store(`orcinus-orca-secrets`) + safeStorage 조합**. 활성 MCP 설정을 배포할 때 resolver가 비밀을 해석한다. 확장된 값의 배포 파일 사용은 아래에 서술한다. `isEncryptionAvailable()` 이 false 면 저장을 거부(에러). EngineSettings 의 어댑터별 base URL/API key 는 동일 패턴을 따른다(후속).
>
> **MCP & Skill 통합 레이어 (파일-백드 모델로 재설계)**: 초기 구현은 `orca-mcp` 스토어에 풍부한 per-server 레코드(authEnc 포함)를 담았으나, 이후 **정규 소스 = `~/.config/orcinus-orca/mcp.json`** (순정 Claude `mcpServers` 스키마 + `${VAR}` 플레이스홀더) 로 이전했다. 3출처 분할:
> - **소스** (`mcp.json`, `~/.config/orcinus-orca`): 정의의 진실. 순정 Claude 스키마만 — Claude Code 로 그대로 복사 가능. `${VAR}` 만 있고 **평문 비밀 0**. atomic write(temp+rename).
> - **비밀** (`secret-store`, `orcinus-orca-secrets` + safeStorage): **env-var 이름**으로 키잉(서버 id 아님) → 여러 서버가 같은 `${TOKEN}` 공유. 소스는 `${VAR}`로 이 값을 참조하며, 배포 산출물에는 해석한 값이 렌더된다.
> - **enabled / description** (settings `mcpEnabled` / `mcpMeta`): per-install UI 상태 + Claude 스키마에 없는 Orca 메타. 정의(mcp.json) 와 분리(D2).
>
> **`${VAR}` resolver 순서 (0157 개정) = `${BINDING:<id>}`(인증 플랫폼 binding) → safeStorage(비밀) → **명시 allowlist 에 있는 경우에만** process.env**. 구 구현은 `process.env` **전체**가 fallback 이라 앱 환경의 임의 값이 이름만 맞으면 MCP 설정으로 샜다 — 이제 `orcinus-orca.json` 의 `secrets.envAllowlist` 에 **정확한 이름**을 적은 것만 허용한다(패턴·접두사 없음, 미지정이면 fallback 0건). 미해결 변수가 있으면 해당 **서버를 드롭 + 사유 기록** — 조용한 빈 문자열 치환 금지(인증 없는 요청 누출 방지).

> **provider settings**: 사용자가 `sources/settings/<harness>/<provider>/settings.json`에 적은 env는 파일 소스로 남는다. 실행 설정은 settings 계층이 읽고 runtime 구성과 함께 adapter에 전달한다. MCP 배포 파일의 비밀 처리와는 별개의 경로다.
>
> **타입 모델**: 정규 컬렉션 타입은 `OrcaMcpConfig`(claude-code 스펙). Claude 형식은 이와 동일하므로 **별칭** `type ClaudeMcpConfig = OrcaMcpConfig` 로 못박는다. 단일 항목 타입 `ClaudeMcp` 의 http/sse 는 분리된 판별 멤버라 SDK `McpServerConfig`(stdio|http|sse) 유니온에 그대로 대입된다. **"IR(중간형)" 표현은 쓰지 않는다** — 정규형이 곧 claude-code 스펙.
>
> **MCP 변환 경계**: `features/extensions/mcp/convert.ts`의 `toClaudeConfig`가 서버별 env/header 확장과 미해결 제외를 함께 수행한다. `OrcaMcpConfig`와 `ClaudeMcpConfig`는 동형이며 http/sse/stdio 구조를 보존한다. OpenCode 변환기와 실행 연동은 미구현이다.
>
> **소스와 배포 산출물**: `writeMcpFile`은 편집한 소스를 저장한다. Bootstrap은 활성 소스를 resolver로 확장해 `deploy`에 전달하며, 배포기는 `dist/claude/plugins/orcinus-orca/.mcp.json`에 렌더한다. 따라서 확장된 비밀이 배포 파일에 존재하는 현재 제약이 있다. 변환기는 입력 소스를 변경하지 않고 미해결 서버는 제외한다.
>
> **확장 정규 레이어**: 소스와 배포 책임은 [standardization.md §5](./standardization.md)에 서술한다. MCP의 현재 변환 진입점은 `toClaudeConfig`이며, 별도의 확장 전달 모듈은 없다.
>
> - **정규 소스**: 편집 가능한 MCP·skill 소스와 배포 산출물을 구분한다. 현재 디렉토리 배치는 [standardization.md §5](./standardization.md)를 참조한다.
> - **Claude 배포·주입**: 배포기가 Orca skill과 MCP를 `dist/claude/plugins/orcinus-orca` 플러그인에 렌더하고, 사용자 skill은 별도 wrapper로 연결한다. Adapter는 plugin 경로를 SDK에 전달한다. SDK 메모리 MCP 서버는 runtime tool 경로가 별도로 공급한다.
> - **opencode 어댑터 머티리얼라이즈**(future anchor, 미구현): 설정은 디스크 파일만 가능한 모델이 아니다. SDK server helper의 `config`는 `OPENCODE_CONFIG_CONTENT`로 전달되고 config API도 존재한다([SDK 해설](../../opencode-sdk-spec.md)). 어느 경로를 쓸지는 후속 설계 사항이며, 확장된 평문 비밀을 `opencode.json`에 쓰는 해법을 기본값으로 삼지 않는다. skill/agent/command 변환·배포도 아직 구현하지 않았다.
>
> **이식성 경계 (= 변환 가능성)**: **Skill(`SKILL.md`)** 은 변환 없이 양 백엔드 공통(opencode 가 `.claude/skills`·`~/.claude/skills` 네이티브 글로빙). **MCP/Agent/Command** 는 변환 가능(MCP 는 구현됨, agent/command 변환기는 anchor). **Hook·full-plugin 번들** 은 본질적으로 백엔드 종속(Claude=선언형 `hooks.json`+shell·manifest 디렉토리 / opencode=TS 코드 모듈; SDK 도 Claude=인프로세스 vs opencode=`serve` HTTP) → 정규화 대상이 아니며 향후 백엔드별 슬롯으로 둔다. `skill-creator` 같은 full Claude 플러그인은 정규 모델에 포함하지 않는다(필요 시 `SKILL.md` 만 `skills/` 로 추출).
>
> **마이그레이션**: 레거시 `orca-mcp` 레코드 → 파일 모델 1회 이전(부팅 시, `mcp.json` 부재 시에만). 레거시 authEnc 복호화 → secret-store 재저장, enabled → settings. safeStorage 잠김 시 비밀 없이 이전(재입력 필요 로그) — 평문/빈 플레이스홀더 금지. 레거시 스토어는 한 릴리스 보존(롤백 안전망).

### 1.5 외부 콘텐츠 처리

- 마크다운 렌더링: react-markdown 기본값 (raw HTML 비활성). 이미지는 data-uri 만 허용.
- 외부 링크: `shell.openExternal` 경유, 절대 `webContents` 에서 직접 열지 않음.
- `will-navigate` / `setWindowOpenHandler` 에서 외부 URL 모두 거부.
- **의도적 예외 — 통제된 로그인 창**: `infra/browser-session.ts` 의 `openLoginWindow` 는 배포 선언(`app/deployment/`, 컴파일 타임)이 지정한 URL 을 **전용 격리 창**에 로드한다. 앱 본창 정책은 불변이며, 이 창은 (a) `session.fromPartition(partitionFor(sessionGroup))`(`persist:auth.<group>`) 으로 앱 세션과 쿠키 격리, (b) preload 없음 + `contextIsolation`/`sandbox` 강제 + `nodeIntegration:false`, (c) `isDone(url)` 매칭 또는 타임아웃 시 즉시 destroy 로 경계를 좁힌다. 쿠키를 호출자에게 돌려주지 않고 handle 과 최종 URL·probe 판정만 준다.
- DevTools 자동 오픈: dev 빌드 (`process.env.NODE_ENV !== 'production'`) 한정.

### 1.6 CSP

`src/renderer/index.html`:
```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com
```

— Google Fonts CDN 허용. 그 외 외부 도메인 금지.

### 1.7 로그인 게이트 · 배포/업데이트 신뢰 (0072 / 0086 / 0087~0089)

- **앱 로그인 게이트**: `app/RootGate` 가 부팅 위에 게이트를 한 층 얹는다 — 부팅 실패 → 부팅 미완료 → **게이트 미판정/미통과** → 메인 UI 순. 판정은 `features/gate/index.ts` 의 **순수 진리표**이고 상태는 `orca:provider:state` 로 온다.
  - **prod 는 선언이 0개면 통과**(`required:false`) — OSS/기본 배포가 로그인 화면에 갇히지 않게 하는 안전장치이며 `gate.test.ts` 가 회귀로 고정한다.
  - **DEV 는 선언이 0개여도 게이트를 세운다**(`alwaysRequired`, 0089/0130 동작 복원) — 폐쇄망 실값 없이도 로그인 화면을 보고 고칠 수 있어야 하기 때문이다. 그 빌드의 유일한 탈출구가 우회 토글이라, 디버그 패널이 로그인 화면에도 마운트된다.
  - **판정 전에는 통과시키지 않는다**(`gate=null` → 부팅 화면 유지). main 이 잠깐 응답하지 못하는 사이 로그인 강제 빌드가 무인증으로 열리면 안 된다(fail-closed).
  - 게이트 멤버가 여럿이면 **전부 `valid` 일 때만** 통과한다 — 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다.
  - `Settings.authBypass` 는 **DEV 빌드 전용 우회**로 소비자가 돌아왔다(prod 번들에서는 `import.meta.env.DEV` 가 false 로 접혀 분기 자체가 사라진다). 토글은 디버그 패널의 "로그인" 그룹이며 **게이트 화면과 메인 셸 양쪽에** 뜬다 — 메인 셸에만 두면 게이트에 막혔을 때 스위치에 도달할 수 없다. 값이 바뀌면 `settings:set` 핸들러가 provider 상태를 push 해 재시작 없이 반영된다.
  - 게이트는 **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다. 로그인 화면은 창 컨트롤(닫기)을 항상 살려 둬 재시도 루프에 갇히지 않게 한다.

> **0157 이 지운 두 경로 (되살리지 말 것)**: ⓐ 구 `features/sso/modules/` + `contracts/sso.ts` 는 auth-platform 으로 승계돼 **더 이상 없다**. ⓑ 구 `setProviderEnv` sink — 획득 토큰을 provider `settings.json` 의 env 블록에 **평문으로 병합 기록**하던 경로로, 0157 에서 제거됐다(`app/bootstrap.ts:481-483` 주석이 근거를 보존한다). 이제 credential 은 binding·vault 가 소유하고, LLM 백엔드로 나가는 env 값은 **사용자가 직접 적은 것만** 남는다. 구 SecretStore 네임스페이스 `provider:<key>:`(0130 핸드셰이크)도 0157 이후 **쓰는 쪽이 0곳**이며, 인증이 필요한 사용량 조회는 구독 모델로 대체됐다(0176 — `contracts/usage-source.ts`).
- **업데이트/배포 신뢰**: 릴리스는 **unsigned NSIS**(코드 서명 미도입 — OQ, SmartScreen 경고 수용) + GitHub Releases draft(수동 Publish 게이트). electron-updater 는 `latest.yml` sha512 로 산출물 무결성을 검증하고, 릴리스 파이프라인의 `validate-dist.mjs` 가 게시 전 sha512 를 재계산 검증한다(0087). 자동 다운로드는 하지 않는다(`autoDownload=false`, runtime-ipc.md §3.1).

### 1.8 원격 전송 스택 단일화 — main 은 Node `fetch` 를 쓰지 않는다 (0173 / 0174)

main 프로세스의 모든 원격 요청은 **Chromium 네트워크 스택**으로 나간다. Node(undici) 스택은 **OS 프록시·PAC 와 OS 인증서 저장소를 보지 않아**, 사내 프록시 뒤의 사설 CA 서버로 나가지 못한다 — *브라우저로는 열리는데 앱만 안 되는* 증상이 여기서 나온다.

| 규칙 | 구현 | 강제 |
|---|---|---|
| **전역 `fetch(` 를 호출할 수 있는 파일은 `infra/net/net-fetch.ts` 하나뿐** | 가드가 `src/main/**` 전 `.ts` 를 훑어 `net-fetch.ts` 밖의 전역 `fetch(` 호출을 0건으로 고정한다. 메서드 호출(`ses.fetch(`·`ctx.fetch(`·`this.deps.fetchImpl(`)과 주석·문자열 안의 `fetch(` 는 위반이 아니다 — 가드가 **자기 정규식의 오탐/미탐을 스스로 고정**한다(측정력 0인 위생 테스트 방지) | `infra/net/no-node-fetch.test.ts` |
| **Chromium 요청·세션은 infra에서 소유한다** — `net-fetch.ts`·`net-request.ts`·`infra/browser-session.ts` | 판정·변환은 순수 모듈로 분리하고, 요청 수명·수신 제한은 `sendOnce`가 소유한다. Electron을 대체한 emitter 테스트가 실제 배선에 진입한다 | `infra/net/net-request.test.ts`·`net-response.test.ts` |
| 소비자는 `typeof fetch` **포트로 주입받는다** — `ProviderApiImpl.fetchImpl`(0181) · `createSender(fetchImpl)` | **기본값을 두지 않는다** — 기본값은 곧 조용한 Node 스택 복귀다 | 위와 동일 |
| **`redirect:'manual'` 은 Electron 에서 의미가 다르다** — 웹 fetch 는 3xx 를 돌려주지만 Electron 은 **요청을 취소한다**(`followRedirect()` 를 동기 호출해야 이어진다) | 3xx 를 직접 받아야 하면 `infra/net/net-request.ts` 의 `sendOnce`(`net.request` 의 `'redirect'` 이벤트로 3xx 재구성). `netFetch` 가 manual 요청을 그리로 우회한다. **추종은 호출자가** 한다(홉마다 정책을 검사해야 하므로) | `infra/net/net-response.test.ts` |
| **선택한 `maxBytes`는 수신 중 적용한다** | credential sender는 Main 내부 `RequestInit` 확장으로, cookie sender는 직접 `sendOnce`에 전달한다. 선언 길이 또는 누적 bytes가 상한을 넘으면 초과 chunk를 보관하기 전에 abort한다. 성공·오류·취소 후 signal 리스너를 회수한다 | `infra/net/net-request.test.ts` |

> 이 규칙은 보안 경계이자 *동작* 경계다. 위반해도 로컬·개방망에서는 통과하고 **사내망에서만 실패**하므로, 리뷰가 아니라 테스트로 잡는다.

### 1.9 전송·세션 인프라 인벤토리

0180 이 인증 인프라 6모듈을 삭제하면서, **인증이 아니었던** 원격 전송 스택 3모듈을
`infra/auth/` → `infra/net/` 으로 옮겼다. 디렉토리 이름이 `auth` 라서 함께 지워질 뻔한 것이
이설의 이유다. 0181 이 그 위에 세션·전송 2모듈을 되살렸다.

| 모듈 | 책임 | electron |
|---|---|---|
| `net/net-fetch.ts` | Chromium `net.fetch` — **전역 `fetch(` 를 부를 수 있는 유일한 파일** (§1.8) | ✓ |
| `net/net-request.ts` | `net.request` 기반 단일 홉 전송·수신 중 상한 검사·취소 정리. manual 3xx를 호출자에게 반환 (§1.8) | ✓ |
| `net/net-response.ts` | 응답 판정·변환 **순수부** — electron 미의존이라 테스트가 직접 import 한다 | — |
| `net/transport.ts` (0181) | 인증된 요청의 전송 조각 — `PreparedRequest`·상한 검사·`createSender(fetchImpl)`. **도메인 타입을 모른다**(infra → contracts 는 DAG 역방향) | — |
| `browser-session.ts` | session group → Electron `Session` 매핑 · 통제된 로그인 창 · 세션 쿠키로 보내는 요청 | ✓ |
| `browser-session-policy.ts` | partition 이름·origin allowlist·`ERR_ABORTED` 판정 **순수부** | — |
| `loopback-callback.ts` (0181) | OAuth 루프백 콜백 1회성 리스너(127.0.0.1, RFC 8252). node `http` 만 쓴다 | — |
| `vault.ts` | safeStorage 위 네임스페이스 뷰. 값·metadata·index (§1.4-b) | — |

---



### Agent provider auth token

provider `settings.json`(`sources/settings/<adapter>/<provider>/`)은 `~/.claude/settings.json` 과 **동일 스키마·동일 취급**이다(handoff 0028). 접근 토큰·base URL 등 인증 env 는 사용자가 그 파일의 `env` 블록에 **직접** 적어 관리한다(Claude Code 정책 그대로). Orca 는 이 env 에 대해 `${VAR}` 확장도, secret-store 토큰 주입(구 `provider:${key}`→`ANTHROPIC_API_KEY`, 0010/0015)도 **하지 않는다** — settings 를 verbatim 으로 읽어 그대로 주입한다. (secret-store `provider:` 토큰 경로는 0028 에서 폐지. secret-store/safeStorage 자체는 MCP 인증값 전용으로 유지.) provider settings 는 dist 에 배포하지 않고 sources 파일만 읽으므로 **디스크 평문 0** 은 유지된다.

**env→`options.settings` 주입 (handoff 0028 — 0015/0018 "env↛argv" 불변식 폐기)**: provider settings 는 `query()` 의 flag 레이어(`options.settings` → CLI `--settings`)로 주입된다. `settingSources` 를 생략해 상속한 사용자 `~/.claude/settings.json` 위에 이 flag settings 가 얹혀 **덮어쓰므로**, 앱 환경구성(env 포함)이 사용자 전역 env 를 이기려면 env 가 settings 레이어에 있어야 한다. 따라서 env 를 settings 안에 그대로 실어 주입한다. 이 값은 SDK 가 직렬화 없이 CLI argv 에 push 하므로 env(auth key 포함)가 **process list(같은 사용자에게 가시)에 노출**되는데, 이는 "앱 환경구성으로 ~/.claude 를 덮어쓴다"는 요구를 위한 **수용된 트레이드오프**다(same-user 한정 — Claude Code 의 `--settings` 와 동일 노출 특성). `options.env` 에는 시스템(턴) env(uv 런타임 + orcinus-orca.json 앱 env)만 싣는다.

> **이력**: 0015/0018 은 평문 비밀의 argv 노출을 막고자 env 를 settings 에서 떼어(`splitProviderSettings`) subprocess env 로만 흘리고, 이를 branded 타입(`ArgvSafeSettings`/`SubprocessEnv`) + 음성 타입 테스트로 컴파일타임 강제했다. 그러나 그 방식으로는 `options.env` 가 settingSources 의 `~/.claude/settings.json` env 를 덮어쓰지 못해 앱 환경구성이 무력화됐다. 0028 이 이 split·branded·음성 테스트를 제거(supersede)한다. 0015/0018 문서는 historical 로 보존한다.

## 산출물 파일 액션 경계

게시 입력은 채널의 cwd/extraDirs 안에 있는 로컬 일반 파일만 허용한다. 경로 실체, UTF-8 형식, 크기 상한, 읽기 전후 상태를 검사한다. 이 파일 검증은 OS 샌드박스가 아니며 악의적인 모든 경로 교체 경쟁의 원자적 차단을 보장하지 않는다.

artifact IPC는 현재 Orca 메인 창의 최상위 frame과 renderer URL의 protocol/host를 확인한다. renderer는 session/publication ID만 전달하고 Main이 세션 참조와 보관 루트 실체를 다시 검사한다. 개별 내보내기는 임시 파일을 작성하고 rename으로 교체하여 외부 하드링크를 통한 보관 원본 덮어쓰기를 피한다. 묶음 저장은 exclusive create와 접미사로 기존 파일을 보존한다. 파일 reveal은 탐색기 선택만 하며 HTML을 실행하지 않는다.

휴지통 이동은 사용자 확인 후 등록된 파일만 대상으로 하고 영구 삭제로 대체하지 않는다. 모델에는 삭제 도구를 노출하지 않는다. 본문 미리보기는 session/publication ID의 소유권과 제한 읽기를 확인한 뒤 반환한다. HTML은 Main에서 정제한 문서만 격리된 iframe에 표시하며 원문은 코드·복사용으로 보존한다([렌더링 경계](../frontend/rendering.md#산출물-게시-카드)). 보관·소실·복원 규칙은 [persistence.md](persistence.md)에 있다.
