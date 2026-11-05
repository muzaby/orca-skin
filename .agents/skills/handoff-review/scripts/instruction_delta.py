#!/usr/bin/env python3
"""instruction_delta.py — 6-A Operational Instruction Delta 보조. 지침 문서를 고친 뒤 "설명 없이 사라진 것" 후보를 뽑는다.

변경 전 문서의 줄마다 변경 후의 **같은 파일**에 남았는지 먼저 보고, 없으면 다른 대조 파일에 있는지 본다.
판정(KEEP·MOVE·REPLACE·DELETE)은 사람이 후보 줄을 읽고 내린다. 종료 코드는 항상 0이다.

후보 종류:
  잃음        백틱 식별자·사례 ID(`0NNN rN`)가 어느 변경 후 문서에도 없다. 대부분 사례 세부·앵커 표기만 빠진 줄이고,
              규칙 문장이 사라진 줄이 regression이다.
  이동?       표식이 같은 파일에는 없고 다른 대조 파일에만 있다. 옮겨 간 곳을 원래 문서가 가리키는지 확인한다 —
              corpus처럼 규칙 정본이 아닌 파일에만 남았으면 지침에서는 사라진 것이다.
  문장        (--prose) 줄의 글자 4-gram이 어느 변경 후 문서의 한 줄에도 기준(--threshold, 기본 0.5)만큼 들어 있지 않다.
  문장 이동?  (--prose) 같은 파일에서는 기준 미만이고 다른 대조 파일의 한 줄에서는 기준 이상이다.

잡지 못하는 것: 문장이 거의 그대로인 줄에서 조건·범위·주체 단어 하나만 빠진 약화. 작은 수정은
  git diff --word-diff=plain <base> <head> -- <파일> | grep -oP '\\[-.*?-\\]'
로 지운 단어를 따로 본다.

사용:
  python3 .agents/skills/handoff-review/scripts/instruction_delta.py --base <변경 전 커밋> [--head <변경 후 커밋>] \\
      [--pool <파일>]... [--map <old>=<new>]... [--prose [--threshold 0.5]] <파일> [<파일> ...]

  --head 를 생략하면 변경 후 = 작업 트리.
  대조 대상 파일들은 서로의 대조 파일이 된다. --pool 은 규칙이 옮겨 갔을 수 있는 다른 파일이다(파일마다 하나씩).
  --map old=new 는 파일 이름이 바뀐 경우다(쌍마다 하나씩).
"""
import argparse
import re
import subprocess
import sys
from collections import Counter

TOKEN = re.compile(r"`([^`]{3,80})`")
CASE_ID = re.compile(r"\b0\d{3}(?: r\d+(?:\.\d+)?(?:~r\d+|→r\d+)?)?")
DECORATION = re.compile(r"[\s*`|>#\-]")
GRAM = 4
MIN_GRAMS = 8  # 표 구분선·짧은 제목처럼 대조할 내용이 없는 줄은 건너뛴다
KINDS = ("잃음", "이동?", "문장", "문장 이동?")


def read(rev, path):
    if rev is None:
        try:
            with open(path, encoding="utf8") as handle:
                return handle.read()
        except FileNotFoundError:
            return None
    result = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    if result.returncode != 0:
        return None
    return result.stdout


def grams(line):
    text = DECORATION.sub("", line)
    return {text[i : i + GRAM] for i in range(len(text) - GRAM + 1)}


def short(path):
    return "/".join(path.split("/")[-2:])


class LineIndex:
    """4-gram 역색인 — 변경 전 한 줄이 가장 많이 들어 있는 한 줄의 포함률을 잰다."""

    def __init__(self, texts):
        self.index = {}
        for number, line in enumerate(line for text in texts for line in text.split("\n")):
            for gram in grams(line):
                self.index.setdefault(gram, []).append(number)

    def containment(self, line_grams):
        hits = Counter()
        for gram in line_grams:
            hits.update(self.index.get(gram, ()))
        if not hits:
            return 0.0
        return max(hits.values()) / len(line_grams)


def classify(path, line, here, others, here_index, all_index, threshold):
    marks = set(TOKEN.findall(line)) | set(CASE_ID.findall(line))
    missing = sorted(mark for mark in marks if mark not in here)
    if missing:
        gone = [mark for mark in missing if not any(mark in text for text in others.values())]
        if gone:
            return "잃음", ", ".join(gone)
        where = sorted({short(other) for mark in missing for other, text in others.items() if mark in text})
        return "이동?", f"{', '.join(missing)} → {', '.join(where)}"
    if here_index is None or line.strip() in here:
        return None
    line_grams = grams(line)
    if len(line_grams) < MIN_GRAMS:
        return None
    score_here = here_index.containment(line_grams)
    if score_here >= threshold:
        return None
    score_all = all_index.containment(line_grams)
    if score_all >= threshold:
        return "문장 이동?", f"포함률 {score_here:.2f} → {score_all:.2f}"
    return "문장", f"포함률 {score_all:.2f}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head")
    parser.add_argument("--pool", action="append", default=[], help="규칙이 옮겨 갔을 수 있는 파일(반복 가능)")
    parser.add_argument("--map", action="append", default=[], help="old=new 경로 쌍(반복 가능)")
    parser.add_argument("--prose", action="store_true", help="표식 밖 문장도 포함률로 대조한다")
    parser.add_argument("--threshold", type=float, default=0.5, help="--prose 포함률 기준(기본 0.5)")
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()

    renames = dict(pair.split("=", 1) for pair in args.map)
    news = {path: read(args.head, renames.get(path, path)) or "" for path in args.files}
    texts = dict(news)
    for path in args.pool:
        texts.setdefault(path, read(args.head, path) or "")
    all_index = LineIndex(texts.values()) if args.prose else None

    total = Counter()
    for path in args.files:
        old = read(args.base, path)
        if old is None:
            print(f"== {path}: 변경 전 판본 없음(신규 파일)")
            continue
        here = news[path]
        others = {other: text for other, text in texts.items() if other != path}
        here_index = LineIndex([here]) if args.prose else None
        rows = []
        for number, line in enumerate(old.split("\n"), 1):
            found = classify(path, line, here, others, here_index, all_index, args.threshold)
            if found:
                rows.append((number, *found, line.strip()[:90]))
        counts = Counter(kind for _, kind, _, _ in rows)
        total.update(counts)
        summary = " · ".join(f"{kind} {counts[kind]}" for kind in KINDS if kind in counts) or "후보 0"
        print(f"== {path}: {summary}")
        for number, kind, detail, head in sorted(rows, key=lambda row: (KINDS.index(row[1]), row[0])):
            print(f"  {number}\t{kind}\t{detail[:120]}\t{head}")
    summary = " · ".join(f"{kind} {total[kind]}" for kind in KINDS if kind in total) or "0"
    print(f"# 후보 줄 {sum(total.values())} ({summary}) — 줄마다 KEEP/MOVE/REPLACE/DELETE를 판정한다", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
