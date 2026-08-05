// 다운로드 저장소 (0160) — 파일명 위생·경로 이탈 차단(**순수**) + 실제 쓰기(I/O).
//
// 첨부 파일명은 **원격 서버가 준 값**이다. 그대로 경로에 붙이면 `../../.ssh/authorized_keys`
// 같은 이름 하나로 다운로드 루트 밖에 쓸 수 있다. 순수부(`sanitizeAssetName`·`resolveAssetPath`)를
// I/O 에서 떼어 단위 테스트로 고정하는 이유가 이것이다.

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { downloadsDir, isWithinDir } from '../../../../infra/config/paths'

// 첨부가 저장되는 하위 디렉터리. 변환기가 만드는 Markdown 의 상대 경로가 이 이름을 가리킨다.
// **경로 관심사이므로 여기 산다** — 변환기에 두면 두 모듈이 서로를 import 해 순환이 된다.
export const ASSETS_DIR = 'assets'

// 경로 구분자·상위 참조·제어문자·널바이트를 제거한다. 결과가 비면 대체 이름을 준다.
export function sanitizeAssetName(raw: string): string {
  const withoutPath = raw
    // 구분자는 양쪽 OS 를 모두 막는다 — Windows 에서 '/' 도 구분자다.
    .replace(/[/\\]+/g, '_')
    // 제어문자·널바이트 제거. **이스케이프로 적는다** — 리터럴 제어문자를 소스에 넣으면
    // 파일이 binary 로 취급되고 diff·grep 이 깨진다.
    // eslint-disable-next-line no-control-regex -- 제어문자 제거가 목적이다
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // Windows 예약 문자.
    .replace(/[<>:"|?*]/g, '_')
    .trim()

  // '..' 만 남거나(상위 참조) 점으로만 이뤄진 이름은 경로로 해석될 여지가 있다.
  const collapsed = withoutPath.replace(/^\.+$/, '')
  // 앞의 점은 숨김 파일이 되므로 유지하되, 이름이 통째로 비면 대체한다.
  if (collapsed === '') return 'unnamed'
  // 점 **두 개 이상**으로 시작하는 이름은 앞을 '_' 로 바꾼다. 실제로 상위로 못 올라가더라도
  // `isWithinDir` 이 `relative()` 결과의 '..' 접두사로 판정하므로(`infra/config/paths.ts:72-75`),
  // `.._..x.png` 같은 **파일명**이 경로 이탈로 오판된다. 한 개(`.hidden`)는 그대로 둔다.
  const unambiguous = collapsed.replace(/^\.{2,}/, '_')
  // 파일 시스템 상한(255바이트)을 넘지 않게 자른다. 확장자를 살려 잘라야 열 수 있다.
  return truncateName(unambiguous, 200)
}

function truncateName(name: string, max: number): string {
  if (Buffer.byteLength(name) <= max) return name
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot) : ''
  const stem = dot > 0 ? name.slice(0, dot) : name
  let out = stem
  while (Buffer.byteLength(out + ext) > max && out.length > 0) out = out.slice(0, -1)
  return `${out}${ext}`
}

// 저장 대상 절대 경로. 정규화 후에도 루트를 벗어나면 **거부한다** — sanitize 를 통과한
// 이름이라도 최종 경로를 한 번 더 검사하는 것이 fail-closed 다.
export function resolveAssetPath(baseDir: string, rawName: string): string {
  const safe = sanitizeAssetName(rawName)
  const target = resolve(join(baseDir, safe))
  if (!isWithinDir(target, resolve(baseDir))) {
    throw new Error(`다운로드 루트를 벗어나는 파일명입니다: ${safe}`)
  }
  return target
}

// 이미 있는 이름이면 `name-1.ext`, `name-2.ext` … 로 비켜 쓴다. 재다운로드가 실패로 끝나지
// 않으면서 원본도 보존된다.
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 1; i < 10_000; i += 1) {
    const candidate = `${stem}-${i}${ext}`
    if (!taken.has(candidate)) return candidate
  }
  throw new Error(`이름 충돌을 해소하지 못했습니다: ${name}`)
}

// 페이지 하나의 저장 루트. connector 별로 나눠 서버가 여러 개여도 섞이지 않는다.
export function pageDir(connectorId: string, pageId: string): string {
  return join(
    downloadsDir(),
    'confluence',
    sanitizeAssetName(connectorId),
    sanitizeAssetName(pageId)
  )
}

export function assetsDirOf(dir: string): string {
  return join(dir, ASSETS_DIR)
}

export interface SavedAsset {
  filename: string
  path: string
  bytes: number
  mediaType?: string
  // 내려받은 첨부의 버전 번호 (0169). 목록 조회 시점의 현재 버전이라, 본문 URL 이 달고 있는
  // 삽입 시점 버전(`?version=N`)을 따르지 않았음을 사후에 확인할 수 있다.
  version?: number
  // 실제로 받아온 절대 URL (0171). 여러 좌표를 순서대로 시도하므로 "어느 주소가 통했는가" 가
  // 진단의 시작점이다 — 파일만 남으면 출처를 되짚을 수 없다.
  sourceUrl?: string
}

// `saveAsset` 이 파일 옆에 함께 기록하는 메타. 인자 순서로 늘리면 호출부가 곧 못 읽게 된다.
export type AssetMeta = Omit<SavedAsset, 'filename' | 'path' | 'bytes'>

export class DownloadStore {
  private readonly taken = new Set<string>()

  constructor(private readonly dir: string) {}

  async ensure(): Promise<void> {
    await mkdir(assetsDirOf(this.dir), { recursive: true })
  }

  async saveAsset(rawName: string, bytes: Uint8Array, meta: AssetMeta = {}): Promise<SavedAsset> {
    const filename = uniqueName(sanitizeAssetName(rawName), this.taken)
    const path = resolveAssetPath(assetsDirOf(this.dir), filename)
    await writeFile(path, bytes)
    this.taken.add(filename)
    return { filename, path, bytes: bytes.byteLength, ...meta }
  }

  // `page.md` 는 덮어쓴다 — 같은 페이지를 다시 받으면 최신 본문이 맞다.
  async saveText(name: string, content: string): Promise<string> {
    const path = resolveAssetPath(this.dir, name)
    await writeFile(path, content, 'utf8')
    return path
  }

  get root(): string {
    return this.dir
  }
}

// 경로를 로그·결과에 실을 때 홈 디렉터리를 노출하지 않도록 줄인다.
export function relativeToDownloads(path: string): string {
  const root = downloadsDir()
  return isWithinDir(path, root) ? path.slice(root.length + sep.length) : path
}
