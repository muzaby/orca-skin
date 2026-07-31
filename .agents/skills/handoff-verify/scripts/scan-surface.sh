#!/usr/bin/env bash
# scan-surface.sh — verify 단계 역방향 탐색 보조.
#
# 인수 기준을 읽고 코드를 찾는 대신, **변경된 코드에서 의심 표면을 먼저 뽑는다.**
# 후보만 출력하며 판정은 사람/모델이 한다 (오탐이 나오는 것이 정상).
#
# 사용:  bash scan-surface.sh [<커밋범위>]        (기본: main..HEAD)
#        SCAN_ROOT=app/src bash scan-surface.sh 26d66bc..dddfbf1
#
# 주의:  커밋 범위는 **어떤 파일을 볼지** 만 정하고, 심볼·참조는 **워킹트리 현재 내용**에서 센다.
#        검증 대상 커밋을 체크아웃한 상태에서 돌려라. 과거 상태를 보려면
#        `git worktree add --detach <dir> <hash>` 후 그 디렉토리에서 실행한다.
#
# 필요:  git, rg(ripgrep)
set -uo pipefail

RANGE="${1:-main..HEAD}"
ROOT="${SCAN_ROOT:-app/src}"

# 저장소 루트에서 돌린다 (경로가 전부 repo-relative)
cd "$(git rev-parse --show-toplevel)" || exit 1

command -v rg >/dev/null || { echo "rg(ripgrep) 가 필요합니다" >&2; exit 1; }

# 변경된 프로덕션 소스 (테스트·d.ts 제외)
mapfile -t FILES < <(
  git diff --name-only --diff-filter=d "$RANGE" -- "$ROOT" 2>/dev/null \
    | rg '\.(ts|tsx)$' | rg -v '\.(test|spec)\.(ts|tsx)$' | rg -v '\.d\.ts$'
)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "변경된 소스 파일이 없습니다 (범위: $RANGE, 루트: $ROOT)"
  exit 0
fi

echo "# scan-surface — 범위 $RANGE · 루트 $ROOT · 대상 ${#FILES[@]} 파일"
echo

is_test() { [[ "$1" =~ \.(test|spec)\.(ts|tsx)$ ]]; }

# 심볼의 참조를 세되, 정의 파일 자신은 빼고 센다.
# $1=심볼  $2=정의파일 → "외부프로덕션참조 테스트참조" 출력
count_refs() {
  local sym="$1" def="$2" prod=0 test=0 f n
  while IFS=: read -r f n; do
    [ -z "$f" ] && continue
    [ "$f" = "$def" ] && continue
    if is_test "$f"; then test=$((test + n)); else prod=$((prod + n)); fi
  done < <(rg -c -w --no-messages -- "$sym" "$ROOT" 2>/dev/null)
  echo "$prod $test"
}

# ─────────────────────────────────────────────────────────────
# 1) 미사용 export  /  2) 테스트에만 등장하는 심볼
# ─────────────────────────────────────────────────────────────
unused_val=""   # 값(런타임) export — 우선 검토 대상
unused_type=""  # 타입 전용 export — 정의 파일 내부 시그니처용이 많아 오탐률 높음
testonly=""

for file in "${FILES[@]}"; do
  [ -f "$file" ] || continue
  # "kind<TAB>symbol"
  while IFS=$'\t' read -r kind sym; do
    [ -z "${sym:-}" ] && continue
    read -r prod test <<<"$(count_refs "$sym" "$file")"
    if [ "$prod" -eq 0 ] && [ "$test" -eq 0 ]; then
      if [ "$kind" = "interface" ] || [ "$kind" = "type" ]; then
        unused_type+="  $file :: $sym"$'\n'
      else
        unused_val+="  $file :: $sym   ($kind)"$'\n'
      fi
    elif [ "$prod" -eq 0 ] && [ "$test" -gt 0 ]; then
      testonly+="  $file :: $sym   (테스트 참조 ${test}회, 프로덕션 0)"$'\n'
    fi
  done < <(
    rg -oN --no-messages \
      '^export (?:declare )?(?:abstract )?(?:async )?(function|const|let|class|interface|type|enum) ([A-Za-z_][A-Za-z0-9_]*)' \
      -r '$1@@$2' "$file" 2>/dev/null | sed 's/@@/\t/' | sort -u
  )
done

echo "## 1) 미사용 export — 프로덕션·테스트 어디서도 참조 0"
echo "   → 죽은 코드이거나, plan 이 '배선한다' 고 한 것이면 **미배선 결함**."
echo "   → 골격 API·향후 확장점이면 정상. verify 에 '왜 지금 안 쓰이는가' 를 적을 것."
echo
echo "### 1a) 값 export (function/const/class/enum) — **여기부터 본다**"
[ -n "$unused_val" ] && printf '%s' "$unused_val" || echo "  (없음)"
echo
echo "### 1b) 타입 전용 export (interface/type) — 정의 파일 내부 시그니처용이면 정상"
[ -n "$unused_type" ] && printf '%s' "$unused_type" || echo "  (없음)"
echo

echo "## 2) 테스트에만 등장 — 정의 + 테스트 참조는 있으나 프로덕션 호출 0"
echo "   → '테스트가 있으니 검증됨' 이 아니라 **아무도 안 쓴다**. 0157 D2(checkRedirect) 형태."
echo
[ -n "$testonly" ] && printf '%s' "$testonly" || echo "  (없음)"
echo

# ─────────────────────────────────────────────────────────────
# 3) 형제 파일 정책 키워드 비대칭
# ─────────────────────────────────────────────────────────────
# 같은 디렉토리 안에서 같은 보안·정책 옵션이 파일마다 다른 값을 쓰면 후보로 올린다.
# 0157 D1: authenticated-fetch.ts=redirect:'manual' ↔ browser-session-store.ts=redirect:'follow'
KEYS="${SCAN_POLICY_KEYS:-redirect|credentials|sandbox|contextIsolation|nodeIntegration|webSecurity|rejectUnauthorized|httpOnly|sameSite|referrerPolicy|withCredentials|allowRunningInsecureContent}"

mapfile -t DIRS < <(printf '%s\n' "${FILES[@]}" | xargs -r -n1 dirname | sort -u)

asym=""
for dir in "${DIRS[@]}"; do
  [ -d "$dir" ] || continue
  # "키<TAB>값<TAB>파일" 수집 (테스트 제외, 해당 디렉토리 non-recursive)
  pairs=$(
    rg -oN --no-heading --with-filename --max-depth 1 --glob '!*.test.*' --glob '!*.spec.*' \
       -r '$1@@$2' \
       "\\b($KEYS)\\s*:\\s*('[^']*'|\"[^\"]*\"|[A-Za-z0-9_.]+)" "$dir" 2>/dev/null \
    | awk -F: '{ f=$1; r=$2; for (i=3; i<=NF; i++) r=r":"$i;
                 n=index(r,"@@"); if (n==0) next;
                 k=substr(r,1,n-1); v=substr(r,n+2);
                 # PascalCase 값은 타입 주석(`mode: SomeType`)이므로 정책 값이 아니다
                 if (v ~ /^[A-Z]/) next;
                 print k "\t" v "\t" f }' \
    | tr -d '\r' | sort -u
  )
  [ -z "$pairs" ] && continue
  # 값이 2종 이상인 키만
  for key in $(printf '%s\n' "$pairs" | cut -f1 | sort -u); do
    vals=$(printf '%s\n' "$pairs" | awk -F'\t' -v k="$key" '$1==k {print $2}' | sort -u)
    nvals=$(printf '%s\n' "$vals" | wc -l | tr -d ' ')
    [ "$nvals" -lt 2 ] && continue
    asym+="  [$dir] $key —"$'\n'
    while IFS=$'\t' read -r k v f; do
      [ "$k" = "$key" ] || continue
      asym+="      $v   ← $(basename "$f")"$'\n'
    done < <(printf '%s\n' "$pairs")
  done
done

echo "## 3) 형제 파일 정책 키워드 비대칭 — 같은 디렉토리, 같은 옵션, 다른 값"
echo "   → 의도된 차이면 **근거를 verify 에 적는다. 근거를 못 대면 결함이다.**"
echo "   → 0157 D1: probe 만 redirect:'follow' 라 로그인 페이지 200 을 '인증됨' 으로 오판했다."
echo
[ -n "$asym" ] && printf '%s' "$asym" || echo "  (없음)"
echo

cat <<'EOF'
---
알려진 오탐 원인: 배럴 re-export(`export { x } from './y'`)는 프로덕션 참조로 잡히므로
미사용 export 가 가려질 수 있다 · 문자열 리터럴 안의 동명 토큰 · 타입 전용 심볼.
이 스크립트는 **후보 목록**이다. 각 항목에 "왜 괜찮은가/왜 결함인가" 를 verify 에 적어라.
EOF
