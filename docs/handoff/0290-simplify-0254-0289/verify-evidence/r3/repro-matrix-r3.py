#!/usr/bin/env python3
"""0290 r3 verify — run the discovery repro tests against several versions of the discovery code.

usage: python3 -I repro-matrix-r3.py <out.json> [repeat]
Repros: r1 F1 (hold-race) · r2 A (read-stat-order) · r2 B (reload-during-poll = F3) ·
        r3 C (stale-reload-during-poll) · r3 D (reload-rewatch) — verifier axes outside the r3 report.
Variants: HEAD(r3) · HEAD+D7-revert (r2 early return) · HEAD+Z03(r3 form) · HEAD+Z01 · HEAD+X07 ·
          r2 code (68b886b = PR 0fa04db) · r1 code (6eb0409 = PR 0eb7dc2) · pre-0290 (a2e8464).
Each variant writes the listed files, copies the repro tests into app/, runs vitest `repeat` times,
then restores every byte and removes the copies.
"""
import json, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[5]
APP = REPO / 'app'
EVID = REPO / 'docs/handoff/0290-simplify-0254-0289/verify-evidence'
DC = 'src/main/adapters/opencode/v1/discovery-cache.ts'
FW = 'src/main/infra/config/fingerprint-watch.ts'
DST = 'src/main/adapters/opencode/v1/'
REPROS = {
    'F1-hold-race': EVID / 'repro/discovery-cache.hold-race.verify.test.ts',
    'A-read-stat-order': EVID / 'r2/repro/discovery-cache.read-stat-order.verify.test.ts',
    'B-reload-during-poll(F3)': EVID / 'r2/repro/discovery-cache.reload-during-poll.verify.test.ts',
    'C-stale-reload-during-poll': EVID / 'r3/repro/discovery-cache.stale-reload-during-poll.verify.test.ts',
    'D-reload-rewatch': EVID / 'r3/repro/discovery-cache.reload-rewatch.verify.test.ts',
}
repeat = int(sys.argv[2]) if len(sys.argv) > 2 else 1


def git_show(rev, rel):
    return subprocess.run(['git', 'show', f'{rev}:app/{rel}'], cwd=REPO, capture_output=True, check=True).stdout


def replaced(rel, frm, to):
    text = (APP / rel).read_text(encoding='utf8')
    assert text.count(frm) == 1, frm
    return text.replace(frm, to).encode('utf8')


GUARD = ('            } else if (changed) {\n              observer.dependencies = next\n            }',
         '            }\n            if (changed) observer.dependencies = next')
D7_REVERT = ("              // Keep the reload's manifest, but still report changes seen by this pass.\n"
             "              this.pollRequested = true",
             '              this.pollRequested = true\n              return')
X07 = ('            observer.dependencies = new Map(manifest)\n            this.watch(key)',
       '            observer.dependencies = new Map(manifest)')
Z01 = ('      (value) => ({ value, signature: hash(describe(value)), fingerprint }),',
       '      async (value) => ({ value, signature: hash(describe(value)), fingerprint: await fileFingerprints([path]) }),')
variants = {
    'HEAD(r3)': {},
    'HEAD+D7-revert': {DC: replaced(DC, *D7_REVERT)},
    'HEAD+Z03': {DC: replaced(DC, *GUARD)},
    'HEAD+Z01': {DC: replaced(DC, *Z01)},
    'HEAD+X07': {DC: replaced(DC, *X07)},
    'r2@68b886b': {DC: git_show('68b886b', DC), FW: git_show('68b886b', FW)},
    'r1@6eb0409': {DC: git_show('6eb0409', DC), FW: git_show('6eb0409', FW)},
    'pre-0290@a2e8464': {DC: git_show('a2e8464', DC)},
}
results = {}
for name, files in variants.items():
    originals = {rel: (APP / rel).read_bytes() for rel in files}
    copies = {label: APP / DST / src.name for label, src in REPROS.items()}
    runs = []
    try:
        for rel, body in files.items():
            (APP / rel).write_bytes(body)
        for label, dst in copies.items():
            assert not dst.exists(), dst
            dst.write_bytes(REPROS[label].read_bytes())
        for _ in range(repeat):
            report = tempfile.mktemp(suffix='.json')
            subprocess.run([str(APP / 'node_modules/.bin/vitest'), 'run', *[DST + d.name for d in copies.values()],
                            '--reporter=json', '--outputFile=' + report],
                           cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
            rows = {}
            for f in json.load(open(report))['testResults']:
                label = next(k for k, d in copies.items() if pathlib.Path(f['name']).name == d.name)
                if not f['assertionResults']:
                    rows[label] = {'status': 'file-failed', 'message': f.get('message', '')[:200]}
                for a in f['assertionResults']:
                    rows[label] = {'status': a['status'],
                                   'message': (a.get('failureMessages') or [''])[0].split('\n')[0][:200]}
            runs.append(rows)
    finally:
        for rel, body in originals.items():
            (APP / rel).write_bytes(body)
        for dst in copies.values():
            dst.unlink(missing_ok=True)
    merged = {}
    for label in REPROS:
        statuses = [r.get(label, {}).get('status', 'missing') for r in runs]
        msgs = sorted({r.get(label, {}).get('message', '') for r in runs} - {''})
        merged[label] = {'statuses': statuses, 'messages': msgs}
    results[name] = merged
    print(name, {k: v['statuses'] for k, v in merged.items()}, flush=True)
json.dump(results, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('app tree:', repr(subprocess.run(['git', 'status', '--short', '--', 'app'], cwd=REPO,
                                       capture_output=True, text=True).stdout))
