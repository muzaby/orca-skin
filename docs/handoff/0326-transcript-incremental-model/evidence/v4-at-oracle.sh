#!/bin/bash
# AT-07 subset oracle: run given scenarios, fail when any non-'missing record' failure exists.
cd "$(dirname "$0")" >/dev/null; cd /home/user/orca-skin/app
out=$(OO_SELECTION_ONLY="$1" xvfb-run -a node scripts/check-transcript-selection.mjs 2>/dev/null)
echo "$out" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read().strip().splitlines()[-1])
if d.get('error'): print('ERROR',d['error'][:200]); sys.exit(2)
f=[x for x in d['failures'] if x['reason']!='missing record']
print(len(d.get('records',[])),'records', len(f),'failures', sorted({(x['scenario'],x['reason']) for x in f})[:6]); sys.exit(1 if f else 0)"
