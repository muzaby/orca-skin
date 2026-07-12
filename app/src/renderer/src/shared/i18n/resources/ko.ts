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
    rename: '이름 변경',
    more: '더 보기',
    copied: '복사됨',
    copy: '복사',
    copyMessage: '메시지 복사',
    copyCode: '코드 복사',
    editTitle: '제목 편집',
    newChat: '새 대화',
    running: '실행 중',
    stop: '중단'
  },
  nav: {
    chat: '01 채팅',
    projects: '02 프로젝트',
    projectsBreadcrumb: '프로젝트',
    engine: '03 엔진 & 모델',
    engineBreadcrumb: '설정 · 엔진 & 모델',
    skills: '04 Skills / MCP',
    skillsBreadcrumb: '설정 · Skills & MCP',
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
    renameAria: '세션 제목 편집'
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
    titleBar: {
      renameAria: '대화 제목 편집',
      copyAll: '전체 대화 복사',
      tilesButton: '우측 패널 타일',
      tilesHeader: '타일 표시',
      roleUser: '사용자'
    },
    transcript: {
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
        usage: '보통보다 조금 많아요',
        actionButton: '대화 가볍게 요약하기',
        disclaimer: '표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.'
      },
      danger: {
        pill: '대화가 아주 길어졌어요 — 정리가 필요해요',
        detail: '자세히',
        title: '대화가 아주 길어요',
        description:
          '요약본을 이어받는 새 세션(핸드오프)으로 넘어가는 편이 좋아요. 지금까지 내용은 그대로 남아요.',
        length: '아주 길어요',
        usage: '많은 편이에요',
        actionButton: '핸드오프로 이어가기',
        disclaimer: '표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.'
      },
      lengthLabel: '대화 길이',
      usageTodayLabel: '오늘 사용량',
      costTodayLabel: '오늘 비용',
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
      skills: 'Skills & MCP'
    },
    recents: '최근 대화',
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
      scheduling: '주기적 실행',
      usageRecompute: '사용량 새로고침',
      usageRecomputeDesc: '앱이 실행 중일 때만 저장된 주기에 따라 사용량 집계를 다시 계산합니다.',
      usageRecomputeToggle: '주기적 사용량 새로고침',
      refreshInterval: '새로고침 주기',
      refreshIntervalDesc: 'cron 표현식 또는 기본 프리셋을 선택하세요.',
      presetHourly: '매시간',
      preset30m: '30분마다',
      presetDaily9: '매일 오전 9시',
      presetCustom: '직접 입력',
      cronAria: '사용량 새로고침 cron',
      notifications: '알림',
      notifyComplete: '응답 완료',
      notifyCompleteDesc: 'Agent가 응답을 완료하면 알림을 받습니다. (앱 창이 비활성일 때만 표시)',
      notifyCompleteToggle: '응답 완료 알림'
    },
    usage: {
      title: '사용량 요약',
      descPrefix: 'Claude Code 의 ',
      descSuffix:
        ' 처럼 총 사용 비용, 토큰 사용량(입력·출력·캐시), 모델별 내역을 한눈에 볼 수 있는 요약을 제공할 예정입니다.',
      comingSoon: '추후 구현 예정',
      comingSoonDesc:
        'provider별 사용량 한도와 지출 한도 설정은 좌측 하위 항목에서 확인할 수 있습니다.'
    }
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
