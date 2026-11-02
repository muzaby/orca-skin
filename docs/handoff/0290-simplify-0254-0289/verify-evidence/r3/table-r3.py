#!/usr/bin/env python3
"""0290 r3 verify — render the 고장 이력 table rows from r3-mutation-rerun.json.

usage: python3 -I table-r3.py > rows.md
Rows of the r2 table are reused (파일:줄 · 종류 · 바꾼 내용 · 귀속); `직전 결과` becomes the r2 result and
`이번 결과`/`잡은 테스트`/`범위` come from the r3 run. Rows new in r3 are rendered from NEW below.
"""
import json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
VERIFY = HERE.parents[1] / 'verify.md'
res = {r['id']: r for r in json.load(open(HERE / 'r3-mutation-rerun.json'))}
defs = {m['id']: m for m in json.load(open(HERE / 'r3-verify-mutations.json'))}

lines = VERIFY.read_text(encoding='utf8').split('\n')
start = next(i for i, l in enumerate(lines) if l.startswith('**고장 이력** — r2에서 시도한 고장 전부'))
r2rows = {}
for l in lines[start:]:
    if l.startswith('- 검산'):
        break
    if l.startswith('| ') and not l.startswith('| ID') and not l.startswith('|---'):
        cells = [c.strip() for c in re.split(r'(?<!\\)\|', l)[1:-1]]
        r2rows[cells[0]] = cells


def short(result):
    if result.startswith('**못 잡음**'):
        return '못 잡음'
    for k in ('잡음', '동치'):
        if result.startswith(k):
            return k
    return result


def first_test(r):
    if not r.get('failed'):
        return '—'
    f, title = r['failed'][0].split('\t', 1)
    return f'{pathlib.Path(f).name} — {title[:40]}'


def rev(r):
    n = len(r.get('failed', []))
    return f"red {n}/{r.get('total')}" if r['result'] == 'CAUGHT' else fmt(r)


def fmt(r, expect_red=False):
    total = r.get('total')
    n = len(r.get('failed', []))
    if r['result'] == 'CAUGHT':
        return f'잡음 {n}/{total}'
    if r['result'] == 'MISSED':
        return f'**못 잡음** 0/{total}'
    if r['result'] == 'GREEN':
        return f'green {total}/{total}'
    if r['result'] == 'RED':
        return f'red {n}/{total}'
    return r['result']


out = []
for cid, cells in r2rows.items():
    key = cid.split(' ')[0]
    if key in ('S1', 'S2', 'S3'):
        continue  # static rows come from static-r3.log
    if key == 'F1':
        head, rv = res['F1 repro@HEAD'], res['F1 repro+fix-revert']
        now = f"{'잡음' if head['result'] == 'GREEN' and rv['result'] == 'CAUGHT' else '확인'} — HEAD {fmt(head)} · 되돌림 {rev(rv)}"
        out.append([cid, cells[1], cells[2], cells[3], '1파일', short(cells[6]), now, first_test(rv), cells[8]])
        continue
    if key == 'F2':
        head, rv = res['F2 repro@HEAD'], res['F2 repro+fix-revert']
        now = f"{'잡음' if head['result'] == 'GREEN' and rv['result'] == 'CAUGHT' else '확인'} — HEAD {fmt(head)} · 되돌림 {rev(rv)}"
        out.append([cid, cells[1], cells[2], cells[3], '1파일', short(cells[6]), now, first_test(rv), cells[8]])
        continue
    if key == 'F3':
        head, rv = res['F3 repro@HEAD'], res['F3 repro+D7-revert']
        now = f"{'잡음' if head['result'] == 'GREEN' and rv['result'] == 'CAUGHT' else '확인'} — 재현 B HEAD {fmt(head)} · D7 되돌림 {rev(rv)}"
        out.append([cid, '`main/adapters/opencode/v1/discovery-cache.ts:262`', cells[2], cells[3], '1파일',
                    short(cells[6]), now, first_test(rv), cells[8]])
        continue
    rid = next((i for i in res if i == cid or i.startswith(cid + ' ') or i == cid.split(' ')[0] + ' ' + ' '.join(cid.split(' ')[1:])), None)
    if rid is None:
        rid = next((i for i in res if i.split(' ')[0] == key and not i.startswith('F')), None)
    r = res[rid]
    change = cells[3]
    where = cells[1]
    if key == 'Z03':
        change = '`} else if (changed) {⏎ observer.dependencies = next⏎ } → }⏎ if (changed) observer.dependencies = next`(r3 형태)'
        where = '`main/adapters/opencode/v1/discovery-cache.ts:265`'
    now = fmt(r)
    if key == 'Z16' and r['result'] == 'MISSED':
        now = f"동치 0/{r.get('total')} — 근거 §r2-4, `adapter.ts` r3 diff 0"
    out.append([cid, where, cells[2], change, f"{len(defs[rid]['tests'])}파일", short(cells[6]), now, first_test(r), cells[8]])

NEW = [
    ('C1 D7-early-return-restore', '`main/adapters/opencode/v1/discovery-cache.ts:263`', '제거',
     '`this.pollRequested = true` 뒤 `return` 복원(r2 조기 반환)', 'D7 인용 변이'),
    ('X06 VP07-4-force-reuse-ignores-fingerprint', '`main/adapters/opencode/v1/discovery-cache.ts:44`', '고정값',
     '`cached.fingerprint === fingerprint && → true &&`', 'VP-07 ④ 재량(검증자 축 — D6 계약의 다른 지점)'),
    ('X07 VP07-4-reload-rewatch-removed', '`main/adapters/opencode/v1/discovery-cache.ts:164`', '제거',
     '`run()` 재로드 뒤 `this.watch(key)` 삭제', 'VP-07 ④ 재량(검증자 축 — R3-03 운반 edge)'),
]
for cid, where, kind, change, owner in NEW:
    r = res[cid]
    now = fmt(r)
    if cid.startswith('X07'):
        now += ' — 재현 D HEAD green 3/3 · X07 red 3/3'
    out.append([cid, where, kind, change, f"{len(defs[cid]['tests'])}파일", '신규', now, first_test(r), owner])
f4 = res['F4 repro@HEAD']
out.append(['F4 D8-stale-reload-during-poll', '`main/adapters/opencode/v1/discovery-cache.ts:262-274`', '회귀 재현',
            '재로드가 편집 전 `a`를 읽고 poll pass 대기 중 완료 → pass 재개', '1파일', '신규',
            f"**못 잡음** — 기존 스위트 green, 재현 C HEAD {fmt(f4)}(통보 2회) · r2·r1·`a2e8464` green",
            '재현 C(검증자 축)', 'VP-07 ④ · AC12'])
for row in out:
    print('| ' + ' | '.join(row) + ' |')
print(f'<!-- rows: {len(out)} -->')
