// 구 평면 레이아웃(~/.config/orca/{skills,agents,commands,mcp.json} + 루트 .claude-plugin)을
// 표준화 sources/ 레이아웃으로 1회 이전한다(standardization.md §5.1).
//   skills/agents/commands → sources/{skills,agents,commands}
//   mcp.json              → sources/mcp/mcp.json
//   루트 .claude-plugin   → 제거(dist/<engine>/ 로 재생성되므로 inert)
//
// 멱등: 각 항목은 구 경로가 있을 때만 이동하므로 1회 실행 후 no-op. dest 에 이미 파일이 있으면
// 덮어쓰지 않는다(force:false) — 사용자 콘텐츠 보존. 실패는 warn 후 계속(부팅 차단 금지).
//
// 레이아웃은 paths.ts 의 sources*/dist* 헬퍼와 일치해야 한다 — 본 함수는 테스트 용이성을 위해
// root 를 받아 상대 경로로 계산한다(homedir 비의존). 기본값은 orcaConfigDir().

import { existsSync, mkdirSync, renameSync, cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { orcaConfigDir } from './paths'

// 한 항목(파일 또는 디렉토리)을 src→dest 로 이동. dest 가 있으면 children 병합(기존 보존).
function moveLegacy(src: string, dest: string): boolean {
  if (!existsSync(src)) return false
  mkdirSync(dirname(dest), { recursive: true })
  if (!existsSync(dest)) {
    try {
      renameSync(src, dest)
      return true
    } catch {
      // EXDEV(교차 디바이스) 등 — 복사 후 제거로 폴백.
    }
  }
  // dest 가 이미 있거나 rename 실패 → 재귀 복사(기존 파일 미덮어씀) 후 원본 제거.
  cpSync(src, dest, { recursive: true, force: false, errorOnExist: false })
  rmSync(src, { recursive: true, force: true })
  return true
}

export function migrateConfigToSources(root: string = orcaConfigDir()): void {
  const sources = join(root, 'sources')
  let moved = 0
  try {
    moved += moveLegacy(join(root, 'skills'), join(sources, 'skills')) ? 1 : 0
    moved += moveLegacy(join(root, 'agents'), join(sources, 'agents')) ? 1 : 0
    moved += moveLegacy(join(root, 'commands'), join(sources, 'commands')) ? 1 : 0
    moved += moveLegacy(join(root, 'mcp.json'), join(sources, 'mcp', 'mcp.json')) ? 1 : 0
    // 구 app-생성 플러그인 매니페스트(루트) — dist/ 로 재생성되므로 제거.
    rmSync(join(root, '.claude-plugin'), { recursive: true, force: true })
  } catch (e) {
    console.warn('[sources:migrate] 일부 항목 이전 실패(계속 진행):', e)
  }

  // 정규 소스 골격 보장(멱등). 이전이 없던 새 사용자도 빈 SSOT 디렉토리를 갖는다.
  for (const d of [
    join(sources, 'instructions'),
    join(sources, 'skills'),
    join(sources, 'agents'),
    join(sources, 'commands'),
    join(sources, 'mcp'),
    join(sources, 'hooks', 'claude-code')
  ]) {
    mkdirSync(d, { recursive: true })
  }

  if (moved > 0) {
    console.warn(`[sources:migrate] 구 레이아웃 항목 ${moved}개를 sources/ 로 이전했습니다.`)
  }
}
