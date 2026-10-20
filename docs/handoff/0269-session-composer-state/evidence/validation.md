# 구현자 검증 — 세션 모델·기본 승인·CI 복구

기준4766e080 rebase. 원래 Windows 실패는 [CI39430032928](https://github.com/muzaby/orca-skin/actions/runs/39430032928), job118652368909다. Test에서21실패/15파일이며 lint/typecheck는 통과했다. gh CLI 조회는403이고 GitHub connector로 실제 로그를 읽었다.

## 로컬 최종

app cwd. SQLite는 Electron ABI140이며 host Node는137이므로 ABI 변경 없이 다음을 사용했다.

```sh
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs run --maxWorkers=2 --exclude src/main/infra/git/git-safety.test.ts --reporter=dot
npx vitest run src/main/infra/git/git-safety.test.ts --reporter=dot
node --test scripts/*.test.mjs
npm run typecheck
npx eslint --cache ./src ./scripts
npx electron-vite build
node scripts/check-doc-inventory.mjs --check
node scripts/check-migrations-appendonly.mjs
node scripts/check-test-budgets.mjs
python3 ../docs/handoff/0266-renderer-design-guidelines/evidence/check-design-docs.py
```

전체785파일7664 통과·2파일7케이스 skip(179.37초), 별도 Node Git1파일2/2. scripts142/142·16suite. 타입3종 진단0, lint 오류0/기존경고4, build main/preload/renderer 성공. 문서 generated/prose/links, migration sync/no-copies, test budgets16, catalog295/295·양방향 차집합[]·음성 대조 통과. 기존 태그가 없어 migration append-only 이력 대조는 스크립트가 skip으로 보고했다.

초기 전체는 새 modelFamily DTO·migration 목록·Composer 호출 수의 옛 기대6건과 Electron 복사 바이너리의 libffmpeg1건이 실패했다. 기대를 정정하고 Git 시험은 Node로 분리했다. 변경 후 reader/DB upgrade/실제 session handler·canonical roots/Composer 집중6파일23/23도 확인했다. 초기 realpath overload 타입과 두 함수 반환 타입은 명시해 최종 타입/lint를 다시 확인했다.

## 원래 CI 실패15파일

- main: skill-catalog, opencode adapter.persistent/native-resources/plugin-installation, POP3 native-boundary.
- renderer: NewChatLandingPage.harness, projectDeletionWiring, useSidebarSlots, reportSites.registry, ChatTitleBar.layout/native-resources, useMentionAutocomplete, rightPanelTiles.harness, chatReducer.panelPolicy, ArtifactViewer.actions.

최종15파일346/346. Linux에서는17실패를 재현했고, Windows만의 canonical temp path 비교3건과 agents junction 제외1건은 실제 CI 로그로 확인했다. agents 제외 root·OpenCode skill roots를 canonicalize하고 plugin directory의 canonical 결과와 fixture를 일치시켰다. alias root의 실제 junction/symlink 분류·형제 제외도 검사했다.

## 새 기능과 적대 대조

- last-model.test는 실제 SQLite 파일에 서로 다른 A/B 모델을 기록하고 close/reopen한다. 정확한 provider/model과 [1m], 후속 provider/model 교체, 미소비 재개/제목 모델 제외, 기존 DB의 메시지/제목 보존을 확인했다.
- turn-context는 실제 model과 title model을 구별하며 continuation을 확인한다. reducer·실제 Composer는 provider default Opus와 저장 Sonnet[1m]을 구별해 A→B→A·fresh store 표시·alias와 자동 승인을 확인한다. 명시 수동/계획/bypass·미지원/미정·OpenCode는 회귀로 검사했다.
- M1 새 alias hydration setModel의 modelFamily/model.alias 맞바꿈: Composer.selection과 composerWiring에서 총2failed/7. 원본 bytes 복원 뒤7/7. port allocator 경계 fixture는 net에서 offenders[], tls에서 정확히 해당 파일1개다.

## Chromium

실제 production Composer/chatStore/reducer와 메모리 session load IPC를 사용했다. DB 재시작은 위 실제 파일 시험과 별개다.1440×900 white에서 확인한 결과:

```json
{"observations":[{"session":"A","model":"claude-sonnet-4-6[1m]","permission":"auto_classified","label":"team/claude-sonnet-4-6[1m]","auto":true},{"session":"B","model":"claude-opus-4-6","permission":"auto_classified","label":"team/claude-opus-4-6","auto":true},{"session":"A","model":"claude-sonnet-4-6[1m]","permission":"auto_classified","label":"team/claude-sonnet-4-6[1m]","auto":true}],"freshStoreModel":"claude-sonnet-4-6[1m]","manualSurvivesModelChange":true,"exceptions":[]}
```

Windows 설치 앱 GUI·외부 모델 API는 실기하지 않았다. 새 Windows CI는 코드 push 뒤 확인한다.
