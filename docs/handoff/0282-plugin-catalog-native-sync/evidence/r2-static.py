from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[4]
app=root/'app'; out=root/'work/handoff-0282-r2-static-recheck'
out.mkdir(parents=True, exist_ok=True)
pattern=r'OpenCodeGlobalPlugins|PluginRecordStore|OpenCodeDisabledPlugin|openCodeDisabledPlugins|setOpenCodeDisabledPlugins|globalResourceControl|insertPluginEntry|removePluginEntry|SetGlobalNativeResourceResult|opencode-restart|openCodeSessions|reconcilePlugins|OpenCodeGlobalPluginControl|OpenCodePluginRecordStore|rendererSettings|jsonc-parser|openCodeGlobalWatch\?\.drain|confirmed\?: true|confirmed: z\.literal|request\.confirmed|globalWatch\.change|change\(action|restartTitle|restartBody|restartConfirm'
paths=['app/src','app/package.json','app/package-lock.json','docs/TRD.md','docs/IPC_CONTRACT.md','docs/arch','app/AGENTS.md']
commands=[['rg','-n',pattern,*paths,'-g','!*.test.ts','-g','!*.test.tsx'],['rg','-n','nativeFileMutations','app/src/main/adapters/opencode'],['rg','-n',r'revalidate|composerAgentCache|ComposerAgentCache','app/src/main/app/composer-catalog-owner.ts','app/src/main/app/handlers/composer-catalog.ts','app/src/shared/composer-catalog.ts','app/src/renderer/src/features/chat/harnesses/opencode/composer','-g','!*.test.ts']]
def run_gate():
 results=[]
 for c in commands:
  p=subprocess.run(c,cwd=root,capture_output=True,text=True,encoding='utf-8'); assert p.returncode in [0,1],p.stderr
  results.append({'command':c,'matches':p.stdout.splitlines()})
 return results
base=run_gate(); assert all(not x['matches'] for x in base),base
file=app/'src/main/adapters/opencode/v1/global-plugins.ts'; original=file.read_bytes()
try:
 file.write_text("import { nativeFileMutations } from '../../../infra/config/file-mutation'\n"+original.decode('utf-8'),encoding='utf-8')
 bad=run_gate(); assert len(bad[1]['matches'])==1,bad
finally: file.write_bytes(original)
restored=run_gate(); assert restored==base
(out/'static-gates.json').write_text(json.dumps({'baseline':base,'mutation':bad,'restored':restored,'shaRestored':hashlib.sha256(file.read_bytes()).hexdigest()==hashlib.sha256(original).hexdigest()},ensure_ascii=False,indent=2),encoding='utf-8')
cmd=['node','node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.node.json','--composite','false']
def types(name):
 p=subprocess.run(cmd,cwd=app,capture_output=True,text=True,encoding='utf-8'); (out/name).write_text(p.stdout+p.stderr,encoding='utf-8'); return p
assert types('type-guard-base.log').returncode==0
file=app/'src/shared/ipc.ts'; original=file.read_bytes()
try:
 text=original.decode('utf-8'); anchor="'scheduler' | 'nativeExtensionChoices' | 'projectMcpChoices'"; assert anchor in text
 file.write_text(text.replace(anchor,"'scheduler' | 'projectMcpChoices'",1),encoding='utf-8')
 bad=types('type-guard-mutant.log'); assert bad.returncode!=0 and 'nativeExtensionChoices.testfixture.ts' in bad.stdout and 'TS2578' in bad.stdout,bad.stdout
finally: file.write_bytes(original)
print('EP-10 base/mutant/restored matches: 0/1/0; deleted owner route: 0; SettingsPatch exclusion mutant: TS2578; originals restored')
