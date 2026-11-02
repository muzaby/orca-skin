#!/usr/bin/env python3
"""0290 r4 verify — run discovery repro tests (per test case) against several versions of the discovery code.

usage: python3 -I repro-matrix-r4.py <app-dir of a HEAD worktree> <out.json> [repeat]
Tests: r3 C (stale reload during poll) · r3 D (reload re-watch) · r4 siblings E/G/H (verifier axes
outside the r4 report) · the r4 suite file discovery-cache.poll-race.test.ts (6 orders + re-watch).
Variants: HEAD(r4) · HEAD+C2 (adoption loop removed = r3 code shape) · r3@feaca09 · r2@68b886b ·
pre-0290@a2e8464 (discovery-cache.ts only, as in r3). Bytes are restored and copies removed after each variant.
"""
import json, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[5]
APP = pathlib.Path(sys.argv[1]).resolve()
EVID = REPO / 'docs/handoff/0290-simplify-0254-0289/verify-evidence'
DC = 'src/main/adapters/opencode/v1/discovery-cache.ts'
FW = 'src/main/infra/config/fingerprint-watch.ts'
DST = 'src/main/adapters/opencode/v1/'
COPIES = [EVID / 'r3/repro/discovery-cache.stale-reload-during-poll.verify.test.ts',
          EVID / 'r3/repro/discovery-cache.reload-rewatch.verify.test.ts',
          EVID / 'r4/repro/discovery-cache.r4-siblings.verify.test.ts']
SUITE = [DST + 'discovery-cache.poll-race.test.ts']
repeat = int(sys.argv[3]) if len(sys.argv) > 3 else 1


def git_show(rev, rel):
    return subprocess.run(['git', 'show', f'{rev}:app/{rel}'], cwd=REPO, capture_output=True, check=True).stdout


head_dc = (APP / DC).read_text(encoding='utf8')
loop_start = head_dc.index('              // A reload that read the version this pass reports')
loop_end = head_dc.index('            } else if (changed) {')
variants = {
    'HEAD(r4)': {},
    'HEAD+C2': {DC: (head_dc[:loop_start] + head_dc[loop_end:]).encode('utf8')},
    'r3@feaca09': {DC: git_show('feaca09', DC), FW: git_show('feaca09', FW)},
    'r2@68b886b': {DC: git_show('68b886b', DC), FW: git_show('68b886b', FW)},
    'pre-0290@a2e8464': {DC: git_show('a2e8464', DC)},
}
results = {}
for name, files in variants.items():
    originals = {rel: (APP / rel).read_bytes() for rel in files}
    copies = [APP / DST / src.name for src in COPIES]
    runs = []
    try:
        for rel, body in files.items():
            (APP / rel).write_bytes(body)
        for src, dst in zip(COPIES, copies):
            assert not dst.exists(), dst
            dst.write_bytes(src.read_bytes())
        for _ in range(repeat):
            report = tempfile.mktemp(suffix='.json')
            subprocess.run([str(APP / 'node_modules/.bin/vitest'), 'run', *[DST + d.name for d in copies], *SUITE,
                            '--reporter=json', '--outputFile=' + report],
                           cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
            rows = {}
            for f in json.load(open(report))['testResults']:
                fname = pathlib.Path(f['name']).name
                if not f['assertionResults']:
                    rows[fname] = {'status': 'file-failed', 'message': f.get('message', '')[:200]}
                for a in f['assertionResults']:
                    rows[fname + ' :: ' + a['title']] = {
                        'status': a['status'],
                        'message': (a.get('failureMessages') or [''])[0].split('\n')[0][:200]}
            runs.append(rows)
    finally:
        for rel, body in originals.items():
            (APP / rel).write_bytes(body)
        for dst in copies:
            dst.unlink(missing_ok=True)
    merged = {}
    for label in sorted({k for r in runs for k in r}):
        merged[label] = {'statuses': [r.get(label, {}).get('status', 'missing') for r in runs],
                         'messages': sorted({r.get(label, {}).get('message', '') for r in runs} - {''})}
    results[name] = merged
    print(name, flush=True)
    for label, v in merged.items():
        print('  ', v['statuses'], label, v['messages'][:1], flush=True)
json.dump(results, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print('tree:', repr(subprocess.run(['git', 'status', '--short', '--', '.'], cwd=APP,
                                   capture_output=True, text=True).stdout))
