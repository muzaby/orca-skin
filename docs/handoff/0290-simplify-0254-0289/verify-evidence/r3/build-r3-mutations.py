#!/usr/bin/env python3
"""0290 r3 verify — build r3-verify-mutations.json from the r2 verifier definitions.

usage: python3 -I build-r3-mutations.py
- keeps every r2 row (r1 history 107 · r2 implementer 5 · r2 verifier Z01~Z17 · F1/F2 repro rows),
- translates Z03 (stale-manifest guard removal) to the r3 code shape,
- adds discovery-cache.poll-race.test.ts (new r3 test) to the discovery rows Z01·Z02·Z03·Z12,
- adds D7 cited rows, F3 (r2 repro B) and F4 (r3 repro C) rows, and verifier axes X06·X07.
Each replacement is checked to apply exactly once to the current app tree.
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[4]
APP = REPO / 'app'
EVID = 'docs/handoff/0290-simplify-0254-0289/verify-evidence'
DC = 'src/main/adapters/opencode/v1/discovery-cache.ts'
POLL = 'src/main/adapters/opencode/v1/discovery-cache.poll-race.test.ts'
r2 = json.load(open(HERE.parent / 'r2' / 'r2-verify-mutations.json'))
by = {m['id']: m for m in r2}
DISCOVERY = list(by['Z01 VP07-4-probe-stat-after-load']['tests']) + [POLL]

GUARD = {'from': '            } else if (changed) {\n              observer.dependencies = next\n            }',
         'to': '            }\n            if (changed) observer.dependencies = next'}
D7_REVERT = {'from': "              // Keep the reload's manifest, but still report changes seen by this pass.\n"
                     "              this.pollRequested = true",
             'to': '              this.pollRequested = true\n              return'}

out = []
for m in r2:
    m = json.loads(json.dumps(m))
    if m['id'].startswith('Z03 '):
        m['replacement'] = GUARD
        m['note'] = 'r3 형태로 번역 — manifest 가드 제거(갱신 manifest를 next로 덮음)'
    if m['id'].split(' ')[0] in ('Z01', 'Z02', 'Z03', 'Z12'):
        m['tests'] = DISCOVERY
    out.append(m)

out += [
    {'id': 'C1 D7-early-return-restore', 'file': DC, 'replacement': D7_REVERT, 'tests': DISCOVERY,
     'note': 'D7 인용 변이 — r2 조기 반환 복원'},
    {'id': 'F3 repro@HEAD', 'file': None, 'replacement': None,
     'tests': ['src/main/adapters/opencode/v1/discovery-cache.reload-during-poll.verify.test.ts'],
     'extraFiles': [{'src': f'{EVID}/r2/repro/discovery-cache.reload-during-poll.verify.test.ts',
                     'dst': 'src/main/adapters/opencode/v1/discovery-cache.reload-during-poll.verify.test.ts'}]},
    {'id': 'F3 repro+D7-revert', 'file': DC, 'replacement': D7_REVERT,
     'tests': ['src/main/adapters/opencode/v1/discovery-cache.reload-during-poll.verify.test.ts'],
     'extraFiles': [{'src': f'{EVID}/r2/repro/discovery-cache.reload-during-poll.verify.test.ts',
                     'dst': 'src/main/adapters/opencode/v1/discovery-cache.reload-during-poll.verify.test.ts'}]},
    {'id': 'F4 repro@HEAD', 'file': None, 'replacement': None,
     'tests': ['src/main/adapters/opencode/v1/discovery-cache.stale-reload-during-poll.verify.test.ts'],
     'extraFiles': [{'src': f'{EVID}/r3/repro/discovery-cache.stale-reload-during-poll.verify.test.ts',
                     'dst': 'src/main/adapters/opencode/v1/discovery-cache.stale-reload-during-poll.verify.test.ts'}],
     'note': '검증자 축 — 옛 내용을 읽은 재로드가 poll pass 중 끝남. 기대 통보 1회'},
    {'id': 'X06 VP07-4-force-reuse-ignores-fingerprint', 'file': DC,
     'replacement': {'from': '        cached.fingerprint === fingerprint &&', 'to': '        true &&'},
     'tests': DISCOVERY, 'note': '고정값 — 강제 probe가 지문 변화와 무관하게 TTL 안 캐시 재사용(D6 계약의 다른 지점)'},
    {'id': 'X07 VP07-4-reload-rewatch-removed', 'file': DC,
     'replacement': {'from': '            observer.dependencies = new Map(manifest)\n            this.watch(key)',
                     'to': '            observer.dependencies = new Map(manifest)'},
     'tests': DISCOVERY, 'note': '제거 — 재로드가 바꾼 의존 파일 목록으로 감시를 다시 걸지 않음(R3-03 new-file 운반 edge)'},
]

for m in out:
    rep = m.get('replacement')
    if rep is None:
        continue
    reps = rep if isinstance(rep, list) else [rep]
    text = (APP / m['file']).read_text(encoding='utf8')
    for r in reps:
        if 'pattern' in r or r.get('all') or 'nth' in r or isinstance(r.get('from'), dict):
            continue  # regex/nth rows: the runner reports NOAPPLY if they no longer match
        assert text.count(r['from']) == 1, (m['id'], text.count(r['from']))
json.dump(out, open(HERE / 'r3-verify-mutations.json', 'w'), ensure_ascii=False, indent=1)
print('rows', len(out))
