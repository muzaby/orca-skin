"""Check implementation report coordinates against the normative 0326 tables."""
import json
import re
from collections import Counter
from pathlib import Path

evidence = Path(__file__).resolve().parent
plan = (evidence.parent / 'plan.md').read_text()


def section(text, heading):
    body = text.split(heading, 1)[1]
    return re.split(r'\n#{2,3} ', body, maxsplit=1)[0]


def rows(text):
    return [[cell.strip() for cell in line.strip('|').split('|')]
            for line in text.splitlines() if line.startswith('| ')]


def require(condition, message):
    if not condition:
        raise ValueError(message)


recorded = set(re.findall(r'^\| ([^ |]+) \|[^\n]*\b(?:red|green)\b', plan, re.M))
specs = {}
current = []
historical_edits = set()
for file in sorted(evidence.glob('r3.*.jsonl')):
    for line in file.read_text().splitlines():
        spec = json.loads(line)
        key = spec['id']
        require(key not in specs, f'duplicate mutation: {key}')
        require(all(spec.get(k) for k in ('file', 'old', 'oracle', 'expect')), key)
        if not spec.get('observation'):
            require(key in recorded, f'{key}: missing recorded run')
        specs[key] = spec
        edit = (spec['file'], spec['old'], spec['new'], spec.get('mode', 'replace'),
                spec.get('occ', 0))
        if file.name.startswith('r3.5-'):
            current.append((spec['expect'], edit))
        else:
            historical_edits.add(edit)


def ids(row):
    return set(re.findall(r'[\w.-]+', ' '.join(row))) & specs.keys()


# The authoritative seat totals include sub-seats ③ⓐ..③ⓗ in EP-5.
canonical = rows(plan.split('## 10. 계약 / 타입 / 강제 지점', 1)[1].split('**규칙 칸 분기', 1)[0])
eps = {}
for row in canonical:
    ep = re.match(r'\*\*(EP-\d+)\*\*', row[0])
    if ep:
        eps[ep[1]] = (row[0].split(' / ')[-1], int(re.search(r'자리 (\d+)', ' '.join(row))[1]))
seats = [r for r in rows(section(plan, '## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 (r3.2)'))
         if re.match(r'EP-\d+ ', r[0])]
expected_seats = set()
for ep, (_, total) in eps.items():
    markers = [chr(0x2460 + i) for i in range(total)]
    if ep == 'EP-5':
        markers = ['①', '②', *('③' + chr(0x24d0 + i) for i in range(8)), '④']
    expected_seats.update(f'{ep} {marker}' for marker in markers)
seen = set()
counts = Counter()
for row in seats:
    seat, vps, name, oracle = row
    ep = seat.split()[0]
    require(seat not in seen and vps == eps[ep][0] and name and ids([oracle]), f'seat: {seat}')
    seen.add(seat)
    counts[ep] += 1
require(counts == {ep: n for ep, (_, n) in eps.items()} and seen == expected_seats and len(seen) == 166, 'EP totals')

norm = plan.split('**규칙 칸 분기', 1)[1].split('\n## ', 1)[0]
rules = set()
for row in rows(norm):
    match = re.fullmatch(r'([a-z]+)(\d+)(?:~\1(\d+))?', row[0])
    if match:
        rules.update(f'{match[1]}{i}' for i in range(int(match[2]), int(match[3] or match[2]) + 1))
mapped = Counter()
for name in ('main', 'identity', 'blocks', 'anchors', 'copy', 'stream', 'panels'):
    file = evidence / f'r3.5-{name}.md'
    for row in rows(file.read_text()):
        symbol = row[0].split()[0].strip('`')
        if symbol in rules:
            require(ids(row), f'{symbol}: missing executable mutation ID')
            referenced = re.findall(r'(?<![\w-])(?:R3[345]|B33|P33|M\d\d|E\d+|S\d\d|EP\d+)-[\w.:/-]+',
                                    ' '.join(row), re.ASCII)
            missing = {key.rstrip('.') for key in referenced} - specs.keys()
            require(not missing, f'{symbol}: unresolved mutation IDs {sorted(missing)}')
            mapped[symbol] += 1
require(len(rules) == 268 and mapped == Counter(rules),
        f'rule coverage: missing {sorted(rules - mapped.keys())}, nonunique {mapped - Counter(rules)}')

matrix = rows(plan.split('## 7-A.', 1)[1].split('\n## ', 1)[0])
registered = {r[0]: r[1].split(' · ') for r in matrix if re.fullmatch(r'VP-\d+', r[0])}
paths = {r[0]: r for r in rows(section(plan, '### D4 후속 검증 — §7-A 실행 경로 대조'))}
atomic = {r[0]: r for r in rows((evidence / 'r3.3-paths.md').read_text())}
for vp, pairs in registered.items():
    require(vp in paths and ids(paths[vp]), f'path: {vp}')
    if len(pairs) > 1:
        for i, pair in enumerate(pairs):
            key = f'{vp}{chr(97+i)} {pair}'
            require(key in atomic and ids(atomic[key]), key)
require(len(registered) == 39 and sum(map(len, registered.values())) == 49, 'VP totals')
faults = [r for r in rows(section(plan, '### §7-A 등록 변이 대조')) if re.fullmatch(r'VP-\d+', r[0])]
for vp, values in faults:
    require(vp in registered and all(key.strip() in specs for key in values.split(',')), vp)
require(len(faults) == 30 and {'M21-v1', 'M29-c3'} <= set.union(*(ids(r) for r in faults)), 'registered faults')
report = plan.split('## [구현자 기입] D4 자리·규칙·경로 보완 (r3.5)', 1)[1].split('\n## ', 1)[0]
fields = ['설계 리뷰', '강제 지점 전수와 V-pair 자기확인', '이번 라운드 수정의 잠금',
          'Product/UX 파생 검토', '놓친 잠재 문제와 대응', '구현 보고', 'Review Signals — 사실만']
require(re.findall(r'^### (.+)$', report, re.M) == fields, 'implementation report fields')
require('설계 대비 차이' in report and any(r[0] == '⑦ sweep' for r in rows(report)), 'sweep or design delta')
print(f'{len(seen)} seats, {len(registered)} paths, 49 atomic pairs, {len(mapped)} rules, {len(specs)} mutation IDs')

outcomes = Counter(outcome for outcome, _ in current)
edits = {edit for _, edit in current}
print(f'r3.5: {len(current)} executions, {outcomes["red"]} red, {outcomes["green"]} green, '
      f'{len(edits)} distinct source edits ({len(edits - historical_edits)} new to corpus)')
