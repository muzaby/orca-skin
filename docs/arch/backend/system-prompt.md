# 시스템 프롬프트 · 정책 append 관리 (Orca / Claude Agent SDK)

> **정본 우선**: 어댑터 내부 구현은 [`adapters.md`](./adapters.md), 배포 계층은
> [`standardization.md`](./standardization.md), 런타임 정규화는
> [`provider-runtime.md`](./provider-runtime.md). 본 문서는 **시스템 프롬프트를 어떻게 주입하고
> 정책 텍스트를 어디에 두며 어떻게 조립하는가** 만 다룬다.
>
> 출처: Opus 4.8 작성 "시스템 프롬프트 관리 가이드 ver2"(`@anthropic-ai/claude-agent-sdk` 일반론)를
> Orca 실제 코드·확정 핸드오프 결정과 1:1 대조해 교정한 결과 (handoff `0030-system-prompt-policy-structure`).
> 가이드의 SDK 일반 원리(stateless `query()`·`resume`=히스토리·prefix 캐시·단일 문자열 append)는
> 그대로 유효하므로 여기 재서술하지 않고, **Orca 적용분과 차이점**만 기록한다.

## 1. 현 구현 (Orca 가 이미 하는 것)

가이드 1~3장의 결론은 대부분 Orca 현 설계와 **이미 일치**한다. 근거 파일과 함께:

| 항목 | Orca 구현 | 근거 |
|---|---|---|
| `claude_code` preset + `append` | `adaptSystemPrompt()` 가 `{type:'preset', preset:'claude_code', append}` 반환 | `app/src/main/adapters/claude-adapt.ts` |
| `append` 는 **단일 문자열** | 빌더가 `지침\n\n정책` 단일 string 조립(다중 블록 4-블록 버그 회피) | `app/src/main/extensions/builder.ts` |
| 매 턴 `query()` + `resume` | per-turn 새 `query({resume})`, streaming-input 으로 턴 격리 | `app/src/main/adapters/claude.ts` |
| `excludeDynamicSections` 생략(=false) | 미사용 → cwd/플랫폼/메모리 경로 동적섹션을 시스템 프롬프트에 유지 | grep 0건 |
| 출력 스타일 미사용 | 정책은 전부 `append` 로 주입 | — |

> 즉 **주입 메커니즘은 변경 대상이 아니다.** 이번(0030) 변경은 §2 의 *정책 텍스트 관리 구조* 뿐이다.

## 2. 정책 문자열 관리 구조 (`app/src/main/prompts/`, handoff 0030)

가이드 5장(정책 문자열 관리)을 Orca main 레이어에 맞춰 도입했다. **관리는 여러 조각, 주입은 한 덩어리**.

### 2.1 디렉토리 (L1 domain)

```
app/src/main/prompts/
  policies/
    python-runtime.md     # (A) STABLE 정적 산문 — 구 PY_AGENT_RULES 본문 이주
    blocks/               # (B) 조건부 블록 본문 — 메커니즘만(현재 비어 있음)
  platformHints.json      # (C) 키-값 룩업 스캐폴드(현재 엔트리 0) + platformHints.ts 접근자
  registry.ts             # PolicyBlock 메타 — id·file·tier·when(조건). 텍스트 아님
  loader.ts               # `.md?raw` 적재 + registry 정합 검증(누락/잉여 throw) + trim
  buildAppend.ts          # tier/when 필터 → '\n\n' join → 단일 문자열
  index.ts                # 배럴
```

- `prompts/` 는 `src/main/*` catch-all 로 **L1 domain 자동 분류**(eslint elements 변경 불필요).
  shared 외 의존 0 → 경계 위반 0. 빌더(L1)→prompts(L1) 동일레이어 import 는 무순환.
- `.md` 번들링은 마이그레이션의 `.sql?raw` 패턴 동형(`db/migrate.ts`). vitest 에서도 동작.

### 2.2 보관 방식 매핑 (성격별)

| 부류 | 보관 | Orca 현황 |
|---|---|---|
| (A) 긴 정적 산문 | `policies/*.md` | `python-runtime.md` 1개(=구 `PY_AGENT_RULES`) |
| (B) 조건부 블록 | 본문 `.md` + 조건 `registry.ts` | **현재 없음** — `tier:'conditional'`+`when` 메커니즘만 |
| (C) 키-값 룩업 | `platformHints.json` | **현재 엔트리 0** — 구조·접근자 스캐폴드 |

### 2.3 핵심 규칙

- **`buildAppend` 는 반드시 단일 문자열 반환** (4블록 버그 회피). conditional 인자는 합성 레지스트리
  단위 테스트용 seam.
- **조립 순서 = `POLICY_REGISTRY` 배열 순서.** stable 을 앞에 둬 변동성 계층(§3)을 강제.
- **신규 정책 추가 절차**: (1) `policies/*.md` 생성 (2) `registry.ts` 등재 (3) `loader.ts` import.
  셋이 어긋나면 `loadPolicies()` 가 throw — 드리프트 차단.
- **무캐시 불변**: `buildAppend` 의 STABLE 부분만 startup 1회 조립(`ipc/router.ts`). **DB 프로젝트
  지침은 빌더가 매 턴 조회**하므로 지침 편집이 같은 세션 다음 메시지부터 즉시 반영된다.

## 3. 변동성 계층 (캐시 레이아웃) — Orca 매핑

| tier | 내용 | Orca 위치 |
|---|---|---|
| STABLE | 정적 정책 본문(python-runtime 등) | `systemPrompt.append` 의 정책 부분 (`prompts/buildAppend`) |
| CONTEXT — 커스텀 지시 | 프로젝트 지침(DB) | `append` 에 결합 (빌더가 매 턴 조회, **무캐시**) |
| CONTEXT — cwd/작업공간 | 실행 환경 | preset 동적 섹션 (SDK 자동, `excludeDynamicSections:false`) |
| VOLATILE | 날짜·메모리 스냅샷 | **현재 없음** (§4 참조) |

> **순서 주의**: 빌더는 `지침\n\n정책` 순으로 둔다(지침이 앞). 가이드 7장은 STABLE-first 를
> 권하지만 `excludeDynamicSections:false` 로 cross-대화 캐시가 preset 동적섹션에서 이미 깨지므로
> append 내부 순서는 캐시상 무의미하다. 무회귀를 위해 현행 순서를 보존한다.

## 4. 전제 차이 (가이드가 Orca 와 다른 부분)

가이드의 일부 전제는 현 Orca 와 맞지 않는다. 결론값이 우연히 같아도 *이유*는 다르다.

| 가이드 전제 | Orca 현실 |
|---|---|
| 3장 "대화마다 고유 cwd" | 현재 cwd = `app.getPath('home')` **고정**(`ipc/router.ts`). per-session cwd 는 Future Scope. `excludeDynamicSections:false` 결정은 유효하나 근거는 "동적섹션 유지" 자체이지 per-session cwd 가 아님 |
| 6장 VOLATILE = 날짜·**메모리 스냅샷** → 첫 user 메시지 | Orca 에 **메모리 기능 없음**. 날짜는 preset 동적섹션이 이미 주입. 현재 격리할 volatile preamble 자체가 없음 → 미구현(기능 도입 시 재검토) |
| 5.3 `src/agent/systemPrompt/` 경로 | Orca 엔 미존재. main L0–L3 DAG 에 맞춰 `app/src/main/prompts/`(L1)로 매핑 |

## 5. Open Questions — 재검토 대상 (가이드 ↔ Orca 확정결정 충돌)

가이드 4·8장의 SDK 처방 3건은 **이미 확정된 핸드오프 결정과 충돌**한다. 사용자 결정(2026-06-18):
**자동 기각도 자동 변경도 아니며 재검토 대상으로 등재**한다. 아래는 분석 + 권고일 뿐, **실제 변경은
사용자 결정 후 별도 핸드오프**에서만 한다 (root `AGENTS.md` "확정 결정 임의 변경 금지").

### OQ-A. `settingSources` 에서 `"local"` 제외?

| | 내용 |
|---|---|
| 가이드 처방 | `settingSources:["user","project"]` — env 충돌 회피 위해 `local` 제외 |
| Orca 확정 | `settingSources` **옵션 생략**(SDK 기본 user/project/**local** 상속). handoff 0023/0024 (0014/0015 격리모드 폐기) |
| 분석 | 가이드는 env 를 `options.settings.env` 로 주입한다고 가정 → `local` 이 그보다 우선이라 충돌. **Orca 는 다른 메커니즘**(OQ-B): provider env 를 `options.settings`(=`--settings` flag)에 실으며, 이는 우선순위 체인 `managed>CLI flags>local>project>user` 에서 `local` 보다 **위**다 → `local` 제외 불필요 |
| 권고 | **현행 유지**(생략). 가이드의 충돌은 Orca 에서 발생하지 않음 |

### OQ-B. env 를 `settings:{env}` 단일 주입?

| | 내용 |
|---|---|
| 가이드 처방 | `settings:{ env: appEnv }` — 앱 env 를 settings 에 단일 주입 |
| Orca 확정 | provider env→`options.settings`(JSON 문자열, `adaptSettings`) / 시스템(턴) env→`options.env`(`adaptEnv`)로 **분리**. `splitProviderSettings` + branded 타입(`ArgvSafeSettings`/`SubprocessEnv`)이 컴파일타임 강제. handoff 0015/0018/0028 |
| 분석 | Orca 분리 모델이 더 정밀(어떤 env 가 어느 레이어로 가는지 타입으로 고정). 가이드의 단일 주입은 이 구분을 잃음 |
| 권고 | **현행 유지**(분리) |

### OQ-C. 세션당 옵션 1회 빌드 + 캐시?

| | 내용 |
|---|---|
| 가이드 처방 | 8장 — 옵션을 세션당 1회 빌드 후 캐시, "설정 변경" 시에만 무효화 |
| Orca 확정 | `ExtensionBuilder` 가 매 턴 DB 지침 조회 — **의도적 무캐시**(지침 편집이 다음 메시지부터 즉시 반영). `extensions/builder.ts` |
| 분석 | STABLE 정책은 0030 에서 이미 startup 1회 조립(캐시 효과). 남는 건 **DB 지침**인데, 이를 캐시하면 "편집 즉시 반영" UX 가 깨진다. 캐시 이득(매 턴 prepared statement 1회)은 미미 |
| 권고 | **현행 유지**(무캐시). STABLE 만 startup 캐시, 지침은 매 턴 조회 |
