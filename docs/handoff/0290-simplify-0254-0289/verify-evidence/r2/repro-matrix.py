#!/usr/bin/env python3
"""0290 r2 verify — run the r2 repro tests against several versions of the discovery code.

usage: python3 -I repro-matrix.py <out.json>
Variants: HEAD · HEAD+Z01 · HEAD+Z03 · r1 tree (0eb7dc2) · pre-0290 tree (a2e8464).
Each variant writes the listed files, copies the repro tests into app/, runs vitest, then restores
every byte and removes the copies.
"""
import json, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[5]
APP = REPO / 'app'
HERE = pathlib.Path(__file__).resolve().parent
DC = 'src/main/adapters/opencode/v1/discovery-cache.ts'
FW = 'src/main/infra/config/fingerprint-watch.ts'
REPROS = ['discovery-cache.read-stat-order.verify.test.ts', 'discovery-cache.reload-during-poll.verify.test.ts']
DST = 'src/main/adapters/opencode/v1/'
muts = {m['id'].split(' ')[0]: m for m in json.load(open(HERE / 'r2-verify-mutations.json')) if m['id'].startswith('Z0')}


def git_show(rev, rel):
    return subprocess.run(['git', 'show', f'{rev}:app/{rel}'], cwd=REPO, capture_output=True, check=True).stdout


def replaced(rel, rep):
    text = (APP / rel).read_text(encoding='utf8')
    assert text.count(rep['from']) == 1, rep['from']
    return text.replace(rep['from'], rep['to']).encode('utf8')


variants = {
    'HEAD': {},
    'HEAD+Z01': {DC: replaced(DC, muts['Z01']['replacement'])},
    'HEAD+Z03': {DC: replaced(DC, muts['Z03']['replacement'])},
    'r1@0eb7dc2': {DC: git_show('0eb7dc2', DC), FW: git_show('0eb7dc2', FW)},
    'pre-0290@a2e8464': {DC: git_show('a2e8464', DC)},
}
results = {}
for name, files in variants.items():
    originals = {rel: (APP / rel).read_bytes() for rel in files}
    copies = [APP / DST / r for r in REPROS]
    report = tempfile.mktemp(suffix='.json')
    try:
        for rel, body in files.items():
            (APP / rel).write_bytes(body)
        for r, dst in zip(REPROS, copies):
            dst.write_bytes((HERE / 'repro' / r).read_bytes())
        subprocess.run([str(APP / 'node_modules/.bin/vitest'), 'run', *[DST + r for r in REPROS],
                        '--reporter=json', '--outputFile=' + report],
                       cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
    finally:
        for rel, body in originals.items():
            (APP / rel).write_bytes(body)
        for dst in copies:
            dst.unlink(missing_ok=True)
    rows = {}
    for f in json.load(open(report))['testResults']:
        for a in f['assertionResults']:
            rows[pathlib.Path(f['name']).name] = {
                'status': a['status'],
                'message': (a.get('failureMessages') or [''])[0].split('\n')[0][:160],
            }
        if not f['assertionResults']:
            rows[pathlib.Path(f['name']).name] = {'status': 'file-failed', 'message': f.get('message', '')[:160]}
    results[name] = rows
    print(name, {k: v['status'] for k, v in rows.items()}, flush=True)
json.dump(results, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('app tree:', repr(subprocess.run(['git', 'status', '--short', '--', 'app'], cwd=REPO,
                                       capture_output=True, text=True).stdout))
