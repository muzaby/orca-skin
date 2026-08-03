// 한국어 UI 카탈로그 — i18n SSOT(0096). 키 구조가 곧 타입(`i18next.d.ts` 가 typeof ko 로
// t() 키를 강제). en.ts 는 `typeof ko` 로 선언해 양방향 키 패리티를 컴파일 타임에 보장한다.
// 값은 기존 하드코딩 문자열을 그대로 옮긴 것 — ko 표시 결과는 마이그레이션 전후 동일해야 한다.

export const ko = {
  common: {
    cancel: '취소',
    save: '저장',
    close: '닫기',
    unlimited: '무제한',
    unknown: '알 수 없음',
    confirm: '확인',
    delete: '삭제',
    edit: '편집',
    rename: '이름 변경',
    pin: '고정',
    unpin: '고정 해제',
    expand: '펼치기',
    collapse: '접기',
    more: '더 보기',
    copied: '복사됨',
    copy: '복사',
    copyMessage: '메시지 복사',
    copyCode: '코드 복사',
    editTitle: '제목 편집',
    newChat: '새 대화',
    running: '실행 중',
    stop: '중단',
    add: '추가',
    create: '만들기',
    count: '{{count}}개',
    loading: '불러오는 중…',
    description: '설명',
    noDescription: '설명이 없습니다.',
    menu: '메뉴'
  },
  boot: {
    label: '부팅',
    preparingSr: '앱을 준비 중입니다',
    errorTitle: '앱 준비 중 문제가 발생했습니다.',
    retry: '부트 다시 시도'
  },
  landing: {
    newChatGreeting: '무엇을 도와드릴까요?'
  },
  markdown: {
    imagePlaceholder: '[이미지: {{label}}]'
  },
  nav: {
    chat: '01 채팅',
    projects: '02 프로젝트',
    projectsBreadcrumb: '프로젝트',
    engine: '03 엔진 & 모델',
    engineBreadcrumb: '설정 · 엔진 & 모델',
    plugins: '04 플러그인',
    pluginsBreadcrumb: '설정 · 플러그인',
    captures: '05 캡처 히스토리',
    capturesBreadcrumb: '캡처 히스토리'
  },
  search: {
    placeholder: '대화 내용 검색…',
    inputAria: '대화 검색',
    typeToSearch: '검색어를 입력하세요',
    noMatches: '일치하는 메시지가 없습니다',
    noTitle: '제목 없음'
  },
  sessions: {
    deleteDialogTitle: '대화 삭제',
    deleteDialogMessage: '이 대화를 삭제하시겠습니까?',
    menuAria: '세션 메뉴',
    renameAria: '세션 제목 편집',
    empty: '아직 저장된 대화가 없습니다.',
    projectEmpty: '아직 이 프로젝트에 속한 대화가 없습니다. 위 입력창에서 첫 메시지를 보내보세요.'
  },
  window: {
    minimize: '최소화',
    maximize: '최대화',
    close: '창 닫기'
  },
  captures: {
    title: '캡처 히스토리 & AI 분석',
    body: '준비 중입니다. 캡처 RAW 보관, 채널별 메트릭, ColorChecker / SFR / ΔE 자동 분석, Claude의 분석 코멘트는 다음 단계에서 제공됩니다.'
  },
  skills: {
    pageTitle: '플러그인',
    rail: { skills: '스킬', mcp: 'MCP', plugins: '플러그인' },
    list: {
      addAria: '추가'
    },
    table: {
      skill: '스킬',
      mcp: 'MCP 서버',
      plugin: '플러그인 패키지',
      lastUpdated: '마지막 업데이트',
      author: '작성자',
      status: '상태',
      transport: '전송 방식',
      user: '사용자',
      providers: '인증 제공자',
      connectors: '커넥터',
      connected: '연결됨',
      noSkills: '등록된 스킬이 없습니다.',
      noMcp: '등록된 MCP 서버가 없습니다.',
      noPlugins: '등록된 플러그인 패키지가 없습니다.'
    },
    groups: {
      activeMcp: '활성 MCP',
      inactiveMcp: '비활성 MCP',
      connectedPlugins: '연결된 플러그인 패키지',
      disconnectedPlugins: '연결되지 않은 플러그인 패키지'
    },
    view: { selectItem: '항목을 선택하세요.', backAria: '{{section}} 목록으로 돌아가기' },
    templates: {
      confluence: 'Confluence (Data Center)'
    },
    instance: {
      title: '서버 추가',
      pickTemplate: '어떤 서비스를 추가할까요?',
      noTemplate: '추가할 수 있는 서비스가 없습니다.',
      label: '표시 이름',
      labelPlaceholder: '예: 사내 위키',
      baseUrl: '서버 주소',
      baseUrlHint: '주소는 만든 뒤 바꿀 수 없습니다. 바꾸려면 삭제 후 다시 추가하세요.',
      apiBasePath: '컨텍스트 경로 (선택)',
      apiBasePathHint: '주소 뒤에 경로가 붙는 배포에만 입력합니다. 예: /confluence',
      create: '추가',
      delete: '삭제',
      errTemplate: '추가할 서비스를 선택해 주세요.',
      errLabel: '표시 이름을 입력해 주세요.',
      errBaseUrl: '주소는 경로 없는 형태여야 합니다. 예: https://wiki.example.com',
      errBasePath: '컨텍스트 경로는 `/` 로 시작해야 합니다.',
      errExists: '같은 주소의 서버가 이미 있습니다.',
      errRegister: '서버를 등록하지 못했습니다.',
      errUnknown: '서버를 추가하지 못했습니다.'
    },
    connect: {
      title: '{{name}} 연결',
      server: '서버 주소',
      serverHint: '서버 주소는 설치 시 정해집니다. 바꾸려면 관리자에게 문의하세요.',
      method: '인증 방식',
      submit: '연결',
      connect: '연결',
      disconnect: '연결 해제',
      noProvider: '이 커넥터에 쓸 수 있는 인증 방식이 없습니다.',
      failInvalid: '자격증명이 거부되었습니다. 다시 입력해 주세요.',
      failUnreachable:
        '서버에 연결하지 못했습니다. 주소는 설치 설정값이므로 관리자에게 문의하세요.',
      failAlreadyConnected: '이미 연결되어 있습니다. 먼저 연결을 해제하세요.',
      failCancelled: '연결이 취소되었습니다.',
      failUnknown: '연결에 실패했습니다.'
    },
    pluginDetail: {
      providers: '인증 제공자',
      connectors: '커넥터',
      origin: '출처',
      connectedLabel: '연결됨',
      disconnectedLabel: '연결되지 않음'
    },
    detail: {
      toggleAria: '{{name}} 활성화',
      tryInChat: '채팅에서 사용해보기',
      openDefaultApp: '기본 앱에서 보기',
      showInFolder: '폴더에서 보기',
      remove: '제거',
      removing: '제거 중…',
      lastUpdated: '마지막 업데이트',
      noBody: '본문이 없습니다.',
      markdownAria: '마크다운',
      plainTextAria: '텍스트 원문',
      removeTitle: '스킬 제거',
      removeConfirmBody:
        '이 작업은 Orca 스킬 sources에서 다음 폴더를 제거합니다. 계속하려면 한 번 더 확인하세요.'
    },
    addMenu: {
      create: '스킬 만들기',
      author: '스킬 지침 작성',
      upload: '스킬 업로드'
    },
    author: {
      title: '스킬 지침 작성',
      name: '스킬 이름',
      desc: '설명',
      descPlaceholder: '최근 작업에서 주간 현황 보고서를 생성합니다.',
      instructions: '지침',
      instructionsPlaceholder:
        '최근 작업을 성과, 장애 요인, 다음 단계의 세 섹션으로 요약해 주세요...',
      saving: '저장 중…',
      failed: '스킬 생성에 실패했습니다.'
    },
    upload: {
      title: '스킬 업로드',
      dropHint: '드래그 앤 드롭하거나 클릭하여 업로드',
      requirements: '파일 요구사항',
      reqLine1: '.md 또는 .skill 파일에 YAML frontmatter와 스킬 지침을 포함합니다',
      reqLine2: '업로드한 파일은 Orca 스킬 sources에 SKILL.md로 저장됩니다',
      failed: '스킬 업로드에 실패했습니다.'
    },
    customMcp: {
      title: 'MCP 서버 추가',
      pasteHint: '단일 MCP 서버 JSON 항목을 붙여넣으면 Orca sources mcp.json에 병합합니다.',
      adding: '추가 중…',
      failed: 'MCP 추가에 실패했습니다.',
      jsonObject: 'JSON 객체를 입력하세요.',
      singleEntry: 'MCP 서버 항목은 한 개만 입력하세요.',
      nameFormat: '서버 이름은 영숫자 · _ · - 만 허용됩니다.',
      invalidConfig: '서버 설정이 올바르지 않습니다.'
    },
    mcpDetail: {
      active: '활성',
      inactive: '비활성',
      enable: '활성화',
      disable: '비활성화',
      configSummary: '설정 요약'
    },
    addServer: {
      titleAdd: 'MCP 서버 추가',
      titleEdit: 'MCP 서버 편집',
      name: '이름',
      namePlaceholder: '예: github',
      nameFormatError: '영숫자 · _ · - 만 사용할 수 있습니다.',
      bearerNote: 'Authorization: Bearer 헤더로 전송됩니다.',
      descOptional: '설명 (선택)',
      descPlaceholder: '이 서버가 제공하는 도구 설명',
      transport: '전송 방식',
      stdioOption: 'stdio (로컬 프로세스)',
      httpOption: 'HTTP (streamable)',
      command: '명령어 (command)',
      commandPlaceholder: '예: npx · python · node',
      args: '인자 (args, 한 줄에 하나)',
      authEnvName: '인증 환경변수 이름 (선택)',
      authEnvPlaceholder: '예: GITHUB_TOKEN',
      authEnvPlaceholderHttp: '예: API_TOKEN — 비워 두면 자동 생성',
      authKeyOptional: '인증키 (선택)',
      authTokenOptional: '인증 토큰 (선택)',
      keepEmptyToPreserve: '변경하지 않으려면 비워 두세요',
      encryptedNote: '안전하게 암호화 저장됩니다'
    }
  },
  projects: {
    title: '프로젝트',
    newProject: '새 프로젝트',
    blurb:
      '프로젝트는 대화를 카테고리로 묶고, 지정한 시스템 지침을 해당 프로젝트의 모든 새 대화에 자동 주입합니다.',
    noInstructions: '지침 없음',
    emptyTitle: '아직 프로젝트가 없어요',
    emptyDesc:
      '프로젝트를 만들면 관련된 대화를 한곳에 모으고, 지정한 지침이 모든 새 대화에 자동으로 적용됩니다.',
    createFirst: '첫 프로젝트 만들기',
    create: {
      title: '새 프로젝트',
      name: '이름',
      namePlaceholder: '예: cam-validation-v3',
      instructionsOptional: '지침 (선택)',
      instructionsPlaceholder:
        'Claude 의 응답을 이 프로젝트에 맞게 조정하는 지침. 예: 모든 응답을 한국어로, 코드 예시는 TypeScript 로.'
    },
    editInstructions: {
      title: '지침 편집',
      body: '<mono>{{name}}</mono> 의 모든 새 메시지에 시스템 프롬프트로 덧붙여집니다.',
      placeholder:
        '예: 모든 응답을 한국어로, 코드 예시는 TypeScript 로. 검증 엔지니어 톤으로 간결하게.'
    },
    hero: {
      pin: '고정',
      pinAria: '프로젝트 고정',
      menuAria: '프로젝트 메뉴',
      editDetails: '세부사항 수정',
      updated: '업데이트'
    },
    filesCard: {
      title: '파일',
      addTitle: '파일 추가 (준비 중)',
      emptyHint: '이 프로젝트에서 참조할 PDF, 문서, 폴더 또는 기타 텍스트를 추가하세요.'
    },
    instructionsCard: {
      title: '지침',
      editTitle: '지침 편집',
      emptyHint: '응답을 맞춤화하는 지침을 추가하세요.'
    },
    sessionsPanel: { title: '이 프로젝트의 대화' },
    landingHeader: {
      navAria: '프로젝트 탐색',
      backAria: '모든 프로젝트로 돌아가기',
      all: '모든 프로젝트'
    }
  },
  engine: {
    title: '엔진 & 모델',
    subtitle: 'provider settings 환경',
    addEngine: '엔진 추가',
    blurb:
      '<c>~/.config/orca/sources/settings</c> 의 provider settings 를 기반으로 Composer 모델 메뉴가 구성됩니다. 편집 후 앱 재시작 없이 모델 메뉴가 갱신됩니다.',
    emptyState: '등록된 provider 가 없습니다. 엔진 추가 버튼으로 claude provider 를 생성하세요.',
    deleteConfirm: '{{name}} provider 를 삭제할까요?',
    card: { unsupportedAdapter: '미지원 adapter' },
    readSettingsFailed: '설정을 불러오지 못했어요.',
    sdkDefaultModel: 'SDK 기본',
    provider: {
      anthropic: { label: 'Anthropic', desc: 'api.anthropic.com 기본' },
      bedrock: { label: 'Amazon Bedrock', desc: 'AWS 자격증명' },
      vertex: { label: 'Google Vertex AI', desc: 'GCP 프로젝트' },
      custom: { label: '직접 입력', desc: '게이트웨이 등 직접 설정' }
    },
    validation: {
      nameRequired: 'provider 이름을 입력하세요.',
      nameFormat: '영문 · 숫자 · _ · - 만 사용할 수 있습니다.',
      jsonRequired: 'settings.json 내용을 입력하세요.',
      jsonSyntaxAt:
        'JSON 형식이 올바르지 않아요 — {{line}}번째 줄, {{col}}번째 글자 부근에서 형식이 어긋났어요.',
      jsonSyntax: 'JSON 형식이 올바르지 않아요 — {{reason}}',
      jsonSyntaxUnknown: 'JSON 형식이 올바르지 않아요 — 알 수 없는 오류',
      topLevelObject: '최상위는 객체 { … } 형태여야 해요.'
    },
    form: {
      titleEdit: '엔진 설정 편집',
      titleAdd: '엔진 추가',
      provider: '공급자',
      providerName: 'Provider 이름',
      namePlaceholder: '예: my-gateway',
      nameFixedHint: '선택한 공급자 이름으로 고정됩니다. 변경하려면 ‘직접 입력’을 고르세요.',
      importTitle: '~/.claude/settings.json 의 내용으로 본문을 채웁니다.',
      importButton: '~/.claude/settings.json 불러오기',
      importNotFound: '~/.claude/settings.json 을 찾을 수 없어요.',
      importFailed: '~/.claude/settings.json 을 불러오지 못했어요.',
      saveFailed: '저장에 실패했어요.',
      jsonValid: '✓ JSON 형식이 올바릅니다.',
      envHint:
        '<c>env</c> 블록에 API 키·리전 등을 넣습니다. 비밀은 <c>{{varToken}}</c> 플레이스홀더로 두는 것을 권장합니다.',
      saving: '저장 중…',
      adding: '추가 중…',
      addAction: '추가하기'
    }
  },
  backend: {
    installed: '설치됨',
    notInstalled: '설치 필요',
    supportedTitle: '지원 기능: {{list}}',
    capability: {
      continue: '이어가기',
      resume: '재개',
      fork: '분기',
      abort: '중단',
      structuredOutput: '구조화 출력'
    },
    installer: {
      title: 'Claude Code 설치',
      cliRequired: '채팅을 사용하려면 Claude Code CLI 가 필요합니다.',
      preparing: '준비 중…',
      installing: '설치 중…',
      done: '완료',
      start: '설치 시작',
      failedPrefix: '설치 실패:',
      copyCommand: '명령 복사'
    },
    authExpired: {
      title: 'Claude Code 인증 만료',
      body: '터미널에서 아래 명령을 실행한 뒤 새 대화를 시작하세요.'
    }
  },
  update: {
    dialogTitle: 'Orca 업데이트',
    status: {
      idle: '업데이트 대기 중',
      checking: '업데이트 확인 중…',
      available: '새 업데이트가 준비되었습니다.',
      downloading: '업데이트 다운로드 중…',
      ready: '다운로드 완료. 재시작하면 설치됩니다.',
      installing: '업데이트 설치를 시작합니다…',
      error: '업데이트 오류.'
    },
    statusFallback: '업데이트 상태를 확인합니다.',
    currentVersion: '현재 버전',
    newVersion: '새 버전',
    checkingShort: '확인 중',
    progress: '다운로드 진행률',
    releaseNotes: '릴리스 노트',
    installBlockedFallback: '작업이 진행 중입니다 — 끝난 뒤 다시 시도하세요.',
    later: '나중에',
    action: {
      ready: '업데이트 후 재시작',
      downloading: '다운로드 중…',
      installing: '설치 시작 중…',
      update: '업데이트'
    },
    debug: { section: '업데이트', dummy: '더미 업데이트' }
  },
  debug: {
    title: '디버그',
    closeTweaks: 'Tweaks 닫기',
    mockMode: 'Mock 모드',
    scenario: '시나리오',
    contextUsage: '컨텍스트 사용량',
    log: '로그',
    themeSection: '테마',
    palette: '컬러 팔레트',
    layoutSection: '레이아웃',
    scenarios: {
      text_streaming: '텍스트 스트리밍',
      reasoning: '추론 블록',
      tool_calls: '도구 호출',
      tool_approval: '도구 승인',
      ask_question: '사용자 질문',
      plan_review: '계획 검토',
      subagent_task: '서브에이전트',
      subagent_task_child: '서브에이전트 child',
      subagent_task_aborted: '서브에이전트 중단',
      subagent_task_multi: '서브에이전트 복수',
      subagent_task_running: '서브에이전트 진행 중',
      error: '에러',
      full: '전체'
    }
  },
  login: {
    title: '로그인',
    authSection: '로그인',
    bypass: '로그인 우회(bypass)',
    devButton: 'SSO 개발 버튼',
    loggingIn: '로그인 중',
    authButton: '로그인'
  },
  camera: {
    title: '하드웨어 제어',
    exposure: '노출 (Exposure)',
    analogGain: '아날로그 게인',
    digitalGain: '디지털 게인',
    qualityMetrics: '품질 메트릭',
    capture: '캡처',
    sequence: '시퀀스',
    futureScopeTitle: 'v1 비대상 — Future Scope (PRD §9)'
  },
  errors: {
    category: {
      provider_connection_error: '백엔드 연결 오류',
      auth_error: '인증 오류',
      permission_denied: '권한 거부',
      tool_execution_error: '도구 실행 오류',
      stream_error: '스트림 오류',
      capability_unsupported: '지원하지 않는 기능',
      schema_validation_error: '입력 검증 오류',
      user_cancelled: '사용자 취소'
    },
    turnError: '에러: {{category}}',
    retryable: '재시도 가능',
    transientHint: '일시적 오류일 수 있습니다. 다시 보내보세요.',
    retrying: '재시도 {{attempt}}/{{max}}',
    loginFailed: '로그인에 실패했습니다. 다시 시도해 주세요.',
    updateDownloadFailed: '업데이트 다운로드를 시작할 수 없습니다.',
    updateInstallFailed: '업데이트 설치를 시작할 수 없습니다.',
    agentListFailed: 'agent 목록을 불러오지 못했습니다',
    engineMutationFailed: 'engine 작업에 실패했습니다'
  },
  notify: {
    completeBody: '응답이 완료되었습니다.'
  },
  chat: {
    // 예약 steer 가 stdin 으로 넘어가 취소 불가가 된 상태 표시(0151).
    steer: {
      submitted: '전달됨',
      residualTitle: '중단했지만 대기 중인 메시지가 남아 있습니다',
      residualBody:
        '이미 전달된 메시지 {{count}}건이 곧 실행될 수 있습니다. 지금 완전히 멈추려면 세션을 중단하세요 — 실행 중인 백그라운드 작업도 함께 종료됩니다.',
      residualAction: '세션 전체 중단'
    },
    titleBar: {
      renameAria: '대화 제목 편집',
      copyAll: '전체 대화 복사',
      tilesButton: '우측 패널 타일',
      tilesHeader: '타일 표시',
      roleUser: '사용자'
    },
    transcript: {
      reasoning: '사고 과정',
      structuredOutput: '구조화 출력',
      incompleteResponse: '응답이 완료되지 않았습니다',
      loading: '대화 불러오는 중…',
      emptyPrompt: 'Claude Code 에 첫 메시지를 보내보세요.',
      lineageFork: '이 세션은 <hl>‘{{label}}’</hl>에서 분기되었습니다',
      lineageHandoff: '이 세션은 <hl>‘{{label}}’</hl>에서 핸드오프로 이어졌습니다',
      openParent: '원본 열기',
      openParentTitle: '원본 세션 열기',
      forkBoundary: '분기된 지점',
      compactAuto: '자동 압축됨',
      compactManual: '이전 대화 압축됨',
      compactTokensRange: '{{pre}} → {{post}} 토큰',
      compactTokensCompressed: '{{pre}} 토큰 압축',
      forkHere: '여기서 분기'
    },
    toolMeta: {
      verb: {
        ran: '실행됨',
        created: '업데이트됨',
        edited: '수정됨',
        read: '읽음',
        used: '사용함',
        planned: '제안된 계획',
        requested: '요청됨',
        delegated: '실행됨'
      },
      verbActive: {
        ran: '실행 중',
        created: '업데이트 중',
        edited: '수정 중',
        read: '읽는 중',
        used: '사용 중',
        planned: '계획 제안 중',
        requested: '질문 중',
        delegated: '실행 중'
      },
      aborted: '중단됨',
      planDescription: '제안된 계획',
      unit: {
        command_one: '명령 {{count}}개',
        command_other: '명령 {{count}}개',
        file_one: '파일 {{count}}개',
        file_other: '파일 {{count}}개',
        tool_one: '도구 {{count}}개',
        tool_other: '도구 {{count}}개',
        question_one: '질문 {{count}}개',
        question_other: '질문 {{count}}개',
        agent_one: '에이전트 {{count}}개',
        agent_other: '에이전트 {{count}}개'
      },
      runningAgents_one: '실행 중 에이전트 {{count}}개',
      runningAgents_other: '실행 중 에이전트 {{count}}개',
      toolUses_one: '{{count}} 도구 사용',
      toolUses_other: '{{count}} 도구 사용',
      durationSec: '{{s}}초',
      durationMinSec: '{{m}}분 {{s}}초',
      tokens: '{{n}} 토큰',
      tokensK: '{{n}}k 토큰',
      agentFallback: '에이전트',
      agentStatus: {
        running: '에이전트 실행 중',
        completed: '에이전트 완료',
        aborted: '에이전트 중단됨',
        failed: '에이전트 실패'
      },
      subagentHeading: '서브에이전트',
      subagentTypeLine: '유형: {{type}}',
      openSubagentPanel: '서브에이전트 패널 열기'
    },
    subagentNotice: {
      completed: '백그라운드 작업 완료',
      failed: '백그라운드 작업 실패',
      stopped: '백그라운드 작업 중단됨',
      agentLine: 'Agent "{{title}}" {{verb}}',
      took: '{{duration}} 소요됨'
    },
    subagentTile: {
      status: {
        running: '진행 중',
        completed: '완료',
        failed: '실패',
        aborted: '중단됨'
      },
      backToList: '목록으로',
      headerTitle: '백그라운드 작업',
      noChildActivity: '이 작업에 기록된 하위 활동이 없습니다.',
      emptyTitle: '백그라운드 작업이 없습니다',
      emptyDesc: 'Task 도구 호출이 감지되면 여기에 표시됩니다.',
      openTranscriptAria: '{{description}} 대화록 보기',
      viewTranscript: '대화록 보기'
    },
    composer: {
      modes: {
        plan: {
          label: '계획',
          desc: '읽기 전용 — 코드를 탐색·분석하고 계획만 세웁니다 (편집 없음).'
        },
        default: { label: '기본', desc: '표준 동작 — 위험한 작업은 그때그때 확인을 요청합니다.' },
        accept_edits: {
          label: '편집 수락',
          desc: '파일 편집을 자동으로 수락합니다 (확인 없이 적용).'
        },
        auto_classified: {
          label: '자동 분류',
          desc: '모델이 위험도를 분류해 안전한 작업을 자동 승인합니다.'
        },
        dont_ask: {
          label: '묻지 않음',
          desc: 'Orca 승인 질문을 만들지 않고 기본 자동 진행 정책을 따릅니다.'
        },
        bypass: {
          label: '권한 우회',
          desc: '샌드박스/승인 권한 검사를 최대한 건너뜁니다 — 매우 위험.'
        },
        riskyConfirm: '모든 승인 게이트가 해제됩니다. 한 번 더 눌러 확인하세요.'
      },
      effort: {
        low: { label: '낮음', desc: '빠른 응답을 우선합니다.' },
        medium: { label: '중간', desc: '속도와 사고 깊이를 균형 있게 사용합니다.' },
        high: { label: '높음', desc: '기본값. 충분한 사고 깊이로 작업합니다.' },
        xhigh: { label: '매우 높음', desc: '복잡한 작업에 더 깊게 사고합니다.' },
        max: { label: '최대', desc: '가장 깊은 사고 예산을 사용합니다.' }
      },
      handoffNoSession: '핸드오프할 세션이 없습니다',
      handoffWaitTurn: '응답 완료 후 시도하세요',
      handoffNeedMoreTurns: '대화가 더 진행된 뒤 사용할 수 있습니다',
      scrollToBottom: '맨 아래로',
      concurrencyNoticeTitle: '같은 프로젝트에서 다른 작업이 실행 중입니다.',
      concurrencyNoticeBody:
        '파일 충돌 가능성이 있습니다. Orca는 작업을 차단하지 않으며, 동시 실행 여부는 사용자가 판단합니다.',
      queuedNoticeTitle: '연결 대기 중입니다.',
      queuedNoticeBody: '이전 새 대화의 세션이 준비되는 대로 이 메시지를 순서대로 전송합니다.',
      backendTitle: '백엔드: {{label}}',
      placeholderFeedback: '피드백 보내기… (Enter 전송 / Shift+Enter 줄바꿈)',
      placeholderProviderBoundary:
        '다른 공급자 모델이 선택되어 있습니다 — 응답 완료 후 전송할 수 있습니다',
      placeholderIdle: '스킬을 보려면 /를 입력하세요.',
      inputAria: '메시지 입력',
      abortUnsupported: '이 백엔드는 중단을 지원하지 않습니다',
      sendFeedback: '피드백 보내기',
      sendFeedbackEnter: '피드백 보내기 (Enter)',
      send: '전송',
      sendEnter: '전송 (Enter)',
      permissionModeTitle: '권한 모드',
      attachMenuTitle: '추가 메뉴',
      modelSelectTitle: '모델 선택',
      modelFallback: '모델',
      effortTitle: '작업량',
      contextTitle: '컨텍스트 ~{{used}}k / {{window}}k 토큰 · 사용량 보기',
      contextLimitNear: '컨텍스트 한계 임박',
      contextUsageAria: '컨텍스트 사용량: {{pct}}%',
      attach: '첨부',
      attachRemoveAria: '{{name}} 첨부 제거',
      fileAutocompleteAria: '파일 경로 자동완성',
      loadingShort: '로딩 중…',
      noMatches: '일치하는 항목 없음',
      skillAutocompleteAria: '스킬 자동완성',
      noModels: '사용 가능한 모델이 없습니다.',
      sdkDefaultModel: 'SDK 기본',
      cwdOpenAria: '작업 폴더 열기',
      cwdSelectAria: '작업 폴더 선택'
    },
    status: {
      warn: {
        pill: '대화가 꽤 길어졌어요',
        detail: '자세히',
        title: '대화가 길어지고 있어요',
        description: '이대로 계속해도 되지만, 가볍게 정리하면 더 매끄럽게 이어갈 수 있어요.',
        length: '긴 편이에요',
        actionButton: '대화 가볍게 요약하기'
      },
      danger: {
        pill: '대화가 아주 길어졌어요 — 정리가 필요해요',
        detail: '자세히',
        title: '대화가 아주 길어요',
        description:
          '요약본을 이어받는 새 세션(핸드오프)으로 넘어가는 편이 좋아요. 지금까지 내용은 그대로 남아요.',
        length: '아주 길어요',
        actionButton: '핸드오프로 이어가기'
      },
      lengthLabel: '대화 길이',
      lengthValue: '{{used}}k/{{window}}k {{pct}}%',
      sessionCostLabel: '이 세션에서 사용한 비용',
      sessionCostValue: '약 ${{usd}}',
      costDisclaimer: '표시된 비용은 예상치예요. 실제와 조금 다를 수 있어요.',
      handoffHint: '요약본으로 새 세션에서 이어갑니다',
      compactHint: '현재 세션의 대화 기록을 압축합니다'
    },
    approval: {
      toolAria: '도구 실행 승인',
      toolRequest: 'Claude가 {{tool}} 실행 권한을 요청합니다',
      deny: '거부',
      allowSessionTitle: '이 세션 동안 같은 도구를 자동 허용',
      allowSession: '세션 동안 허용',
      allow: '허용',
      planAria: '계획 승인',
      planProposed: 'Claude가 계획을 제안했습니다',
      openPlan: '플랜 열기',
      commentEditTitle: '코멘트 편집',
      commentDelete: '코멘트 삭제',
      revisePlaceholder: '더 추가할 내용이 있으신가요?',
      reviseInputAria: '수정 제안 내용',
      reviseFirst: '수정 제안 내용을 먼저 입력하세요',
      reviseOpen: '수정…',
      reviseBack: '뒤로',
      revise: '수정',
      accept: '수락'
    },
    ask: {
      aria: '명확화 질문',
      multiSelect: '여러 개 선택 가능',
      prevQuestion: '이전 질문',
      nextQuestion: '다음 질문',
      skip: '건너뛰기',
      otherPlaceholder: '기타 — 직접 입력…',
      otherInputAria: '{{header}} 기타 직접 입력',
      submit: '제출',
      next: '다음'
    },
    rightpanel: {
      tiles: {
        plan: '계획',
        subagent: '백그라운드 작업',
        reserved1: '예약 1',
        reserved2: '예약 2'
      },
      closeTile: '{{label}} 닫기',
      panelResizeAria: '우측 패널 크기 조절',
      rowResizeAria: '패널 행 크기 조절',
      colResizeAria: '패널 열 크기 조절',
      planCopy: '플랜 복사',
      planEmptyTitle: '아직 플랜이 없습니다',
      planEmptyDesc: 'Claude 가 탐색하며 계획을 세우면 여기에 표시됩니다.',
      planSelectHint: '텍스트를 선택해 Claude에게 의견을 남기세요',
      reservedTitle: '예약된 타일입니다',
      reservedDesc: '이 영역은 다음 보조 패널 기능을 위해 비워두었습니다.',
      commentViewAria: '코멘트 보기',
      commentCreateAria: '코멘트 작성: {{quote}}',
      commentEditAria: '코멘트 편집: {{quote}}',
      commentPlaceholder: '코멘트 추가…',
      commentInputAria: '코멘트 내용',
      commentSubmit: '댓글'
    }
  },
  sidebar: {
    nav: {
      newChat: '새 대화',
      projects: '프로젝트',
      engine: '엔진 & 모델',
      plugins: '플러그인'
    },
    recents: '최근 대화',
    pinned: '고정됨',
    resizeAria: '사이드바 폭 조절'
  },
  userMenu: {
    settings: '설정',
    language: '언어',
    displayLanguage: '앱 표시 언어'
  },
  header: {
    systemMenu: '시스템 메뉴',
    collapseSidebar: '사이드바 접기',
    search: '검색',
    back: '뒤로 가기',
    forward: '앞으로 가기',
    update: '업데이트',
    version: '버전',
    quit: '종료',
    versionModalAria: 'Orca 버전'
  },
  settings: {
    title: '설정',
    tabs: {
      general: '일반',
      usage: '사용량'
    },
    providerNotFound: 'provider 를 찾을 수 없습니다.',
    general: {
      profile: '프로필',
      accountInstructions: '계정 지침',
      accountInstructionsDesc:
        '모든 대화에 적용되는 지침입니다. 저장 후 영속되며, 시스템 프롬프트 배선은 추후 제공됩니다.',
      accountPlaceholder: '예: 자세한 설명을 하기 전에 질문을 해주세요.',
      preferences: '환경설정',
      appearance: '모양',
      appearanceDesc: '앱 색상 테마',
      themeWhite: '화이트',
      themeDark: '다크',
      font: '폰트',
      fontDesc: '앱 전체에 적용되는 글꼴',
      fontSans: '산세리프 (Inter)',
      fontSerif: '세리프 (Source Serif)',
      fontMono: '모노 (JetBrains Mono)',
      language: '언어',
      languageDesc: '앱 UI 와 날짜 표기에 적용되는 표시 언어',
      density: '밀도',
      densityDesc: '앱 전체 여백과 글자 크기 밀도',
      densityCompact: '조밀',
      densityNormal: '보통',
      densityComfortable: '넓게',
      notifications: '알림',
      notifyComplete: '응답 완료',
      notifyCompleteDesc: 'Agent가 응답을 완료하면 알림을 받습니다. (앱 창이 비활성일 때만 표시)',
      notifyCompleteToggle: '응답 완료 알림',
      updates: '업데이트',
      updateAuto: '자동 확인',
      updateAutoDesc:
        '앱을 켜 둔 동안 주기적으로 새 버전을 확인합니다. (앱 시작 시 확인은 항상 수행)',
      updateAutoToggle: '자동 업데이트 확인',
      updateInterval: '확인 주기',
      updateIntervalDesc: '앱 시작 시각을 기준으로 이 간격마다 확인합니다.',
      // 한국어는 복수 구분이 없어 실제로는 _other 만 쓰이지만, 카탈로그 키 패리티를 위해 둘 다 둔다.
      updateIntervalEvery_one: '1시간마다',
      updateIntervalEvery_other: '{{count}}시간마다'
    },
    usage: {
      title: '사용량 요약',
      desc: '기간별 토큰 사용량(입력·출력·캐시)과 모델별 내역을 보여줍니다. provider별 사용량 한도는 좌측 하위 항목에서 확인할 수 있습니다.',
      range7d: '최근 7일',
      range30d: '최근 30일',
      rangeAll: '전체',
      totalTokens: '총 토큰',
      totalCost: '총 비용',
      dailyTokens: '일별 토큰',
      byModel: '모델별 사용량',
      chartAria: '일별 토큰 사용량 차트',
      weeklyNote: '90일이 넘는 기간은 주 단위 합산으로 표시됩니다.',
      modelBreakdown: '입력 {{input}} · 출력 {{output}} · 캐시 {{cache}} · {{cost}}',
      empty: '아직 사용량이 없습니다',
      emptyDesc: '대화를 시작하면 토큰 사용량이 여기에 집계됩니다.'
    }
  },
  time: {
    justNow: '방금',
    minutesAgo_one: '{{count}}분 전',
    minutesAgo_other: '{{count}}분 전',
    hoursAgo_one: '{{count}}시간 전',
    hoursAgo_other: '{{count}}시간 전',
    daysAgo_one: '{{count}}일 전',
    daysAgo_other: '{{count}}일 전',
    yesterday: '어제',
    resetsWeek: '({{weekday}}) 오전 0:00에 재설정',
    resetsMonth: '({{weekday}}) {{date}}에 재설정'
  },
  usage: {
    weekly: '주간',
    monthly: '월간',
    pctUsed: '{{pct}}% 사용됨',
    loading: '사용량 정보를 불러오는 중입니다…',
    lastUpdated: '마지막 업데이트',
    refreshAria: '사용량 새로고침',
    usageLimit: '사용량 한도',
    limitSettings: '한도 설정',
    monthlyLimit: '월간 사용 한도',
    monthlyLimitDesc: '이 provider 의 월 지출 한도를 설정합니다',
    setLimitTitle: '{{provider}} 월간 지출 한도 설정',
    setLimitDesc: '월별 지출 한도를 설정하세요.',
    limitInputAria: '월간 지출 한도 (USD)',
    appliesImmediately: '이 지출 한도는 즉시 적용됩니다.',
    setUnlimited: '무제한으로 설정',
    setLimit: '지출 한도 설정',
    backToUsage: '사용량',
    contextWindow: '컨텍스트 창',
    openUsageSettingsAria: '사용량 한도 설정 열기'
  }
}
