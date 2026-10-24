"""0282 r2 removal/document contract checks. Run from any cwd with Python 3."""
from pathlib import Path
import re, subprocess, sys
ROOT = Path(__file__).resolve().parents[4]
PATTERN = r'OpenCodeGlobalPlugins|PluginRecordStore|OpenCodeDisabledPlugin|openCodeDisabledPlugins|setOpenCodeDisabledPlugins|globalResourceControl|insertPluginEntry|removePluginEntry|SetGlobalNativeResourceResult|opencode-restart|openCodeSessions|reconcilePlugins|OpenCodeGlobalPluginControl|OpenCodePluginRecordStore|rendererSettings|jsonc-parser|openCodeGlobalWatch\?\.drain|confirmed\?: true|confirmed: z\.literal|request\.confirmed|globalWatch\.change|change\(action|restartTitle|restartBody|restartConfirm'
PATHS = ['app/src', 'app/package.json', 'app/package-lock.json', 'docs/TRD.md', 'docs/IPC_CONTRACT.md', 'docs/arch', 'app/AGENTS.md']
COMMANDS = [
    ['rg', '-n', PATTERN, *PATHS, '-g', '!*.test.ts', '-g', '!*.test.tsx'],
    ['rg', '-n', 'nativeFileMutations', 'app/src/main/adapters/opencode'],
    ['rg', '-n', r'revalidate|composerAgentCache|ComposerAgentCache', 'app/src/main/app/composer-catalog-owner.ts', 'app/src/main/app/handlers/composer-catalog.ts', 'app/src/shared/composer-catalog.ts', 'app/src/renderer/src/features/chat/harnesses/opencode/composer', '-g', '!*.test.ts'],
]
DOCS = {
    'docs/IPC_CONTRACT.md': [
        '`orca:extensions:opencode-plugins-changed`', '`{ revision: number }`',
        '더 큰 revision만 agents를 비우며',
        '명시한 전역 선택. main 전용 setter로 저장·복원, 일반 renderer patch 제외',
        '앱 재시작 뒤에도 유지하며 native 설정 파일은 쓰지 않는다.'
    ],
    'docs/arch/backend/adapters.md': [
        'Zustand vanilla store가 앱 수명 동안 전용 전역 이벤트를 구독하며',
        '미지정 항목은 native 기본값을 따르고 명시 선택만 `Settings.nativeExtensionChoices`에 저장한다.',
        '설정 버전 업그레이드 시 예전 선택을 한 번 비우고 이후 저장값은 재시작에도 유지한다.',
        'OpenCode plugin은 사용자 전역 설정의 실효 `plugin` 배열을 읽기 전용으로 표시한다.'
    ],
    'docs/arch/frontend/state.md': ['composerAgentStore`(Zustand vanilla)', '화면이 없어도 무효화된다.']
}
def missing_docs(content):
    return [(file, phrase) for file, phrases in DOCS.items() for phrase in phrases if phrase not in content[file]]
def main():
    for args in COMMANDS:
        run = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
        assert run.returncode == 1 and not run.stdout, (args, run.stdout, run.stderr)
    content = {file: (ROOT / file).read_text(encoding='utf-8') for file in DOCS}
    assert not missing_docs(content)
    # Each documentary clause must independently make this proxy fail when deleted.
    selected = [(file, phrase) for file, phrases in DOCS.items() for phrase in phrases]
    killed = []
    for file, phrase in selected:
        mutant = {**content, file: content[file].replace(phrase, '')}
        assert (file, phrase) in missing_docs(mutant)
        killed.append((file, phrase))
    assert set(selected) - set(killed) == set()
    # Removed-route and import predicates have positive controls as well as the real zero scan.
    assert re.search(COMMANDS[2][2], 'revalidate(revision: number): void {}')
    assert re.search(COMMANDS[1][2], 'import { nativeFileMutations } from "./file-mutation"')
    assert re.search(PATTERN, 'globalResourceControl: createOpenCodeGlobalPlugins')
    print(f'removal/owner matches=0; document clauses={len(selected)}; deletion-sensitive={len(killed)}; missing=[]')
if __name__ == '__main__':
    main()
