#!/bin/bash
# AT-07 subset oracle (verify 5): run given scenarios; red when any non-'missing record' failure.
cd /home/user/orca-skin/app
out=$(OO_SELECTION_ONLY="$1" xvfb-run -a node scripts/check-transcript-selection.mjs 2>/dev/null)
echo "$out" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read().strip().splitlines()[-1])
if d.get('error'): print('ERROR',d['error'][:200]); sys.exit(2)
f=[x for x in d['failures'] if x['reason']!='missing record']
em=[(r['screen'],r['scenario'],r.get('endsMounted')) for r in d.get('records',[]) if 'endsMounted' in r]
print(len(d.get('records',[])),'records', len(f),'failures', sorted({(x['scenario'],x['reason']) for x in f})[:6], 'endsMounted', sorted(set(em))[:9]); sys.exit(1 if f else 0)"
