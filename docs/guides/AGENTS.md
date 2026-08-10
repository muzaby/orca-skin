# docs/guides/ — 운영 절차서 (코딩 에이전트용 가이드)

이 디렉토리는 **사람이 실행하는 절차**를 담는다. `arch/` 가 *시스템이 어떻게 구성돼 있는가* 를 서술한다면, 여기는 *무엇을 어떤 순서로 하는가* 를 지시한다.

> 경계 한 줄: **구조를 서술하면 `arch/`, 절차를 지시하면 `guides/`.** 한 주제가 둘 다면 사실은 `arch/` 에 두고 여기서는 링크한다 — 사실을 양쪽에 적으면 반드시 갈라진다.

## 인벤토리

| 파일 | 주제 | 읽어야 하는 경우 | 정본 관계 |
|---|---|---|---|
| `release-operations.md` | **릴리스 운영 (0087~0089)** — 배포 채널(Windows unsigned NSIS + GitHub Releases)·`v*` 태그 트리거·수동 체크리스트·롤백·SemVer pre-1.0 정책 | 버전을 올리거나 릴리스를 실행·롤백할 때 | 워크플로 *구성* 은 `.github/workflows/{ci,release}.yml` 이 진실. 이 문서는 그 위의 절차 |
| `closed-network-extensions.md` | **폐쇄망(사내) 확장 (0130 → 0157 → 0181 전면 재작성)** — 확장 모델 축("빌드 타임 내장 ↔ 런타임 MCP")·`declarations/` 3파일 채우는 절차(게이트·LLM·서비스)·OAuth 선언 작성법·MCP `${BINDING:}`·배포 체크리스트 | 사내 로그인 게이트·LLM 자격증명·사내 서비스 도구를 **코어 수정 없이** 붙일 때 | **구조·설계 근거는 [`../arch/backend/providers.md`](../arch/backend/providers.md) 가 정본**(이 문서는 절차만). 계약의 형상은 `app/src/main/contracts/provider.ts` 가 진실 |
| `workspace-isolation-permissions.md` | **workspace 격리 권한 구성** — Agent SDK `PreToolUse` 훅 중심으로 작업 폴더 밖 r/w 를 막는 코드레벨 구성(`settings.json` 미사용) | 도구 권한·작업 디렉토리 스코프를 설계할 때 | OS 샌드박스 대체가 **아니다**(§8 한계). 권한 정규화 계층 정본은 `arch/backend/provider-runtime.md` |

## 이 디렉토리에 들어가는 것 / 안 들어가는 것

**들어간다**

- 사람이 순서대로 실행하는 절차 (릴리스·배포·확장 설치)
- 그 절차의 사전 조건·체크리스트·롤백 경로
- 절차가 실패했을 때의 판정 기준

**안 들어간다**

| 성격 | 갈 곳 |
|---|---|
| 시스템 구조·모듈 배치·타입 계약 | `docs/arch/**` |
| 채널·용어 정의 | `docs/IPC_CONTRACT.md` · `docs/GLOSSARY.md` |
| 코딩 작업 규칙 | 해당 디렉토리의 `AGENTS.md` |
| 한 번 쓰고 끝나는 작업 지시 | `docs/handoff/<NNNN-slug>/plan.md` |
| 결정의 *배경*·전략 논거 | `docs/etc/` |

## 작성 규칙

1. **한국어, 표 위주, 실행 가능한 순서로.** "~할 수 있다" 가 아니라 "~한다" 로 쓴다.
2. **사실은 복제하지 말고 링크한다.** 수치·경로·계약은 정본(`arch/**`·`IPC_CONTRACT.md`·코드)이 갖고, 여기서는 인용만 한다. 이 규칙을 어기면 정본이 바뀔 때 절차서가 조용히 거짓말을 한다.
3. **문서를 추가하면 위 인벤토리 표 + [`../AGENTS.md`](../AGENTS.md) 문서 인벤토리 표를 함께 갱신한다.** 상위 표에 없으면 에이전트가 찾지 못한다.
4. 핸드오프 번호는 *출처 표기* 로만 쓴다(`(0087~0089)`). 변동성 이력은 [`../PHASES.md`](../PHASES.md), 라이브 상태는 [`../handoff/INDEX.md`](../handoff/INDEX.md).
