#!/usr/bin/env python3
"""review_metrics.py — review 라운드가 결과를 바꿨는지 git 이력으로 잰다.

지침 변경의 효과는 문장이 아니라 그 뒤 handoff들의 결과로만 보인다. 이 스크립트는
커밋 trailer(`Handoff:` · `Status:` · `Verified-By:`)와 `regression-coverage.md`의
`# review round K` 절이 처음 들어온 커밋 날짜로 두 가지를 낸다.

1. 라운드 구간 표 — review round K 날짜부터 다음 라운드 전까지:
   - 구간 verify 커밋 수와 그중 `claude:fail`(FAIL·RETURN_TO_PLAN) 비율
   - 구간에 시작한 handoff(첫 trailer 커밋 기준) 수 · handoff당 verify 커밋 평균 · verify 3회 이상 비율
     (최근 구간은 진행 중 handoff가 섞여 작게 나온다 — 비교는 닫힌 구간끼리 한다)
2. 지침 크기 — 핵심 지침 5개의 바이트 합과 본문 사례 인용(`0262 r4`·`(0259` 꼴) 수.
3. 발견 원장 F(N) — `docs/handoff/*/verify.md`의 `### 발견 원장 — verify N[ 정정(round K)]` 표를 읽어
   `(handoff, verify 회차)`마다 F = `이번 결과 = 열림`인 `BLOCKING`·`PLAN_GAP` 고유 ID 수를 낸다.
   같은 회차에 정정 원장이 있으면 가장 큰 K가 이긴다(정정은 회차를 늘리지 않는다).
   `직전 기록 = 검사 완료`인 늦은 발견과 증거 종류(새 실행 · 기존 증거 재분류)를 함께 센다.
   `--size-at <rev> ...`로 여러 시점을 나란히 본다(`WORKTREE` = 커밋 전 작업 트리).

사용:
  python3 .agents/skills/handoff-review/scripts/review_metrics.py [--last N] [--size-at REV ...]

판정은 하지 않는다. review가 라운드 기록(§7)에 숫자를 옮기고, 다음 review가 같은 표로 비교한다.
"""
import argparse
import glob
import re
import statistics
import subprocess
from collections import defaultdict

CORE = [
    ".agents/skills/handoff-plan/SKILL.md",
    ".agents/skills/handoff-impl/SKILL.md",
    ".agents/skills/handoff-verify/SKILL.md",
    ".agents/skills/handoff-review/SKILL.md",
    "docs/handoff/AGENTS.md",
]
COVERAGE = ".agents/skills/handoff-review/references/regression-coverage.md"
CITE = re.compile(r"0\d{3} r\d+|\(0\d{3}[ )·:]")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def handoff_commits():
    fmt = "%ad%x1f%(trailers:key=Handoff,valueonly,separator=%x1e)%x1f%(trailers:key=Status,valueonly,separator=%x1e)%x1f%(trailers:key=Verified-By,valueonly,separator=%x1e)%x1d"
    out = git("log", "--reverse", "--date=short", f"--format={fmt}")
    for rec in out.split("\x1d"):
        parts = rec.strip("\n").split("\x1f")
        if len(parts) < 4:
            continue
        date, handoff, status, verified = (p.strip() for p in parts)
        m = re.search(r"docs/handoff/(\d{4})-", handoff)
        if m:
            yield date, m.group(1), status, verified


def review_rounds():
    text = open(COVERAGE, encoding="utf8").read()
    rounds = []
    for m in re.finditer(r"^# review round (\d+) — (.*)$", text, re.M):
        heading = f"# review round {m.group(1)} — "
        dates = git("log", "--reverse", "--date=short", "--format=%ad", "-S", heading, "--", COVERAGE).split()
        if dates:
            rounds.append((int(m.group(1)), dates[0], m.group(2)[:40]))
    rounds.sort()
    return rounds


LEDGER = re.compile(r"^### 발견 원장 — verify (\d+)(?: 정정\(round (\d+)\))?\s*$", re.M)


def ledgers(pattern: str = "docs/handoff/*/verify.md"):
    """(handoff, 회차) → 행 목록. 같은 회차는 원(0) < 정정 round K 순으로 큰 쪽이 이긴다."""
    best = {}
    for path in sorted(glob.glob(pattern)):
        hid = re.search(r"/(\d{4})-", path).group(1)
        text = open(path, encoding="utf8").read()
        for m in LEDGER.finditer(text):
            n, k = int(m.group(1)), int(m.group(2) or 0)
            rows = []
            for line in text[m.end():].split("\n")[1:]:
                if not line.startswith("|"):
                    if rows:
                        break
                    continue
                cells = [c.strip().strip("`") for c in line.strip("|").split("|")]
                if len(cells) < 6 or cells[0] in ("ID", "---") or set(cells[0]) <= {"-", ":"}:
                    continue
                rows.append(dict(zip(["id", "disp", "prev", "now", "prior", "evidence"], cells)))
            key = (hid, n)
            if key not in best or k > best[key][0]:
                best[key] = (k, rows)
    return best


def size_at(rev: str):
    total = cites = 0
    for path in CORE:
        try:
            body = open(path, encoding="utf8").read() if rev == "WORKTREE" else git("show", f"{rev}:{path}")
        except (OSError, subprocess.CalledProcessError):
            continue
        total += len(body.encode("utf8"))
        cites += len(CITE.findall(body))
    return total, cites


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--last", type=int, default=12, help="표에 낼 최근 라운드 수")
    ap.add_argument("--size-at", nargs="*", default=[], help="지침 크기를 잴 추가 rev")
    ap.add_argument("--handoff", help="발견 원장 표를 이 handoff 번호로 좁힌다(예: 0329)")
    args = ap.parse_args()

    commits = list(handoff_commits())
    first = {}
    verifies = defaultdict(int)
    for date, hid, status, _ in commits:
        first.setdefault(hid, date)
        if status == "verified":
            verifies[hid] += 1

    rounds = review_rounds()
    bounds = [(k, d, title, rounds[i + 1][1] if i + 1 < len(rounds) else "9999-12-31") for i, (k, d, title) in enumerate(rounds)]
    print("round\tfrom\tto\tverify\tfail%\t시작 handoff\tverify/handoff\t≥3 verify\t제목")
    for k, start, title, end in bounds[-args.last:]:
        span = [c for c in commits if start <= c[0] < end and c[2] == "verified"]
        fails = sum(1 for c in span if c[3] == "claude:fail")
        cohort = [h for h, d in first.items() if start <= d < end]
        counts = [verifies[h] for h in cohort]
        mean = f"{statistics.mean(counts):.1f}" if counts else "-"
        many = f"{sum(1 for c in counts if c >= 3)}/{len(counts)}" if counts else "-"
        rate = f"{100 * fails / len(span):.0f}" if span else "-"
        print(f"{k}\t{start}\t{end if end != '9999-12-31' else '현재'}\t{len(span)}\t{rate}\t{len(cohort)}\t{mean}\t{many}\t{title}")

    print("\nhandoff\tverify\t원장\tF\t열림 신규\t열림 유지\t닫힘\t늦은 발견(검사 완료·명시 이월·확인 불가)\t증거(새 실행·재분류)")
    for (hid, n), (k, rows) in sorted(ledgers().items()):
        if args.handoff and hid != args.handoff:
            continue
        blocking = {r["id"]: r for r in rows if r["disp"] in ("BLOCKING", "PLAN_GAP")}
        open_ = [r for r in blocking.values() if r["now"] == "열림"]
        new = sum(1 for r in open_ if r["prev"] == "—")
        late = [sum(1 for r in open_ if r["prior"] == v) for v in ("검사 완료", "명시 이월", "확인 불가")]
        ev = [sum(1 for r in rows if v in r["evidence"]) for v in ("새 실행", "재분류")]
        closed = sum(1 for r in blocking.values() if r["now"] == "닫힘")
        src = f"정정 round {k}" if k else "원"
        print(f"{hid}\t{n}\t{src}\t{len(open_)}\t{new}\t{len(open_) - new}\t{closed}\t{'·'.join(map(str, late))}\t{'·'.join(map(str, ev))}")
        for r in open_:
            if r["prior"] == "검사 완료":
                print(f"\t\t권고 신호\t{r['id']}\t앞 기록이 검사 완료였던 범위의 늦은 발견")

    print("\nrev\t핵심 지침 bytes\t사례 인용")
    for rev in [*args.size_at, "HEAD", "WORKTREE"]:
        total, cites = size_at(rev)
        print(f"{rev}\t{total}\t{cites}")


if __name__ == "__main__":
    main()
