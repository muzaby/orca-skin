# 커밋 trailer 가이드

Claude Code(설계·검증)와 Codex(구현)는 **분리된 환경에서 git 커밋을 메시지 버스로** 통신한다. 이 문서가 커밋 메시지 형식의 상세 정본이고, 규칙 요약은 [`../AGENTS.md`](../AGENTS.md) "커밋 프로토콜" 에 있다.

> **강제 장치 없음 (관례).** `.gitmessage` 템플릿도 CI/훅도 두지 않는다. 두 에이전트가 이 형식을 *읽고 따른다* 에 의존한다. 에이전트는 보통 `git commit -m`/`-F` 로 커밋하므로, **trailer 블록을 커밋 메시지에 직접 포함**한다.

## 커밋은 2층 2독자다

우선순위 랭킹이 아니다. 한 커밋이 **두 층**으로 나뉘고 각 층의 독자가 다르다. *깊이* 는 커밋이 아니라 핸드오프 문서(`plan.md`/`verify.md`)가 진다 — 그래서 커밋을 이렇게 쪼갤 수 있다.

| 층 | 독자 | 역할 | 규칙 |
|---|---|---|---|
| **제목 줄** | 둘 다 | 한눈 식별 + `git log` 검색 | `<type>(<scope>): 구체 요약` 유지 |
| **산문 본문** | **사람** | *왜* 를 맥락으로 전달 | **짧은 문장 + 맥락.** 2~3줄. |
| **trailer 꼬리 + `Handoff:`** | **AI(기계)** | 메시지 버스 + 깊이 포인터 | `Key: value` 파싱 가능. **비타협 유지.** |

- **무엇이 바뀌었나** 는 diff 가, **깊이·증거** 는 `Handoff:` 가 가리키는 `plan.md`/`verify.md` 가 준다. 본문에 중복하지 않는다.
- `Handoff:` 포인터와 라우팅 trailer 는 **에이전트 생명선** — 떼면 핸드오프 라우팅이 끊기고(메시지 버스 절단) 미래 blame/고고학이 문서 링크를 잃는다. 본문이 사람향이어도 이 두 층이 살아있으면 AI 는 잃지 않는다.

## 형식

```
<type>(<scope>): <요약>

<맥락 2~3줄 — 왜를 사람이 한눈에. 짧은 문장으로 끊어 쓴다.
 무엇은 diff 가, 깊이는 plan.md 가 말한다.>

Agent: <codex|claude>
Handoff: docs/handoff/<NNNN-slug>/
<...해당하는 나머지 trailer...>
```

- 제목 `type` = `feat | fix | refactor | docs | test | chore`, `scope` = 모듈/기능명(예: `handoff`, `chat`, `db`).
- **본문 = 사람용.** 짧은 문장 + 맥락으로 *왜* 를 전한다. 한 줄에 절·수식을 욱여넣지 말고 끊어 읽히게. 2~3줄 권장 — `Handoff:` 포인터가 깊이를 지므로 길게 쓸 필요가 없다. 핸드오프 없는 독립 커밋(포인터 부재)만 자기완결성을 위해 몇 줄 더 허용한다.
- **trailer 는 본문과 빈 줄 1개로 분리된 *마지막 연속 문단* 이다.** `Key: value`(콜론+공백) 를 엄수해야 `git interpret-trailers` 가 파싱한다. **안 쓰는 키는 줄 자체를 생략한다**(빈 값 금지).

### 함정 — 블록이 끊기거나 개행이 없으면 통째로 사라진다

**커밋한 뒤 `git log -1 --format='%(trailers:only=true)'` 로 파싱을 확인한다.** 아래 두 함정은
증상이 같고(파싱 0~일부 건) 원인만 다르며, 커밋 메시지는 나중에 고칠 수 없는 사본이다.

**함정 1 — 블록 내부 빈 줄.** `git interpret-trailers` 는 **마지막 연속 문단만** trailer 로 인식한다. 블록 중간에 빈 줄이 들어가면 그 위의 키들이 **다른 문단으로 끊겨 누락된다.** 하니스가 붙이는 `Co-Authored-By`·`Claude-Session` 도 **같은 블록**에 둬야 한다 — 빈 줄로 떼면 앞의 `Agent`/`Handoff` 가 파싱에서 사라진다.

```
# ✗ 나쁨 — 빈 줄이 Agent/Handoff 를 끊는다
Agent: claude
Handoff: docs/handoff/0019-test-abi-green/

Co-Authored-By: ...        ← interpret-trailers 는 이 블록만 본다
Claude-Session: https://claude.ai/code/session_...

# ✓ 좋음 — 한 연속 블록
Agent: claude
Handoff: docs/handoff/0019-test-abi-green/
Co-Authored-By: ...
Claude-Session: https://claude.ai/code/session_...
```

**함정 2 — 개행이 리터럴 `\n` 으로 들어간다.** 셸이 escape 를 해석하지 않는 경로(`git commit -m` 에
`\n` 을 그대로 넣는 등)로 커밋하면 본문과 trailer 가 **한 줄**이 되어 마지막 연속 문단이 `Key: value`
꼴을 잃는다 — 값은 전부 맞는데 파싱은 **0건**이다(0198 r7). 실제 개행을 담은 파일을 `-F <파일>` 로
넘기면 이 함정이 없다.

## 필드 표

| Key | 의미 | 허용값 | 작성 주체 |
|---|---|---|---|
| `Agent` | 커밋 작성 에이전트 | `codex` \| `claude` | 둘 다 |
| `Handoff` | 연관 hand-off 작업 디렉토리 (AI 의 깊이 drill-down 포인터) | `docs/handoff/<NNNN-slug>/` \| `none` | 둘 다 |
| `Status` | 작업 상태 | `designed` \| `implemented` \| `partial` \| `blocked` \| `verified` | 둘 다 |
| `Criteria-Met` | 충족 인수 기준 수 | `<충족>/<전체>` (예 `3/5`) | **구현 커밋만** (구현 에이전트) |
| `Criteria-Pending` | 미충족 기준 목록 | 자유 텍스트(기준 번호·요약) | **구현 커밋만** (구현 에이전트) |
| `Verified-By` | 검증 결과 | `pending` \| `claude:pass` \| `claude:fail` | 구현=`pending`, 검증=결과 |
| `Next-Action` | 다음 차례 주체 | `codex` \| `claude` \| `none` | **검증 커밋만** |
| `Refs` | 연관 이슈 | `#<이슈번호>` | 둘 다(선택) |

> `<NNNN-slug>`, `#<이슈번호>` 등 프로젝트 고유값은 실제 값으로 채운다. 모르면 임의로 채우지 말고 비워둘 키는 줄을 생략한다.
> `Handoff:` 는 가장 값진 필드다 — AI 가 이 한 줄로 무한 깊이의 `plan.md`/`verify.md` 에 닿는다. 항상 정확히 채우고, `none` 은 진짜 일회성 커밋에만 쓴다.

## 에이전트별 작성 규칙

- **설계 커밋 (Claude)**: `Agent: claude` · `Status: designed`. `Criteria-*`·`Next-Action` 은 넣지 않는다. `plan/DRAFT`·`plan/READY` 와 **verify/FAIL 후 규범 행 정정**(Decision·AC·`§10 강제 지점`)이 이 갈래다. **구현 산출과 같은 커밋에 담지 않는다** — 섞이면 `handoff-verify §0` 의 기준선 잠금이 "구현 전 plan" 을 diff 로 꺼내지 못해, 구현자가 자기 산출에 맞춰 기준을 고쳤는지 아무도 확인할 수 없다 (정본 [`../.agents/skills/handoff-plan/SKILL.md`](../.agents/skills/handoff-plan/SKILL.md) 마무리).
- **구현 커밋**: `Agent: <구현 에이전트>` · `Status: implemented|partial|blocked` · `Criteria-Met` · (미충족 있으면) `Criteria-Pending` · `Verified-By: pending`. `Next-Action` 은 넣지 않는다. 구현 에이전트는 보통 Codex(기능 구현)지만, **리팩토링·버그수정은 Claude 가 구현**하므로 그 경우 `Agent: claude` 로 동일 형식을 쓴다 (역할 분담 정본은 [`handoff/AGENTS.md`](handoff/AGENTS.md)).
- **검증 커밋 (Claude)**: `Agent: claude` · `Status: verified` · `Verified-By: claude:pass|claude:fail` · `Next-Action: codex|claude|none`. `Criteria-*` 는 넣지 않는다.
- **공통**: `Handoff`, `Refs`(선택).

이 분리로 파싱 측이 "설계·구현·검증 중 어느 커밋인지" 와 "다음에 누가 움직여야 하는지" 를 키 존재 여부 + 값으로 판별한다 — `Status` 값이 갈래를 주고, `Criteria-*`(구현만)·`Next-Action`(검증만) 의 존재가 그것을 다시 확인한다.

## 예시

> 본문은 *왜* 를(짧은 문장 + 맥락), diff 는 *무엇* 을, `Handoff:`→`plan.md` 는 *깊이* 를 준다.

### 설계 커밋 (Claude, plan)

```
docs(handoff): 0019-test-abi-green 설계

vitest 는 Node ABI 로, Electron 빌드는 다른 ABI 로 돈다.
둘이 같은 better-sqlite3 바이너리를 두고 충돌해 db 테스트가 상시 red 였다.
각 진입점이 자기 ABI 를 멱등 보장하는 방향으로 설계.

Agent: claude
Handoff: docs/handoff/0019-test-abi-green/
```

### 구현 커밋 (Codex, 또는 비기능이면 Claude)

```
feat(chat): 스트리밍 reasoning 파트 영속화

확장사고 델타를 메시지 파트로 저장한다.
세션 재진입 시 사고 과정이 복원된다.
멀티세션 동시 스트림 경합은 미해결로 남겼다.

Agent: codex
Handoff: docs/handoff/0007-reasoning-persistence/
Status: partial
Criteria-Met: 4/5
Criteria-Pending: #5 멀티세션 동시 스트림 경합 테스트
Verified-By: pending
```

### 검증 커밋 (Claude, verify)

```
docs(handoff): 0007-reasoning-persistence 검증 (FAIL r1)

인수 4/5 충족. 기준 #5(동시 스트림 경합)가 미충족이라 재구현이 필요하다.
게이트는 통과했다.

Agent: claude
Handoff: docs/handoff/0007-reasoning-persistence/
Status: verified
Verified-By: claude:fail
Next-Action: codex
```

## 파싱 명령

```sh
# 최근 커밋의 trailer 를 키/값으로 추출
git log -1 --format=%B | git interpret-trailers --parse

# 커밋별 상태·검증 결과 한눈에
git log --format='%H %(trailers:key=Status,valueonly) %(trailers:key=Verified-By,valueonly)'

# 아직 검증 안 된 구현 커밋 찾기 (Verified-By 가 pending)
git log --format='%H %(trailers:key=Verified-By,valueonly)' | grep ' pending$'

# 다음 차례가 codex 인 검증 커밋 찾기
git log --format='%H %(trailers:key=Next-Action,valueonly)' | grep ' codex$'
```

## 캐비엇

- **강제 아님.** 위 "강제 장치 없음" 참조 — 형식은 규칙 준수에 의존한다.
- **본문은 짧게, 깊이는 위임.** 산문 본문은 사람용 2~3줄(왜·맥락). substance(파일·기준 상세·증거)는 본문이 아니라 `Handoff:` 가 가리키는 `plan.md`/`verify.md`/diff 에 둔다 — 중복은 드리프트를 부른다.
- **하니스가 붙이는 trailer (`Co-Authored-By`·`Claude-Session`).** Claude 커밋 끝에 하니스가 `Co-Authored-By: Claude … <noreply@anthropic.com>` 와 `Claude-Session: https://claude.ai/code/session_…` 를 자동으로 붙인다. 둘 다 **정식 `Key: value` trailer 라 `git interpret-trailers` 가 파싱한다** — 협업 프로토콜 파싱은 **정의된 8키 화이트리스트만** 대상으로 하고 이 둘은 무시한다(정보용). 같은 블록에 공존해야 하며 위 "함정" 의 빈 줄 규칙이 이때도 적용된다. (구 서술 "URL 은 Key: value 형식이 아니다" 는 하니스 형식 변화로 폐기 — 현행은 `Claude-Session:` 키 형식.)
