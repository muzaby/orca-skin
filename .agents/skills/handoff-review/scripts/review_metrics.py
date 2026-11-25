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
   `--size-at <rev> ...`로 여러 시점을 나란히 본다(`WORKTREE` = 커밋 전 작업 트리).

사용:
  python3 .agents/skills/handoff-review/scripts/review_metrics.py [--last N] [--size-at REV ...]

판정은 하지 않는다. review가 라운드 기록(§7)에 숫자를 옮기고, 다음 review가 같은 표로 비교한다.
"""
import argparse
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

    print("\nrev\t핵심 지침 bytes\t사례 인용")
    for rev in [*args.size_at, "HEAD", "WORKTREE"]:
        total, cites = size_at(rev)
        print(f"{rev}\t{total}\t{cites}")


if __name__ == "__main__":
    main()
