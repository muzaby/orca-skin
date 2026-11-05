#!/usr/bin/env python3
"""mutate.py — 고장 내 보기(mutation) 하네스. handoff-impl의 열거 sweep과 handoff-verify의 고장 이력이 같이 쓴다.

spec 파일(JSONL, 한 줄에 고장 하나)을 순서대로 적용한다: 파일을 고친다 → oracle 명령을 돌린다 → 원문으로 되돌린다.
결과는 TSV(`id · 결과 · exit · 요약`)로 stdout에 낸다. 판정(잡음/못 잡음/동치)은 사람이 결과를 보고 고장 이력에 적는다.

spec 한 줄의 키:
  id      고장 ID (고장 이력 표의 ID와 같게)
  file    --cwd 기준 경로
  old     바꿀 원문. 정확히 일치해야 한다(공백·줄바꿈 포함)
  new     바꿀 문자열("" = 제거)
  oracle  실행할 셸 명령(--cwd에서 실행). 예: "node --test scripts/x.test.mjs", "./node_modules/.bin/vitest run src/a.test.ts"
  occ     (선택) old가 여러 번 나오면 몇 번째(0부터)를 바꿀지. 없고 여러 번 나오면 SKIP
  mode    (선택) replace(기본) · append(파일 끝에 new 추가, old 무시) · replace_last(마지막 출현을 바꿈)
  expect  (선택) "red" 또는 "green". 적으면 결과 열에 기대 일치 여부를 붙인다(역변이·대조 입력은 green)

사용:
  python3 .agents/skills/handoff-verify/scripts/mutate.py <spec.jsonl> --cwd app [--timeout 900] [--dry-run]

주의:
  - 깨끗한 작업 트리에서 돌리고, 끝나면 `git status`로 원복을 확인한다. 강제 종료(kill -9)되면 마지막 파일이 고친 채로 남을 수 있다.
  - oracle은 exit 0 = green, 그 밖 = red로 읽는다. 게이트가 위반을 exit 0으로 내는 도구라면 oracle 명령에서 판정을 exit code로 바꿔 준다.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys


def summarize(out: str) -> str:
    """흔한 테스트 러너 출력에서 한 줄 요약을 뽑는다. 못 찾으면 마지막 비어 있지 않은 줄."""
    m = re.findall(r"^# fail (\d+)", out, re.M)
    if m:
        names = re.findall(r"^\s*not ok \d+ - (.*)$", out, re.M)
        tail = f" · {'; '.join(names[:3])[:160]}" if names else ""
        return f"node --test fail {m[-1]}{tail}"
    m = re.findall(r"Tests\s+([^\n]*?(?:failed|passed)[^\n]*)", out)
    if m:
        return f"vitest {m[-1].strip()}"
    lines = [line.strip() for line in out.splitlines() if line.strip()]
    return lines[-1][:200] if lines else "(출력 없음)"


def apply(orig: str, spec: dict):
    mode = spec.get("mode", "replace")
    if mode == "append":
        return orig + "\n" + spec["new"] + "\n", None
    old = spec["old"]
    count = orig.count(old)
    if count == 0:
        return None, "old 원문 없음"
    if mode == "replace_last":
        idx = orig.rindex(old)
    else:
        occ = spec.get("occ")
        if count > 1 and occ is None:
            return None, f"old가 {count}회 나옴 — occ 지정 필요"
        idx = -1
        for _ in range((occ or 0) + 1):
            idx = orig.index(old, idx + 1)
    return orig[:idx] + spec["new"] + orig[idx + len(old):], None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("spec")
    parser.add_argument("--cwd", default=".")
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--dry-run", action="store_true", help="원문 일치만 확인하고 아무것도 바꾸지 않는다")
    args = parser.parse_args()

    specs = []
    with open(args.spec, encoding="utf8") as handle:
        for number, line in enumerate(handle, 1):
            if line.strip() and not line.lstrip().startswith("//"):
                try:
                    specs.append(json.loads(line))
                except json.JSONDecodeError as error:
                    print(f"spec {number}행 JSON 오류: {error}", file=sys.stderr)
                    return 2

    touched = {}
    print("id\t결과\texit\t요약")
    for spec in specs:
        path = os.path.join(args.cwd, spec["file"])
        with open(path, encoding="utf8") as handle:
            orig = handle.read()
        touched.setdefault(path, hashlib.sha256(orig.encode()).hexdigest())
        mutated, problem = apply(orig, spec)
        if problem:
            print(f"{spec['id']}\tSKIP\t-\t{problem}", flush=True)
            continue
        if args.dry_run:
            print(f"{spec['id']}\tOK(dry-run)\t-\t적용 가능", flush=True)
            continue
        try:
            with open(path, "w", encoding="utf8") as handle:
                handle.write(mutated)
            try:
                run = subprocess.run(spec["oracle"], cwd=args.cwd, shell=True, capture_output=True,
                                     text=True, timeout=args.timeout)
                code, out = run.returncode, run.stdout + run.stderr
            except subprocess.TimeoutExpired:
                code, out = "timeout", ""
        finally:
            with open(path, "w", encoding="utf8") as handle:
                handle.write(orig)
        verdict = "green" if code == 0 else "red"
        if spec.get("expect"):
            verdict += " (기대 일치)" if verdict == spec["expect"] else f" (기대 {spec['expect']})"
        print(f"{spec['id']}\t{verdict}\t{code}\t{summarize(out)}", flush=True)

    restored = all(
        hashlib.sha256(open(p, encoding="utf8").read().encode()).hexdigest() == digest
        for p, digest in touched.items()
    )
    print(f"# 원복 확인: {'모든 파일 원문 그대로' if restored else '원문과 다른 파일 있음 — git status 확인'}",
          file=sys.stderr)
    return 0 if restored else 1


if __name__ == "__main__":
    sys.exit(main())
