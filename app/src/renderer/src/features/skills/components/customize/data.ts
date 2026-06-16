import type { IconName } from '../../../../shared/ui/Icon'

// 맞춤설정(Skills & MCP) 화면의 정적 스킨 데이터. Orca 검증 엔지니어 도메인으로 치환한
// 시드 — 백엔드/IPC 없음. 뷰는 이 상수로 로컬 useState 를 초기화하고, 추가 플로우는
// 메모리상 append 한다(새로고침 시 초기화).

export interface SkillItem {
  id: string
  name: string
  desc: string
  enabled: boolean
  // 우측 상세 메타.
  addedBy: string
  updatedAt: string
  trigger: string
  version: string
  triggers: string
  body: string
}

export type ConnectorGroup = 'local' | 'hardware' | 'disconnected'

export interface ConnectorItem {
  id: string
  name: string
  icon: IconName
  transport: string
  desc: string
  group: ConnectorGroup
  badge?: string
  bullets: string[]
}

export const CONNECTOR_GROUP_LABEL: Record<ConnectorGroup, string> = {
  local: '로컬',
  hardware: '하드웨어',
  disconnected: '연결되지 않음'
}

export const SEED_SKILLS: SkillItem[] = [
  {
    id: 'bayer-analysis',
    name: 'bayer-analysis',
    desc: 'RAW 프레임을 채널별로 분리하고 SNR/DR 계산',
    enabled: true,
    addedBy: '로컬 (~/.claude/skills)',
    updatedAt: '2026년 5월 28일',
    trigger: '슬래시 명령어 + 자동',
    version: '1.4.0',
    triggers: 'bayer split,snr,dynamic range,raw 분석',
    body: 'RAW Bayer 프레임을 R/Gr/Gb/B 채널로 분리해 채널별 평균·표준편차에서 SNR 과 동적 범위(DR)를 계산합니다. 노출 sweep 결과를 입력하면 광량-응답 곡선과 포화 지점을 함께 보고합니다.\n\n캡처 시퀀스 디렉토리를 가리키거나 "/bayer-analysis" 로 호출하세요. 결과는 채널별 표 + 요약 지표로 제시됩니다.'
  },
  {
    id: 'mtf-sfr',
    name: 'mtf-sfr',
    desc: 'Slanted-edge MTF / SFR 계산 (ISO 12233)',
    enabled: true,
    addedBy: '로컬 (~/.claude/skills)',
    updatedAt: '2026년 5월 12일',
    trigger: '슬래시 명령어 + 자동',
    version: '2.0.1',
    triggers: 'mtf,sfr,sharpness,iso 12233,해상력',
    body: 'ISO 12233 slanted-edge 방식으로 SFR(공간 주파수 응답)과 MTF50 을 계산합니다. ROI 를 지정하면 가장자리 각도 추정 → ESF → LSF → MTF 파이프라인을 자동 수행합니다.\n\n중심/주변부 ROI 를 함께 주면 필드 위치별 해상력 저하를 비교 보고합니다.'
  },
  {
    id: 'capture-batch',
    name: 'capture-batch',
    desc: '시퀀스 캡처 헬퍼 (노출 sweep, gain sweep)',
    enabled: true,
    addedBy: '로컬 (~/.claude/skills)',
    updatedAt: '2026년 6월 3일',
    trigger: '슬래시 명령어',
    version: '0.9.2',
    triggers: 'capture,노출 sweep,gain sweep,시퀀스 캡처',
    body: '보드 제어 MCP 와 연동해 노출/게인 sweep 시퀀스를 자동 캡처합니다. 시작·끝·스텝을 지정하면 프레임을 순차 저장하고 메타(노출/게인/타임스탬프)를 사이드카로 남깁니다.\n\n캡처 후 bayer-analysis · mtf-sfr 로 바로 이어지도록 출력 경로를 표준화합니다.'
  },
  {
    id: 'flat-field',
    name: 'flat-field',
    desc: 'Flat field 보정 / vignetting 분석',
    enabled: false,
    addedBy: '로컬 (~/.claude/skills)',
    updatedAt: '2026년 4월 20일',
    trigger: '슬래시 명령어',
    version: '0.5.0',
    triggers: 'flat field,vignetting,shading,균일도',
    body: 'Flat field 프레임으로 렌즈 셰이딩/비네팅을 추정하고 보정 게인 맵을 산출합니다. 코너 대비 중심 밝기비로 균일도(%)를 보고합니다.'
  },
  {
    id: 'color-checker',
    name: 'color-checker',
    desc: 'X-Rite 차트 자동 검출 + ΔE 계산',
    enabled: false,
    addedBy: '로컬 (~/.claude/skills)',
    updatedAt: '2026년 3월 30일',
    trigger: '슬래시 명령어',
    version: '0.3.1',
    triggers: 'color checker,deltaE,x-rite,색재현',
    body: 'X-Rite ColorChecker 차트를 자동 검출해 24 패치의 측정값과 기준값 간 ΔE(2000) 를 계산합니다. 화이트밸런스 적용 전/후를 비교할 수 있습니다.'
  }
]

export const SEED_CONNECTORS: ConnectorItem[] = [
  {
    id: 'orca-board',
    name: 'orca-board',
    icon: 'cpu',
    transport: 'stdio',
    desc: '검증 보드 제어 — 캡처/노출/게인 도구',
    group: 'local',
    bullets: [
      '보드 제어 — capture, set_exposure, set_gain 도구를 노출합니다.',
      '시퀀스 — capture-batch 스킬이 이 커넥터로 sweep 을 구동합니다.',
      '안전 — cam-validation-v3 워크스페이스 안에서만 동작합니다.'
    ]
  },
  {
    id: 'filesystem',
    name: 'filesystem',
    icon: 'folder',
    transport: 'stdio',
    desc: '워크스페이스 파일 시스템 접근',
    group: 'local',
    bullets: [
      '읽기/쓰기 — cam-validation-v3/ 디렉토리 내부로 제한됩니다.',
      '캡처 산출물 — RAW 프레임·메타 사이드카를 스킬이 직접 읽습니다.'
    ]
  },
  {
    id: 'capture-rig',
    name: 'capture-rig',
    icon: 'cam',
    transport: 'stdio',
    desc: '캡처 리그 데스크톱 브리지',
    group: 'hardware',
    badge: '포함됨',
    bullets: [
      '리그 연결 — 셔터/스테이지/조명 제어를 로컬 USB 로 중계합니다.',
      '상태 — 리그 온라인 여부와 온도를 보고합니다.'
    ]
  },
  {
    id: 'gitlab',
    name: 'gitlab',
    icon: 'board',
    transport: 'http',
    desc: '회사 GitLab — 이슈/MR 연동',
    group: 'disconnected',
    bullets: [
      '이슈 — 검증 리포트를 이슈/MR 로 첨부합니다.',
      '인증 — 회사 GitLab 토큰이 필요합니다.'
    ]
  },
  {
    id: 'grafana',
    name: 'grafana',
    icon: 'flask',
    transport: 'http',
    desc: 'Grafana — 지표 대시보드 조회',
    group: 'disconnected',
    bullets: ['대시보드 — SNR/MTF 추세 패널을 조회합니다.', '인증 — 서비스 계정 토큰이 필요합니다.']
  }
]
