from pathlib import Path
import subprocess, json, sys, hashlib

root = Path(__file__).resolve().parents[4]
app = root / 'app'
output = root / 'work' / 'handoff-0282-r2-20261024' / 'mutations'
output.mkdir(parents=True, exist_ok=True)
cases = []

def replace(old, new, count=1):
    def apply(s):
        if old not in s:
            raise ValueError('anchor missing: '+old)
        return s.replace(old, new, count)
    return apply

def add(id, pair, source, transform, *suites):
    cases.append((id, pair, source, transform, suites))

state = 'src/renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts'
state_test = state.replace('.ts', '.test.ts')
module_test = 'src/renderer/src/features/chat/harnesses/opencode/composer/Module.integration.test.ts'
custom = 'src/renderer/src/features/skills/components/customize/CustomizeList.tsx'
custom_test = custom.replace('.tsx', '.render.test.ts')
boot = 'src/main/app/bootstrap.ts'
boot_test = boot.replace('.ts', '.native-history.test.ts')
resources = 'src/main/adapters/claude/configured-resources.ts'
resource_test = resources.replace('.ts', '.test.ts')
plugins = 'src/main/adapters/claude/plugin-catalog.ts'
global_plugins = 'src/main/adapters/opencode/v1/global-plugins.ts'
global_test = global_plugins.replace('.ts', '.test.ts')
watch = 'src/main/app/opencode-global-watch.ts'
watch_test = watch.replace('.ts', '.test.ts')
cache = 'src/renderer/src/features/chat/harnesses/opencode/composer/composerAgentCache.ts'

add('M01', 'VP-01 A2', state, replace("void this.read('agents')", "void sessionApi.composerCatalog({ owner: this.owner, scope: this.scope, part: 'agents' })"), module_test, state_test)
add('M02', 'VP-01 A1', state, replace('this.snapshot.agents = this.agentSlot()', "this.snapshot.agents = { status: 'loading' }"), state_test, module_test)
add('M03', 'VP-02 A3', state, replace("agents: this.agents.getState().agents === undefined ? { status: 'error' } : this.agentSlot(),", "agents: { status: 'error' },"), state_test)

def swap_groups(s):
    line = "      {tab === 'providers' && nativeList}\n"
    anchor = "      {tab === 'providers' &&\n        orderProviders"
    if line not in s or anchor not in s: raise ValueError('group anchor missing')
    return s.replace(line, '').replace(anchor, line + anchor)
add('M04', 'VP-08 R3/R4', custom, swap_groups, custom_test)
add('M05', 'VP-08 R1', custom, replace("resource.kind === (tab === 'providers' ? 'plugin' : 'mcp')", "resource.kind === (tab === 'providers' ? 'mcp' : 'plugin')"), custom_test)
add('M06', 'VP-09 C1', 'src/main/adapters/claude/adapter.ts', replace("const choices = this.extensionControl?.global('claude') ?? {}", "const holder = this as unknown as { frozen?: Record<string, boolean> }; const choices = holder.frozen ??= this.extensionControl?.global('claude') ?? {}"), 'src/main/adapters/claude/adapter.native-plugins.test.ts', boot_test)

def omit_draft_choices(s):
    start = s.index('(await harnessModule(backend).configuredCommands?.(')
    end = s.index('?? []', start)
    chunk = s[start:end]
    if 'this.extensionChoices.global(backend)' not in chunk: raise ValueError('draft choices missing')
    return s[:start]+chunk.replace('this.extensionChoices.global(backend)', '{}')+s[end:]
add('M07', 'VP-09 C12', boot, omit_draft_choices, boot_test)
add('M08', 'VP-09 C5', resources, replace("    ...extensionChoices(choices, 'plugin'),\n    ...record(project.enabledPlugins),", "    ...record(project.enabledPlugins),\n    ...extensionChoices(choices, 'plugin'),"), resource_test, boot_test)
add('M09', 'VP-12 C4', plugins, replace("    ...record(readObject(join(nativeRoot, 'settings.json')).enabledPlugins),\n    ...record(overrides.enabledPlugins)", "    ...record(overrides.enabledPlugins),\n    ...record(readObject(join(nativeRoot, 'settings.json')).enabledPlugins)"), boot_test)
add('M10', 'VP-12 C5', resources, replace("    ...record(user.enabledPlugins),\n    ...extensionChoices(choices, 'plugin'),", "    ...extensionChoices(choices, 'plugin'),\n    ...record(user.enabledPlugins),"), resource_test, boot_test)


def reset_models(s):
    start = s.index('this.detachAgents = this.agents.subscribe')
    end = s.index('this.detach = sessionApi', start)
    return s[:start]+replace('this.snapshot = { ...this.snapshot, agents: this.agentSlot() }', "this.snapshot = { ...this.snapshot, agents: this.agentSlot(), models: { status: 'loading' } }")(s[start:end])+s[end:]
add('M16', 'VP-21 Q10 models', state, reset_models, state_test)
add('M18', 'VP-23 P1 priority', global_plugins, replace("['config.json', 'opencode.json', 'opencode.jsonc']", "['config.json', 'opencode.jsonc', 'opencode.json']"), global_test)
add('M19', 'VP-28 E2', resources, replace('if (!isAbsolute(installPath) || !claudeInstallationExists(installPath)) continue', '// installation existence check removed'), resource_test, boot_test)
add('M21', 'VP-29 X2 fingerprint', watch, replace('if (this.closed || next === this.fingerprint)', 'if (this.closed)'), watch_test)
add('M22', 'VP-29 X1 callback', watch, replace('persistent: false }, this.callback)', 'persistent: false }, () => {})'), watch_test)



# Retained selected evidence from the baseline; superseded write paths are excluded.
store = cache.replace('composerAgentCache','composerAgentStore')
store_test = store.replace('.ts','.test.ts')
hook = state.replace('composerCatalogState','useComposerCatalog')
view = custom.replace('CustomizeList.tsx','ExtensionsCatalogView.tsx')
view_test = view.replace('.tsx','.interaction.test.ts')
control = 'src/main/app/extension-control.ts'
control_test = control.replace('.ts','.test.ts')
migration = 'src/main/infra/settings-migration.ts'
add('R01','VP-04 prime revision comparison',store,replace('revision <= get().revision','revision > get().revision'),store_test,state_test)
add('R02','VP-04 prime captured revision',store,replace('revision !== current.revision || ',''),store_test)
add('R03','VP-04 prime first value',store,replace(' || current.agents !== undefined',''),store_test,state_test)
add('R04','VP-04 prime,VP-35 creation subscription',store,replace('  subscribe(({ revision }) => store.getState().invalidate(revision))','  void subscribe'),store_test,module_test)
add('R05','VP-03 prime unscoped pending',hook,replace("agents: agents === undefined ? pending.agents : { status: 'ready', value: agents }",'agents: pending.agents'),module_test)
add('R06','VP-03 prime selector',hook,replace('(state) => state.agents','() => undefined'),module_test)
add('R07','VP-21 prime broadcast',boot,replace('        broadcastOpenCodePluginsChanged({ revision })','        void revision'),boot_test)
add('R08','VP-21 prime order',boot,replace("        ctx.registry.get('opencode')?.extensionsChanged?.()\n        broadcastOpenCodePluginsChanged({ revision })","        broadcastOpenCodePluginsChanged({ revision })\n        ctx.registry.get('opencode')?.extensionsChanged?.()"),boot_test)
add('R09','VP-21 prime channel','src/preload/index.ts',replace('subscribe(CHANNELS.extensionOpenCodePluginsChanged, handler)','subscribe(CHANNELS.composerCatalogInvalidated, handler)'), 'src/preload/index.test.ts')
add('R10','VP-21 prime revision','src/main/infra/ipc/send.ts',replace('broadcast(CHANNELS.extensionOpenCodePluginsChanged, event)','broadcast(CHANNELS.extensionOpenCodePluginsChanged, { revision: 1 })'),boot_test)
add('R11','VP-35 captured revision / prior M13',state,replace('accept(result.value, revision)','accept(result.value, this.agents.getState().revision)'),state_test)
add('R12','F7 verify M09 / VP-35',state,replace('      this.snapshot = { ...this.snapshot, agents: this.agentSlot() }\n      this.detachAgents', '      this.detachAgents'),state_test)
add('R13','F3 verify M21 / VP-07,08',custom,replace("tab !== 'skills' && resource.kind",'resource.kind'),view_test)
add('R14','F3 verify M25 / VP-07',view,replace("selection.tab !== 'skills' && nativeMcp.failed",'nativeMcp.failed'),view_test)
add('R15','F4 verify M41 / VP-09,10','src/main/adapters/claude/adapter.ts',replace('          ...(req.providerSettings?.settings?.enabledPlugins as Record<string, unknown>),\n          ...flags','          ...flags,\n          ...(req.providerSettings?.settings?.enabledPlugins as Record<string, unknown>)'),'src/main/adapters/claude/adapter.native-plugins.test.ts')
add('R16','VP-18 double prime capability','src/main/adapters/opencode/v1/configured-resources.ts',replace("canToggle: item.kind === 'mcp'",'canToggle: true'),global_test,boot_test)
add('R17','VP-31 double prime fingerprint',global_plugins,replace('return JSON.stringify(entries)',"return openCodeGlobalConfigFiles(env, home).join(',')"),global_test)
add('R18','VP-36 save',control,replace('      store?.set(structuredClone(next))','      void store'),control_test)
add('R19','VP-36 restore',control,replace('structuredClone(store?.get() ?? {})','{}'),control_test)
add('R20','VP-36 backend',control,replace('global: (backend) => ({ ...choices[backend] })',"global: (backend) => ({ ...choices[backend === 'claude' ? 'opencode' : 'claude'] })"),control_test)
add('R21','VP-37 production wiring',boot,replace("extensionControl({\n    get: () => this.settings.getAll().nativeExtensionChoices,\n    set: (choices) => this.settings.setNativeExtensionChoices(choices)\n  })",'extensionControl()'),boot_test)
add('R22','VP-38 version',migration,replace('version < 2','version >= 2'),migration.replace('.ts','.test.ts'))
add('R23','VP-38 clear',migration,replace('if (version < 2) delete renamed.nativeExtensionChoices','void version'),migration.replace('.ts','.test.ts'))
add('R24','prior verify M11 equivalent subscribe loading',state,replace('      this.snapshot = { ...this.snapshot, agents: this.agentSlot() }\n      this.detachAgents',"      this.snapshot = { ...this.snapshot, agents: { status: 'loading' } }\n      this.detachAgents"),state_test,module_test)
add('R25','server retire call','src/main/adapters/opencode/v1/adapter.ts',replace('this.servers.retireAll?.()','void this.servers'),'src/main/adapters/opencode/v1/server.test.ts')
add('R26','server retirement map','src/main/adapters/opencode/v1/server.ts',replace('    this.entries.clear()','    void this.entries'),'src/main/adapters/opencode/v1/server.test.ts')

results = []
selected = set(sys.argv[1:])
for id, pair, source, transform, suites in cases:
    if selected and id not in selected: continue
    path = app / source
    original = path.read_bytes()
    (output / (id+'.original')).write_bytes(original)
    record = {'id': id, 'pair': pair, 'source': source}
    try:
        mutated = transform(original.decode('utf-8'))
        path.write_text(mutated, encoding='utf-8', newline='')
        report = output / (id+'.json')
        with (output / (id+'.log')).open('w', encoding='utf-8') as log:
            process = subprocess.run(['node', 'node_modules/vitest/vitest.mjs', 'run', *suites, '--maxWorkers=1', '--reporter=json', '--outputFile='+str(report)], cwd=app, stdout=log, stderr=subprocess.STDOUT, timeout=240)
        summary = json.loads(report.read_text(encoding='utf-8'))
        failures = [a['fullName'] for t in summary.get('testResults', []) for a in t.get('assertionResults', []) if a.get('status') == 'failed']
        record.update(failed=summary.get('numFailedTests'), passed=summary.get('numPassedTests'), tests=failures, exit=process.returncode)
        record['result'] = 'caught' if failures else 'missed'
    except Exception as error:
        record.update(result='error', error=str(error))
    finally:
        path.write_bytes(original)
        record['restored'] = hashlib.sha256(path.read_bytes()).digest() == hashlib.sha256(original).digest()
    results.append(record)
    (output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(record, ensure_ascii=True), flush=True)
