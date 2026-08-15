# Verify — 0188-auth-harness-plugin-lightweight

> 절차 정본은 [`.agents/skills/handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0188-auth-harness-plugin-lightweight` |
| 검증자 | Claude Code |
| 일자 | 2026-08-15 |
| 대상 커밋/range | `f76e9604..7a643eb4` (구현 커밋 `2bebd670` ~ `c01d0173`, 12건) |
| 구현 전 plan 기준 | `f76e9604` (plan/READY 커밋) |
| 라운드 | 10 |
| 상태 | **PASS** |
| 자기 검증 여부 | **예** — 설계·구현·검증이 모두 Claude Code 다(비기능 = Claude 직접 구현, `../AGENTS.md §역할 분담`). 완화: ① 채점 기준을 `f76e9604` 의 plan 으로 잠갔다 ② 구현 보고·코드 주석·`Criteria-Met` 을 증거로 쓰지 않고 production path 를 직접 읽었다 ③ 게이트를 이 환경에서 재실행해 실측했다 ④ 라운드 1~10 의 외부 리뷰가 짚지 않은 표면을 역방향으로 따로 훑었다. **그럼에도 독립 검증자가 아니라는 사실은 이 판정의 한계로 남는다.** |

## 0. 기준선 / plan 변경 확인

`git diff f76e9604..HEAD -- plan.md` 전수 대조.

- **구현 커밋이 `plan.md` 를 변경했는가**: 했다(+183줄). 변경은 세 종류다.
- **Decision Ledger 변경**: D-038 ~ D-063 **신설 26건**, D-021 → SUPERSEDED(D-038), D-053 → SUPERSEDED(D-056). **삭제·완화 0건.** 전부 r2~r10 의 외부 리뷰·자체 진단에서 나온 **추가 제약**이며 기존 ACTIVE 결정을 약화시킨 것은 없다. D-021/D-053 의 SUPERSEDE 는 **사용자 결정 변경이 아니라 기술적 정정**이고(0125 null 의미론 위반 / 고정 키 덮어쓰기의 원자성 불가), 둘 다 원래 목적(respawn 판정·자격증명 보존)을 더 강하게 만족하는 방향이다 — 자기 코드에 맞춘 완화가 아니다.
- **Product/UX Contract 변경**: 없음. §5 흐름·§6 범위/비범위 무변경.
- **AC 변경**: AC19 **강화**(“settings 해석 실패 턴이 respawn 을 유발하지 않는다” 단언 추가), AC25 **신설**(r3). **AC1~AC18·AC20~AC24 는 글자까지 무변경.** 구현자가 자기 코드에 맞춰 AC 를 재작성한 흔적 없음.
- **채점에 사용할 원 기준**: `f76e9604` 의 AC1~AC24 원문 + r3 이 추가한 AC25. AC19 는 **원문 기준으로도 채점**했다(강화분은 별도 확인).

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-002 · D-006 · D-010 | 인증 코어가 소비자 분류·env 형상을 모른다 | `contracts/auth.ts`(소비 슬롯 0) → `features/auth/runtime.ts` `BoundAuth = {authId, snapshot, request}` 3멤버 → `secretReader` 는 `CreatedAuthRuntime` 반환값으로만 나가고 `bootstrap.ts` 안에 머문다 |
| D-008 | `credentialChanged` 에서만 Plugin sync · Harness 무효화 | `store.markExpired/settleExpiry` → `runtime.emitSnapshot` → `bootstrap.ts:367-376` **단일 소비 지점**의 `if (change.kind !== 'snapshot' \|\| !change.credentialChanged) return` |
| D-047 · D-050 · D-058 | 확인 전 커밋 없음 · 세대 fence 가 모든 `await` 뒤 | `login.settleGrant` → `probeOk(candidate)` → **세대 확인 먼저** → vault(새 키) → `store.put` → `discardKeys(previous)`. `resume`·`absorb`·`markExpired(authId, revisionAtSend)` 4지점 |
| D-056 · D-057 · D-060 · D-061 · D-063 | 포인터 교체 · 내구 저장 보고 · sweep 은 authoritative 일 때만 · 해제 fail-closed | `vault.versionedVaultKey` → `store.put():boolean` → `store.restore()` 의 `if (!loaded.authoritative) return` → `store.revoke()` 의 `if (!this.persist(next)) return {kind:'failed'}` → `login.revoke()` throw → `handlers/providers.ts:67` `'reject'` 모드 |
| D-017 · D-041 · D-042 | env 우선순위 `runtimeEnv > settings > app > process`, settings `env` 블록 통째 hoist | `prepared-config.ts:137-144` spread 순서(나중이 이김) + `withoutEnvBlock` |
| D-019 · D-038 | 턴당 1회 resolve, chat·title 이 같은 snapshot, fingerprint 는 env 축만 | `resolveTurnProvider` → `prepared` 1벌 → `send.ts:146-147`(title) · `:289-291`(chat) → `session-runtime.ts:355` 기록 → `runtimeEnvChangedSinceSpawn` |
| D-029 | 카탈로그 DTO 는 `app/connection-views.ts` 가 조립, renderer 새 kind 없음 | `createConnectionSources` → `connectionState(auth, gate, connections)` → `broadcastProviderState` → `orca:provider:state` |

### end-to-end 흐름 (실제 경로로 재구성)

```text
[부팅]  index.ts → Bootstrap.start()
  → createAuthRuntime(선언, persistence, vault, netFetch)  ← store.restore() + sweep(authoritative 일 때만)
  → createGate(selectGateMembers …)  ← probe 없는 gate 는 컴파일·조립 양쪽에서 배제
  → createPluginBindings(deps).sync()  ← resume 보다 먼저 1회
  → createConnectionSources(deps) → registerConnectionHandlers  ← renderer 의 첫 invoke 대상
  → auth.subscribe(…)  ← listener 를 resume 보다 먼저
  → createAuthResume(…).run()  ← gate 순차 → 나머지 병렬 1회 → push 1회
  → [DB 초기화] → HarnessSettingsService · HarnessRuntimeConfigService · UsageTracker

[해제]  renderer revoke → IPC('reject') → LoginService.revoke
  → store.revoke: persist 먼저 → 실패면 {failed} → throw → IPC reject (화면 상태 불변)
  → 성공이면 vault 정리(best-effort) → 메모리 → onSnapshot('revoked') → cookie clear(추적)

[턴]   chat:send → resolveTurnProvider → harnessRuntime.resolve 1회 → prepareHarnessConfig
  → decideRespawn(boundary·model·settings·runtimeEnv·toolsRevision) → spawn 또는 재사용
  → send.ts 가 chat 과 title 에 같은 prepared 의 settings·env 를 **둘 다** 전달
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | **정합** | 디스크 실패는 연산별로 갈린다 — 추가·교체 degrade-open(옛 세대 키 보존), 해제 fail-closed(throw). `persist()` 가 throw/`false` 를 boolean 하나로 정규화해 두 갈래 처리가 사라졌다 |
| false success 가능성 | **닫힘** | ① `revoke` 는 내구 저장 성립 전에는 아무것도 바꾸지 않는다 ② `save():boolean` 이 메모리 폴백을 "영속 성공" 으로 접지 않는다 ③ probe 는 `res.ok && isAllowedOrigin(res.finalUrl)` — 200 로그인 폼 오판 방지(0174 승계) |
| partial failure/rollback | **구조적으로 소멸** | rollback 자체를 제거하고 포인터 교체로 바꿨다. 실패 지점과 무관하게 "옛 grant→옛 키" 또는 "새 grant→새 키" 하나만 관측된다. 고아는 부팅 sweep |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | **아니오** | 화면·클릭·IPC 왕복·DB 불변이 요구였고, IPC 채널·DTO·migration diff 0 을 실측했다 |
| 증상만 제거하고 상태가 남았는가 | **아니오** | 강등 통지는 `markExpired` 가 돌려준 **실제 전이**를 따르고, 전이 없으면 방송 자체를 하지 않는다 |
| 최적화가 잃은 재검증/취소/만료 관측 | **없음** | 요청당 1회 credential 해석으로 줄이되 홉마다 `isCurrentGrant`/`isCurrentUnexpiredGrant` 로 메모리 재검사(0187 승계). 만료는 snapshot·request·resume 3지점에서 `expirySettled` 단일 기준으로 1회 전이 |
| 출력/요청 worst-case 상한 | **유한** | 부팅 probe = gate 순차 G + 나머지 병렬 1회(각 15s 타임아웃). runtime config 는 key·generation·sourceRevision 단위 single-flight + bounded retry 후 `StaleHarnessConfigError`. 정적 구성은 network 0 |
| **미검토로 남긴 표면** | — | 8,561줄 diff 전체를 줄 단위로 읽지는 않았다. auth·harnesses·chat-turn·deployment·bootstrap 의 production path 를 직접 읽고 나머지는 scan-surface + 게이트로 덮었다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh f76e9604..HEAD   # 82 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export(값·타입) | **0건** | 스크립트 실측 |
| 테스트 전용 참조 | **0건** | 스크립트 실측 |
| 형제 정책 비대칭 — `infra/net` 의 `credentials` | **오탐** | `transport.ts` 의 `credentials:'omit'` 은 "암묵적 쿠키 전송 금지" 정책 리터럴이고, `net-fetch.ts`/`net-request.ts` 의 `init.credentials`/`opts.credentials` 는 호출자 값 pass-through 다 — 층이 다르다. 이 범위에서 `infra/net` 변경은 2줄뿐 |
| 신규 등록값의 기존 소비처 — `AuthChange.credentialChanged` | **무영향** | production 소비처는 `bootstrap.ts:367` **하나**. 그 안에서 Plugin sync 와 Harness invalidate 가 함께 걸린다 — 규칙이 갈릴 자리가 없다 |
| 신규 등록값의 부작용 — `AuthStore.restore()` 의 vault sweep | **격리 확인** | `Vault` 는 `provider:` prefix + 자체 `#index` 를 갖는다(`infra/vault.ts`). `names()` 가 그 index 만 읽으므로 MCP·기타 secret 은 sweep 대상이 아니다. 기준 집합도 *선언* 이 아니라 **영속된 grant 전체**라 미선언 Auth 의 값이 지워지지 않는다 |
| producer ↔ consumer 파생 불일치 — fingerprint | **일치** | 조립부는 `harnessEnvFingerprint(env)`, spawn 기록부는 `harnessEnvFingerprint(req.env)` 로 **같은 SSOT**(`adapters/harness-config.ts`)를 쓴다. `send.ts` 가 env 를 새 객체로 복사하지만 fingerprint 는 canonical 내용 기반이라 영향 없음 |
| producer ↔ consumer — listen/flush 대칭 | **구조적 보장** | `continuation.ts:84-88` 의 `spawnInputs(prepared)` 한 헬퍼를 둘이 공유한다 — 리터럴 중복이 아니라 함수 1개 |
| 동일 규칙 중복 구현 | **없음** | respawn 판정은 `runtimeEnvChangedSinceSpawn` 하나를 두 호출부가 쓴다. 권위 판정은 `isAuthoritative` 하나 |
| `features/providers` 잔존 import | **0건** | `rg "from '[^']*features/providers" app/src/main` = 0. 남은 문자열은 ⓐ renderer 의 **별개 슬라이스** `renderer/src/features/providers/`(실재 확인) ⓑ 소스 주석의 `구 features/providers/…` 출처 표기 |

**테스트가 production 을 부르는가** — 이 핸드오프가 세 라운드 연속 놓쳤던 축이라 신설 테스트를 전수 확인했다.

- `store-parse.test.ts` → `parseGrantRecords`·`isAuthoritative` **직접 import**. r9 까지 `authoritative` 단언 11건이 전부 결과 주입이었다는 구현 보고가 사실임을 확인했다(이제 파서에 진입한다).
- `turn-context.test.ts` → `buildTurnContext`·`makeContinuationTurn` 직접 import.
- `runtime-boundary.test.ts` → `runtimeEnvChangedSinceSpawn` 직접 import.
- `deployment-wiring.test.ts` → `createAuthRuntime`·`createGate`·`RuntimeToolRegistry`·`createHarnessRuntimeConfigService` 등 **실제 production 조립**을 태우고, 별도 describe 가 `production*` alias 로 배포 factory 4종과 `mergeAugmenters` 를 직접 부른다. 가상 배포 fixture 는 로컬 함수지만 인자 타입이 실제 `*DeploymentDeps` 라 배포 능력 축소가 컴파일에서 깨진다.

**`send.ts:146` 은 테스트가 닿지 않는다**(electron 의존). 대신 `BuildTurnContextInput.titleSettings` 가 **required**(`?` 없음)라 누락이 typecheck 에서 깨진다 — 타입이 배선을 잠그는 형태임을 확인했다. D37 이 뚫렸던 구멍(죽은 optional)이 같은 방식으로 다시 열릴 수 없다.

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트(`api.test.ts` 325줄 등 8종)는 이동·개명 후 현존한다 — 파일명이 바뀐 것(`authenticated-request.test.ts`·`policy.test.ts`·`gate.test.ts`·`settings.test.ts` 등)까지 대조했다.
- `N회` 기준의 실제 관측 주체: 방송 횟수는 `auth-resume.test.ts` 의 `broadcast` 스파이 **총 호출 수**(`toHaveBeenCalledTimes(1)` / `(3)`), resolve 횟수는 augmenter 스파이 호출 수. grep 이 아니다.
- 순서 기준의 관측: `auth-resume.test.ts` 가 주입한 단계 로거로 gate→remaining 순서와 병렬성을 관측한다.
- **structural proxy 만으로 통과한 AC: 없음.** AC17 은 "resolve 1회" 수치와 별개로 **required 입력 타입**이 두 채널 동시 전달을 잠근다. AC20 은 revision 불변 + 동일 인스턴스 identity 를 함께 본다.

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 (이번 턴 실측) | production path |
|---|---|---|---|---|
| AC1 | `features/providers/` 부재 + import 0 | ✅ | `ls features/` 12슬라이스(providers 없음) · main import 0건 · lint boundaries 통과 | 빌드 |
| AC2 | `contracts/auth.ts` 에 소비 슬롯 없음 | ✅ | 파일 grep — `kind` 는 `AuthMethod`/`Grant`/`AuthChange` 의 판별자뿐이고 `Provider.kind` 형태의 소비 분류·`llm`·`tools`·`usage`·`envKey` 필드 0 | 빌드 |
| AC3 | gate 분리 + 교차 import 0 | ✅ | `npm run lint` 0 error(boundaries 포함) | 빌드 |
| AC4 | gate = `valid && verified`, probe 없는 gate fail-closed | ✅ | `gateOpen()` 이 `status==='valid' && snapshot.verified` 둘 다 요구(`auth-resume.ts:39-45`) · `gate.test.ts` 통과 · 타입은 `GateAuthDefinition` | 부팅 gate → `GateFrame` |
| AC5 | `BoundAuth` 에 raw credential 없음, `secretReader` 격리 | ✅ | `runtime.ts:194-198` 3멤버 · `secretReader` 는 `CreatedAuthRuntime` 반환 → `bootstrap.ts` 안 closure 로만 | MCP binding · direct-credential augmenter |
| AC6 | step/snapshot 분리 + revision 규칙 | ✅ | `isCredentialEffective(cause)` 단일 매핑 · `markExpired` 2축 반환 · vitest green | Auth listener |
| AC7 | 실패한 재인증이 기존 자격증명 보존 | ✅ | `settleGrant` 가 probe 실패 시 **아무것도 쓰지 않고** `rejected` 반환 — 보존이 아니라 애초에 건드리지 않는다(D-047) | [재인증] 버튼 |
| AC8 | 인증 요청 계약 보존 | ✅ | `authenticated-request.ts` 홉별 정책 재검사·`finalUrl`·binary·401 강등 유지 · 해당 스위트 green | 첨부 다운로드·probe |
| AC9 | ModelProvider 목록 = settings 열거 | ✅ | `HarnessModelProviderDefinition` 0건 · `settings.test.ts` green | 설정 화면 |
| AC10 | augmenter 가 전체 `runtimeEnv` overlay 반환 | ✅ | `runtime-config.test.ts` green · `harness-runtime.ts` 예제 형상이 typecheck 대상 | 폐쇄망 빌드 |
| AC11 | 정적 구성 network 0 | ✅ | `runtime-config.test.ts` green · `prepareHarnessConfig` 는 augmenter 없으면 `runtimeEnv={}` 로 조립만 | 매 턴 hot path |
| AC12 | settings mtime → cache miss | ✅ | `sourceRevision` 이 `ResolvedHarnessSettings` 에 있고 cache key 에 참여 · 스위트 green | 외부 편집 |
| AC13 | 무효화 중 in-flight 미commit + bounded retry | ✅ | 스위트 green(deferred fence·`StaleHarnessConfigError`) | 재인증 중 턴 |
| AC14 | single-flight 공유 + caller abort 격리 | ✅ | 스위트 green | 동시 턴 |
| AC15 | env 4층 우선순위 · 디스크 불변 | ✅ | `prepared-config.ts:137-144` spread 순서 = `base→app→settings→runtimeEnv`(나중이 이김) = 계약 그대로 · `withoutEnvBlock` 은 **사본**에서만 삭제 · 스위트 green | 턴 spawn |
| AC16 | secret 은 `options.env` 에만 | ✅ | 조립 결과의 settings 사본에서 `env` 블록 제거 · fingerprint 는 HMAC digest(평문 미보존) · 스위트 green | 턴 spawn |
| AC17 | title 과 chat 이 같은 prepared snapshot | ✅ | `send.ts:146-147` → `turn-context.ts:115` → `TurnContext.titleSettings` → `title-generation.ts:34 providerSettings` **전 구간 연결 확인**. `titleSettings` required 로 컴파일 강제 | 턴 + 자동 제목 |
| AC18 | listen·flush 가 settings·env 를 같은 값으로 | ✅ | `continuation.ts` 의 `spawnInputs(prepared)` 단일 헬퍼를 둘이 공유 | 자동 연속 턴 |
| AC19 | respawn 판정 5축, 축 겹침 없음 | ✅ | `runtime-entry.ts:74-92`·`chat-turn-continuation.ts:73-87` 두 호출부가 동일 5입력 · `runtimeEnvChangedSinceSpawn` 이 양쪽 `undefined` 를 no-op 으로(0125 승계) | 턴 · continuation |
| AC20 | valid 에서만 도구 등록, 반복 sync 무영향 | ✅ | `bootstrap.ts:372-374` 이 `credentialChanged` 뒤에서만 sync · `deployment/plugins.test.ts` green | 다음 spawn 도구 목록 |
| AC21 | invalid 에서도 카탈로그 도구 이름 유지 | ✅ | 스위트 green | 카탈로그 상세 |
| AC22 | `ProviderInfo` 전 필드·row 순서·authId 유일 | ✅ | `connection-views.test.ts` 가 production `connectionState` 직접 호출 · `duplicateConnectionAuthIds` 진단이 bootstrap 에 배선 | `orca:provider:*` |
| AC23 | 부팅 순서 + 방송 상한 | ✅(범위 명시) | `auth-resume.test.ts` 가 순서·병렬·`1+K`(K=0,2) 를 스파이로 단언. **단, 이 상한은 "나머지 batch" 축이다** — gate resume 은 설계상 `emitVerifiedChange:true` 라 gate 마다 낸다(로그인 화면이 진행을 보여야 한다). 기본 배포는 gate 선언이 0개라 테스트 케이스가 곧 운영 경로다 | 앱 시작 |
| AC24 | migration 0 · dependency 0 · 문서 일치 | ✅ | `check-migrations-appendonly.mjs` exit 0 · `git diff app/package.json` = **빈 diff** · `check-doc-inventory.mjs --check` exit 0 | 릴리스 빌드 |
| AC25 | 가상 배포 4종이 주입 인자만으로 조립 | ✅ | fixture 4종이 실제 `*DeploymentDeps` 로 타이핑 + production factory 를 직접 부르는 describe 별도 존재 · 스위트 green | 폐쇄망 빌드 |

> 코드 존재는 "구현됨" 이지 "검증됨" 이 아니다. `Criteria-Met: 25/25` 자기보고는 증거로 쓰지 않았다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `GrantPersistencePort.load/save` | 타입 `PersistenceLoad<T>` / `boolean` | **의미가 문서와 일치한다** — 주석의 "구현이 던져도 된다, AuthStore 가 `false` 로 정규화" 가 `persist()` 의 try/catch 로 실제 구현됨. r8 의 doc↔impl 분기(주석은 throw, 구현은 false)가 닫혔다 | ✅ |
| `RuntimeConfigAugmenter` (배포가 구현) | `harness-runtime.ts` 예제가 typecheck 대상 | 충돌 시 `mergeAugmenters` 가 **throw**(조용한 덮어쓰기 아님) — 테스트가 production 함수를 직접 부른다 | ✅ |
| `BrowserSessionPort.clear` | `{scope, origin}` | best-effort 이며 해제를 되돌리지 않음 + in-flight 추적으로 **다음 로그인 쿠키를 지우지 않는다**(`runSession` 이 소진) | ✅ |
| 폐쇄망 가이드 레시피 A/B/C | factory 시그니처 표가 현재 코드와 일치 | 가이드가 지목하는 정본 경로가 실재(`app/deployment/*`) — 삭제된 `contracts/provider.ts` 지목은 r5 에서 제거됨 | ✅ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **테스트 총계 재측정**: 202 파일 / 1,910 테스트. **1,866 pass · 44 fail**. 구현 보고의 r10 수치(197파일/1,866테스트 통과, 5파일/44 실패)와 **정확히 일치**한다.
- **0건 게이트 분해**: AC1 의 `features/providers` 0건은 *import* 기준이다. 문자열 잔재는 ⓐ renderer 동명 슬라이스(별개 실재 디렉터리) ⓑ 소스 주석의 출처 표기 — 둘 다 §7 주의사항이 제외한 범주이고, 정당한 이력을 지우지 않았다.
- **의존성 diff**: `app/package.json` 변경 0줄(실측). 신규 production dependency 0.
- **migration**: append-only 가드 exit 0, 신규 파일 0.
- **방송 상한**: 나머지 batch 는 성공 N 건을 push 1회로 접고 강등 K 건만 즉시 — `1 + K`. gate 축은 위 AC23 주석 참조.
- **fan-out 상한**: 부팅 probe 는 gate 순차 + 나머지 **1회** 병렬(재진입은 `remainingResume` promise 로 1회 보장 — `onGateChange` 가 여러 번 와도 batch 는 한 번).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| gate fail-closed·부팅 순서 | `selectGateMembers`·`createAuthResume` 순수 모듈로 분리돼 순서·방송 횟수까지 vitest | 실서버 SSO 로그인 화면의 시각 확인 | 폐쇄망 빌드 실행 |
| 자격증명 교체 원자성 | 포인터 교체·내구 저장 보고·크래시 시점별 관측을 `createAuthRuntime` production 경로로 단위 검증 | 실제 키체인 잠김/디스크 오류 재현 | OS 키체인 잠금 후 재인증 |
| Plugin 도구 등록/회수 | 가상 배포 fixture 로 registry add/remove·revision 불변 | 실 Confluence 인증 후 도구 노출 | 폐쇄망 빌드 |
| Harness turn spawn | env 조립·fingerprint·respawn 판정 전부 순수 단위 | 실제 subprocess 가 그 env 로 뜨는지 | 폐쇄망 빌드에서 턴 1회 |
| **DB 스위트 5파일** | — | **이 환경에서 실행 불가**(아래 §9) | egress 열린 CI(`ci.yml`, windows-latest) |

## 9. 게이트 재실행 (이번 턴 실측)

`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 를 명령 정본으로 따랐다 — `npm test` 는 **의도적으로 돌리지 않았다**(ABI 를 Node 로 뒤집어 이후 dev/build 를 깨뜨린다).

```text
$ cd app && npm run lint            → exit 0 · 0 error / 1 warning
$ npm run typecheck                  → exit 0 (node·web·test 3/3)
$ ./node_modules/.bin/vitest run     → exit 1 · 197 passed / 5 failed 파일, 1,866 passed / 44 failed 테스트
$ node scripts/check-doc-inventory.mjs --check   → exit 0
$ node scripts/check-migrations-appendonly.mjs   → exit 0
$ node --test "scripts/*.test.mjs"   → 49/49 pass
$ git diff --check f76e9604..HEAD    → clean
```

- **lint 의 1 warning 은 베이스라인**이다 — `useTranscriptVirtualizer.ts` 의 `react-hooks/incompatible-library`(TanStack Virtual). 이번 변경과 무관하고 0102 부터 있던 것이다.
- **44 실패의 환경 기인 분리 근거**: 실패 파일은 `infra/db/queries` · `infra/db/migrate` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity` **5개**로, `app/AGENTS.md` 가 문서화한 DB-로드 스위트 집합과 **정확히 같다**. 실패 원인은 전부 동일 서명 `NODE_MODULE_VERSION 140 (Electron) vs 127 (Node)` 의 네이티브 바인딩 로드 실패이며(로그에 18회), **단언 실패는 0건**이다 — TypeScript 변경이 만들 수 있는 실패가 아니다. 변경 범위 안에 있는 `chat-turn.continuity` 도 `new Database()` 의 bindings 로드에서 죽는다(테스트 본문 진입 전).
- **`npm test` 를 안 돌린 대가**: DB 동작 자체(마이그레이션·쿼리)는 이 환경에서 검증되지 않았다. 다만 이번 변경은 **migration 0 · DB 스키마 접근 0** 이라 그 표면을 건드리지 않는다. 최종 확인은 CI 몫이다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·출력 실측 | — | ✅ 위 §9 |
| AC ↔ 코드/production path | 25건 1:1 대조 | — | ✅ 위 §5 |
| 레이어/계약/문서 형식·링크 | boundaries·doc-inventory·링크 검사 | — | ✅ |
| AGENTS 위생/부모-자식 모순 | 스캔·대조 | — | ✅ 위 §11 |
| 제품 의도 / Open Question | 보조 의견 | **결정** | 아래 D39(해제 실패 UX) |
| UI/UX 시각 품질 | 로직 기계 검증 | **시각 확인** | 폐쇄망 실기 대기 |
| 신규 의존성 / PR merge | 상태 확인(추가 0) | **승인** | PR #336/#338 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

이 범위에서 바뀐 AGENTS 는 4개다 — `app/AGENTS.md`(8줄) · `app/src/main/AGENTS.md`(20줄) · `docs/guides/AGENTS.md`(4줄) · `docs/handoff/AGENTS.md`(+11줄).

- **민감 패턴**: 키/토큰/PW/이메일/IP **0건**. 새로 든 예시는 전부 구조 이름(`features/{auth,gate,harnesses,plugins}`)이다.
- **일회성·변동성 정보 혼입**: 없음. `docs/handoff/AGENTS.md` 의 신설 절이 0188 을 사례로 인용하지만 이는 **규칙의 근거**(왜 이 규칙이 필요한가)이지 진행 상태가 아니다 — 라이브 상태는 INDEX 가 계속 소유한다.
- **부모↔자식 규칙 충돌**: 없음. 신설 "외부 리뷰는 verify 를 대체하지 않는다" 는 root `AGENTS.md` 의 흐름(plan→impl→verify)을 좁히기만 하고 뒤집지 않는다.
- **새 `AGENTS.md`**: 만들지 않았다 → `CLAUDE.md` stub·루트 표 갱신 **해당 없음**.

### INDEX 보드 정합성

- 검증 착수 시점: `impl` / `IMPL_DONE (r10)` / 다음 주체 `Claude(검증)` / 대상 커밋 `… c01d017(r10)` / 라운드 10 — **실제 상태와 일치**했다(`verify.md` 부재, `Verified-By: pending`).
- PASS 처리: 이 커밋에서 `verify/PASS` 로 갱신하고 완료 행을 `../archive/handoffs/INDEX-history.md` 로 이동한다.

### Commit / reference 정합성

- trailer 12커밋 전수 `git interpret-trailers --parse`: `Agent: claude`(허용값) · `Handoff:` 경로 · `Status: implemented` · `Criteria-Met`/`Criteria-Pending` 은 **구현 커밋에만** · `Verified-By: pending` · `Next-Action` 없음(검증 커밋 전용이므로 정상). **trailer 블록 내 빈 줄 0** — `Co-Authored-By`·`Claude-Session` 이 같은 블록에 붙어 파싱에서 누락되지 않는다. **허용되지 않은 값 0건.**
- 이동/삭제 reference: `docs/arch/backend/providers.md` → `auth.md` 로 대체됐고 `INDEX.md`·`ARCHITECTURE.md`·`src/main/AGENTS.md`·ADR-004 의 링크가 새 경로를 가리킨다(doc-inventory 링크 검사 통과). 고아 reference 0.

### 작업 트리 위생 (이번 턴 관측)

- 추적되지 않은 `package-lock.json` 이 **저장소 루트**에 있다(94바이트 스텁, `{"name":"orca-skin","packages":{}}`). 루트에는 `package.json` 이 없으므로 r10 세션이 의존성 복구를 위해 루트에서 `npm install` 을 돌린 흔적이다. **커밋되지 않았고 게이트에도 영향이 없다**(`app/package.json` diff 0). 다만 `.gitignore` 되지 않아 다음 `git add -A` 에 딸려 들어갈 수 있다 → 아래 D40.
- `conf/`·`docs/etc/confluence-data-center-plugin-implementation-plan.md` 도 미추적이나 **0188 과 무관한 별개 작업물**이라 이번 검증 대상이 아니다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 놓친 문제 5건(Phase A lint·AC4/23 순수화·fingerprint 승격·재인증 파괴·만료 미정착) 선조치 | **타당** — 전부 구현 세부·명백한 누락이고 제품 의도·AC 를 바꾸지 않았다. 셋(순수 모듈 분리)은 오히려 사람 실기를 기계 검증으로 내렸다 | 수용 |
| Phase A 범위 확대(심볼 renaming 흡수) | **타당** — 기계적 변환을 계약 diff 와 분리한 것이고 D-034 를 더 강하게 만족한다 | 수용 |
| `options.settings.env` vs `options.env` 실측 대신 fail-safe 분기 | **타당** — plan §11 이 그 선택지를 미리 승인했고(D-017 결정표 2행), D-042 로 "충돌 키만" 이 아니라 **블록 통째** hoist 라 SDK 우선순위와 무관하게 결과가 하나다. 실측 회피가 아니라 실측 불필요로 만든 것 | 수용 |
| r10 의 `settings-write` 사용자 문구 변경(제안서 §비범위 "문구 변경") | **경계 위 항목** — 구현자도 "유지도 계약 위반이 아니나 위험 0 이라 수용" 이라고 명시했다. 변경된 것은 **오류 진단 메시지 2건**의 어휘(`engine`→Harness)뿐이고 `engine:` 필드·`orca:engine:*` 채널은 그대로다(D-005 유지, 실측). 카탈로그 정보구조·라벨은 불변 | 수용(기록) |
| D5 — plan-only 커밋의 `Status: implemented` 오기 | **fix-forward 타당** — 푸시된 이력이다. 이후 docs 커밋의 `Status: implemented` 는 그 시점 상태가 실제로 impl 이므로 같은 오기가 아니다 | 기록 |

## 13. 파생 이슈 (PASS 이지만 남긴 것)

FAIL 사유는 아니다 — 아래 둘은 `plan.md` 의 `[검증자 기입] 파생 이슈` 로 이관한다.

- [ ] **D39 — 해제 영속 실패가 사용자에게 보이지 않는다(제품 결정 필요).** D-061 이 `LoginService.revoke()` 에 **사용자용 한국어 메시지**(`연결 해제를 저장하지 못했습니다…`)를 담아 던지고 IPC 는 `'reject'` 로 거절한다. 그런데 renderer 소비처는 `onRevoke={() => void providers.revoke(...)}` 라 rejection 을 **버린다** — 사용자는 버튼을 눌러도 아무 일이 없고 그 문구를 보지 못한다(unhandled rejection). **핵심 계약은 지켜진다**(상태가 바뀌지 않아 행이 '연결됨' 으로 남으므로 false success 는 없다). 또 이 fire-and-forget 형태는 login/submit/reauth 도 같은 **0188 이전부터의 패턴**이라 이번 회귀가 아니다. 다만 *메시지를 만든 producer 와 그것을 버리는 consumer* 의 불일치는 남았다. 오류 표면을 추가할지는 §6 비범위("UI 문구 변경")에 걸리므로 **사용자 결정**이다.
- [ ] **D40 — 저장소 루트의 미추적 `package-lock.json` 스텁.** 루트에 `package.json` 이 없는데 lockfile 스텁이 생겼다(r10 의 루트 `npm install` 부산물). 커밋·게이트 영향 0 이지만 `.gitignore` 대상이 아니라 실수로 커밋될 수 있다 → 삭제 또는 `.gitignore` 추가. 트리비얼이라 `Handoff: none` 카브아웃 범위다.

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상**: 이번 검증에서 새로 발견한 코드 결함은 없다. r5(D16)·r7(D24)·r8(D28)·r10(D33)이 연속으로 잡았던 "테스트가 주장하는 production 경로에 진입하지 않는다" 는 이번 전수 확인에서 **재발이 관측되지 않았다** — 신설 테스트 4종이 모두 production 심볼을 직접 부른다.
- **관련 plan 지침/AC 존재 여부**: D39 를 덮는 AC 는 없다(해제 실패 UX 는 r9 에서 생긴 새 실패 경로이고 Part I §5 상태표에 행이 없다). D40 은 AC 범위 밖이다.
- **사용자 결정 변경 근거**: 없음. SUPERSEDED 2건(D-021·D-053)은 사용자 변심이 아니라 기술적 정정이며 원 목적을 강화한다.
- **반복된 검증 환경 한계**: `better-sqlite3` ABI 로 DB 스위트 5파일이 이 환경에서 계속 미검증이다(0019·0102·0180·r10 과 동일). 이번에도 CI/사람 몫으로 남긴다.
- **구조적 사실**: 이 핸드오프는 impl 라운드 10 회 중 verify 턴이 **이번이 처음**이다. r5 가 그 사실을 진단해 `docs/handoff/AGENTS.md` 에 "외부 리뷰는 verify 를 대체하지 않는다" 를 신설했고, **이 verify 가 그 신설 규칙의 첫 적용 사례**다.

## 15. 결론

- **상태: PASS**
- **Product/UX 및 ACTIVE Decision 충족**: 화면·클릭·IPC 왕복·DB 불변이라는 상위 계약이 지켜졌다(IPC/DTO/migration diff 0, renderer 새 kind 0). ACTIVE Decision 61건 중 검증 대상 핵심 축(D-002·D-006·D-008·D-010·D-017·D-019·D-029·D-038·D-041~D-063)을 production path 로 대조해 일관성을 확인했다. SUPERSEDED 2건은 근거가 정당하다.
- **AC 충족**: 25/25. AC23 은 `1 + K` 상한이 "나머지 batch" 축임을 명시한 조건부 충족이며, 기본 배포(gate 선언 0)에서는 테스트 케이스가 곧 운영 경로다.
- **기준 밖 결함**: 중대 결함 0. 역방향 탐색에서 미배선·죽은 코드·테스트 전용 심볼·SSOT drift **0건**. 관측한 두 항목(D39·D40)은 각각 제품 결정 사항과 작업 트리 위생이다.
- **repository operation checks**: AGENTS 위생 ✅ · INDEX 정합 ✅ · trailer 12커밋 전수 허용값 ✅ · reference 고아 0 ✅.
- **남은 사람 확인**: 폐쇄망 실배포의 gate 로그인·Plugin 인증·실제 Harness turn·Usage refresh(기본 빌드는 선언이 비어 이 경로가 돌지 않는다) · DB 스위트 5파일의 CI 실행 · PR #336/#338 머지 승인 · D39 의 제품 결정.
- **다음 단계**: INDEX 를 `verify/PASS` 로 올리고 완료 행을 archive history 로 이동한다. D39·D40 은 후속 처리(D40 은 카브아웃, D39 는 사용자 결정 후 필요하면 신규 핸드오프).
