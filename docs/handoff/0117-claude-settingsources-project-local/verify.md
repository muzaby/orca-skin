# Verify — 0117-claude-settingsources-project-local

> `_templates/verify.template.md` 복사본. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0117-claude-settingsources-project-local` |
| 검증자 | Claude Code |
| 일자 | 2026-07-16 |
| 대상 커밋 | `34804a6` |
| 라운드 | 1 |
| 상태 | **PASS** (구현 범위 — AC#5·#8 은 사람 실기 대기, §검증 책임 분리) |

> 주의: 본 건은 사용자 지시로 **Claude 가 설계·구현·검증을 모두 수행**했다(구현 커밋 `Agent: claude`).
> 자기 검증의 한계를 감안해 매트릭스는 코드/테스트 증거 대조로만 판정하고, 가치판단 항목은 전부 사람 몫으로 남긴다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견(정제): `skillsTarget` homedir 기본값 대신 `deploy()` 가 skillRoots(`adapter:<engine>`)에서 파생·명시 전달 | **타당** — deployer 자신의 homedir 비의존 원칙(deployer.ts 상단 주석) 유지 + homedir 리터럴은 bootstrap 단독 소유 유지. 프로덕션 결과 동일(bootstrap 이 항상 adapter:claude 루트 전달, `bootstrap.ts:122-127`) | 매트릭스 AC#2 증거로 채택 |
| 선조치 ✅ #2: 링크 실패 시 매니페스트 잔존 → adaptPlugins 가드 오통과 방지(디렉토리째 rm) | 타당 — plan 설계 명시 사항의 코드화. catch 절 확인(`claude-user-skills-plugin.ts:63-66`) | AC#3 증거 |
| 선조치 ✅ #3: 백업 실패 폴백 경로의 잔존물(링크/실디렉토리) 방어 — rm 후 재생성 멱등 | 타당 — 테스트 2건으로 고정(`claude-user-skills-plugin.test.ts:65`·`:81`) | AC#2·#3 증거 |
| ⚠️(결정 필요) 항목 | **없음** | — |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 양쪽 query 옵션에 `settingSources: ['project','local']`(`user` 부재) | ✅ | `adaptSettingSources` 정의 `claude-adapt.ts:91-93`(user 미포함) · runCompletion spread `claude.ts:246` · sendMessage spread `claude.ts:360` · 단위 테스트 `claude-adapt.test.ts` "adaptSettingSources (0117)" |
| 2 | deploy 가 `dist/claude/plugins/claude/`(매니페스트 name=`claude` + `skills` 정션/심링크 → 어댑터 스킬 루트)를 렌더 — 부팅·CRUD 재배포 모두 | ✅ | 렌더러 `claude-user-skills-plugin.ts:38-67`(`symlink(…, 'junction')`=`:61`) · deploy 편입 `deployer.ts:124-127`(skillRoots 파생)·`:195-196` · 부팅/CRUD 는 동일 `deploy()` 경유(`extension-deployment-service.ts` ensureDeployed/deployNow → `bootstrap.ts:138-150`) · 테스트 `deployer.test.ts:155-195`(매니페스트 name·`readlink`=어댑터 루트·actions 문구), 재배포 멱등 `deployer.test.ts` "재배포의 backup→rm 롤링" |
| 3 | 대상 부재 시 미생성·무오류, 링크 실패 시 경고 후 계속(크래시 금지) | ✅ | 부재/비디렉토리 → null `claude-user-skills-plugin.ts:41-45` · 실패 catch → warn + 디렉토리 정리 + null `:63-67` · 테스트 부재/파일 케이스 `claude-user-skills-plugin.test.ts:34-44`, deploy 스킵 `deployer.test.ts:197-202` |
| 4 | sendMessage `options.plugins` 에 orca + claude 래퍼 둘 다(각 매니페스트 존재 시, 전부 탈락 시 키 생략) | ✅ | `adaptPlugins` 복수 root+개별 가드 `claude-adapt.ts:37-43` · bootstrap 주입 `bootstrap.ts:213` · builder 전달 `builder.ts:61-66` · spread `claude.ts:353` · 테스트 복수 root/전부 탈락 `claude-adapt.test.ts` "복수 root(orca + user 래퍼, 0117)" |
| 5 | provider settings 가 `~/.claude/settings.json` 개입 없이 적용 | ⏳ 사람 실기 | 코드 근거는 #1(user 소스 배제) + `adaptSettings` 불변(`claude-adapt.test.ts` 'settingSources' in out === false 단언 유지). 실환경 확인은 사람 몫 |
| 6 | `adaptSkillNameForClaude` 가 adapter 스킬에 `claude:` 네임스페이스 부여 → 래퍼 발견 이름과 필터 일치 | ✅ | `claude-plugin.ts:23-27`(플러그인 이름 SSOT `CLAUDE_USER_PLUGIN_NAME='claude'`=`:11`, 매니페스트도 동일 상수 사용 `claude-user-skills-plugin.ts:26`) · 테스트 `claude-plugin.test.ts:21-36`(orca/adapter/workspace/중복 prefix) · `claude-adapt.test.ts` adaptSkills 기대값 `['orca:a','claude:native']` |
| 7 | backup(`rename`)·`rm` 롤링이 링크 대상 원본을 삭제·변형하지 않음(테스트 고정) | ✅ | 단위 `claude-user-skills-plugin.test.ts:90-102`(rename→rm 후 원본 SKILL.md 생존) · 통합 `deployer.test.ts` 3회 연속 deploy(rename→rm .bak 링크 포함) 후 원본 생존+링크 재생성 |
| 8 | `~/.claude/skills` 스킬이 세션에서 `claude:*` 로 노출 | ⏳ 사람 실기 | wire log(0025) 토글 후 init 의 plugins/skills/plugin_errors 확인. 정션 경유 로딩은 SDK 보장 아님 — 미인식 시 복사 폴백(가이드 §6) 후속 전환 |
| 9 | 오래된 주석·테스트 문자열이 새 설계와 정합 | ✅ | `claude.ts:242-245`·`:355-359` · `claude-adapt.ts:63-66`(adaptSettings 상단)·`:50-54`(adaptSkills) · `conformance.ts:31-32`·`:62-65` · `deployer.test.ts:155`(구 "settingSources:user 직접 탐색" 문자열 교체) · `turn.ts:72-75` · `types.ts:42-43` · `paths.ts` 다이어그램+`:135-139` · 잔존 모순 grep 0(`settingSources 는 생략` 패턴 소스 내 부재) |
| 10 | 신규 함수 단위 테스트 동반 | ✅ | 신규 `claude-user-skills-plugin.test.ts`(6 케이스) · `claude-plugin.test.ts`(4) · `claude-adapt.test.ts` adaptSettingSources/adaptPlugins 복수 root · `deployer.test.ts` +3 케이스 |

**판정: 기계 검증 가능 8/8 충족 + 사람 실기 2건(#5·#8) 대기.** plan 의 Criteria-Met 8/10 표기와 일치.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 에러 0 · typecheck 3분할 ✅ · vitest 915/915 · scripts 25/25 (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 + 실기 2 대기 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | `npm run lint`(boundaries 포함) 에러 0 — 신규 모듈 배치: 렌더=features/extensions·이름 SSOT=adapters·경로=infra·배선=app (DAG 하향 유지) |
| 문서 형식/링크/한국어 | ✅ | — | plan r2·verify 한국어 표 형식, 가이드 원문 링크 유효 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음. 변경 파일 내 키/토큰/이메일 패턴 grep 0 |
| **AC#5 provider settings 실환경 적용** | ✖ | ✅ | **사람 실기 대기(1순위)** — 상충하는 `~/.claude/settings.json` 을 두고 provider 설정 적용 확인(가이드 §8-1) |
| **AC#8 스킬 `claude:*` 노출 (wire log)** | ✖ | ✅ | **사람 실기 대기** — init 의 plugins·skills·plugin_errors(가이드 §8-2·3). 미인식 시 복사 폴백 후속 |
| 배포 빌드(asar) 1회 검증 | ✖ | ✅ | 사람 실기 대기(가이드 §8-5) |
| Windows 정션 실기(일반 권한 생성·rm 안전성) | △ CI | ✅ | POSIX 심링크로 단위 검증 완료. Windows 동등성은 CI(windows-latest)+실기 — 다음 PR CI 에서 확인 |
| 신규 의존성 승인 | ✖ | ✅ | **신규 의존성 0** (node:fs + 기존 SDK 옵션만) — 승인 불요 |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 시 |

## 게이트 재실행 결과

```
$ npm run lint        → 에러 0 (경고 1 — useTranscriptVirtualizer react-hooks 라이브러리 경고, 기존·무관)
$ npm run typecheck   → node/web/test 3분할 전부 통과
$ vitest run          → Test Files 119 passed / 1 failed(suite load), Tests 915/915 passed
$ node --test scripts → 25/25 pass
```

- 실패 스위트 1건(`app/chat-turn.continuity.test.ts`)은 **electron 바이너리 egress 403** 으로 인한 로드 불가 — `Error: Electron failed to install correctly`. DB/electron 환경 제약 클래스(`app/AGENTS.md` 게이트 가이드, 0019·0102 선례)로 본 변경 무관(해당 파일 미변경). 최종 판정은 CI(windows-latest)/사람 몫.
- 제약 환경 절차: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall electron ABI 실패 무시) → `npm rebuild better-sqlite3`(Node ABI 소스 컴파일 성공) → DB 스위트 포함 915 green.

## 위생 검토

- AGENTS.md 변경 없음. 커밋 diff 내 키/토큰/이메일/IP 패턴 스캔: 검출 0.
- 핸드오프 디렉토리의 `skills-loading-guide.md` 는 사용자 제공 원문 보존(편집 금지 표기) — 비밀 없음 확인.

## PHASES.md 정합성

- 본 verify 커밋에서 0117 행을 페이즈 표 말미(0110 다음)에 승격 — handoff slug·대상 커밋 `34804a6` 기재.
- 미승격 선행 건(0111~0116)은 각자 verify 대기 상태로 본 건과 무관(INDEX 참조).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: r1 이 `~/.claude` 직주입(매니페스트 없음) 전제를 "사용자 검증 완료"로 수용했으나 SDK 매니페스트 필수 규약(가이드 §2)과 상충했다 — 사용자 후속 지시(r2)로 교정. 외부 규약은 사용자 확인과 별개로 1차 출처 대조가 필요했다.
- 구현 단계: 정션 경유 SDK 스킬 인식은 코드로 증명 불가(SDK 비보장) — wire log 실기에 위임. init 검증 로직의 앱 내장(가이드 §4.3 원안)은 범위에서 제외했으므로, 실기에서 문제 발견 시 내장 검증+복사 폴백을 묶은 후속 핸드오프가 자연스러운 다음 단계다.
- 검증 단계: 설계·구현·검증 전부 동일 에이전트(사용자 지시) — 교차 검증 부재가 구조적 한계. Windows 정션 실동작(생성 권한·rm 비추적)은 POSIX 대리 검증 + CI 대기로만 커버했다.

## 결론 / 다음 단계

- 상태: **PASS** (구현 범위) → PHASES 승격, INDEX `verify/PASS`.
- 사람 확인 대기: ① AC#5 provider settings 실환경(상충 `~/.claude/settings.json` 테스트) ② AC#8 wire log 로 `claude:*` 스킬 노출·plugin_errors ③ 배포 빌드(asar) 1회 ④ Windows 정션 실기. 문제 발견 시 복사 동기화 폴백(가이드 §6) 후속 핸드오프로 전환.
