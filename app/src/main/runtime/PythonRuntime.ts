import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile, access, chmod } from 'node:fs/promises'
import { constants } from 'node:fs'
import { getRuntimePaths, getBundledUvPath } from './paths'
import { buildPyEnv } from './env'
import { ORCA_ENV_TEMPLATE } from './envFile'
import type { RuntimeStatus, RuntimeStage } from '../../shared/ipc'

const PYTHON_VERSION = '3.12'
const APP_VERSION = app.getVersion()
const READY_CONTENT = `${APP_VERSION}:${PYTHON_VERSION}`

// uv + Python 런타임 초기화 상태기계.
//
// 흐름: idle → preparing(각 단계) → ready | error
// 멱등: .ready 마커에 (앱버전:python버전) 이 일치하면 즉시 스킵.
// 자가복구: .ready 부재 또는 venv 검증 실패 시 재구성.
// 실패: 각 단계의 에러를 status 이벤트로 renderer 에 스트리밍 + error 상태로 전이.
export class PythonRuntime extends EventEmitter {
  private _status: RuntimeStatus = { stage: 'idle', ready: false }
  private _env: Record<string, string> | null = null
  private _installLog = '' // [4] python install 단계 누적 로그 (실패 시 진단용)
  private userData: string

  constructor() {
    super()
    this.userData = app.getPath('userData')
  }

  get status(): RuntimeStatus {
    return this._status
  }

  // 초기화가 완료된 env. ready 전이면 null.
  getEnv(): Record<string, string> | null {
    return this._env
  }

  // 멱등 진입점. IpcRouter.start() 에서 await 없이 킥한다.
  async ensure(): Promise<void> {
    if (this._status.stage === 'preparing' || this._status.stage === 'ready') return
    await this._run()
  }

  // 실패 후 renderer 재시도 버튼이 호출.
  async retry(): Promise<void> {
    if (this._status.stage === 'preparing') return
    await this._run()
  }

  private emit_status(s: RuntimeStatus): void {
    this._status = s
    this.emit('status', s)
  }

  private stage(stage: RuntimeStage, log?: string): void {
    this.emit_status({ stage, ready: false, log })
  }

  private async _run(): Promise<void> {
    const paths = getRuntimePaths(this.userData)

    this.stage('preparing', '런타임 초기화 시작…')

    try {
      // [1] .ready 마커 확인 — 일치하면 즉시 스킵
      const ready = await this._readReady(paths.readyFile)
      if (ready === READY_CONTENT) {
        // venv + uv 바이너리 존재 확인 (PATH 가 uvBin 위치에 의존하므로 둘 다 필요)
        const venvOk = await this._exists(paths.venvBin)
        const uvOk = await this._exists(paths.uvBin)
        if (venvOk && uvOk) {
          this._env = buildPyEnv(this.userData)
          this.emit_status({ stage: 'ready', ready: true })
          return
        }
      }

      // [2] uv 바이너리 배치 — userData 최상위 bin/ 에 둔다
      this.stage('preparing', 'uv 바이너리 배치 중…')
      await mkdir(paths.binDir, { recursive: true })
      await mkdir(paths.configDir, { recursive: true })
      const bundledUv = getBundledUvPath()
      await copyFile(bundledUv, paths.uvBin)
      if (process.platform !== 'win32') {
        await chmod(paths.uvBin, 0o755)
      }

      // [3] config 파일 생성
      this.stage('preparing', 'config 파일 생성 중…')
      await this._writeConfigs(paths)

      // [4] Python 인터프리터 확보
      // UV_PYTHON_INSTALL_MIRROR 가 process.env 에 있으면 buildPyEnv 가 pass-through 함.
      // 폐쇄망 진단을 위해 이 단계 로그를 누적해 둔다(실패 시 remediation 힌트 판정에 사용).
      this.stage('preparing', `Python ${PYTHON_VERSION} 인터프리터 설치 중…`)
      const env = buildPyEnv(this.userData)
      this._installLog = ''
      await this._exec(paths.uvBin, ['python', 'install', PYTHON_VERSION], env, (log) => {
        this._installLog += log
        this.emit_status({ stage: 'preparing', ready: false, log })
      })

      // [5] venv 생성
      this.stage('preparing', 'venv 생성 중…')
      await this._exec(
        paths.uvBin,
        ['venv', paths.venvDir, '--python', PYTHON_VERSION],
        env,
        (log) => {
          this.emit_status({ stage: 'preparing', ready: false, log })
        }
      )

      // [6] 검증 — 실행파일 경로가 venvDir 내부인지
      this.stage('preparing', '환경 검증 중…')
      const pythonBin =
        process.platform === 'win32' ? `${paths.venvBin}\\python.exe` : `${paths.venvBin}/python`
      const exePath = await this._execCapture(pythonBin, ['-c', 'import sys;print(sys.executable)'])
      if (!exePath.includes(paths.venvDir)) {
        throw new Error(`Python 검증 실패: ${exePath} 가 venv 밖을 가리킵니다.`)
      }

      // [7] .ready 기록
      await writeFile(paths.readyFile, READY_CONTENT, 'utf-8')
      this._env = buildPyEnv(this.userData)
      this.emit_status({ stage: 'ready', ready: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit_status({ stage: 'error', ready: false, error: this._withRemediation(message) })
    }
  }

  // 폐쇄망 네트워크/인증서 실패로 보이면 한국어 remediation 힌트를 덧붙인다.
  // 판정 근거: 에러 메시지 + Python 설치 단계 누적 로그.
  private _withRemediation(message: string): string {
    const haystack = `${message}\n${this._installLog}`
    if (!/certificate|UnknownIssuer|Connect|download|mirror|proxy/i.test(haystack)) return message
    return (
      `${message}\n\n` +
      '폐쇄망으로 보입니다. <userData>/orca.env (또는 머신 전역 %PROGRAMDATA%\\orca\\orca.env) 에 다음을 설정하세요:\n' +
      '  - UV_PYTHON_INSTALL_MIRROR: 사내 python-build-standalone 미러 URL\n' +
      '  - UV_DEFAULT_INDEX / PIP_INDEX_URL: 사내 PyPI 인덱스 URL\n' +
      '  - 인증서 오류(UnknownIssuer)면 사내 CA 를 OS 신뢰저장소에 설치하고 UV_NATIVE_TLS=1(기본) 유지, 또는 SSL_CERT_FILE 로 CA 번들 지정\n' +
      '자세한 안내는 같은 위치의 orca.env.example 또는 docs/CLOSED_NETWORK_RUNTIME.md 참고.'
    )
  }

  private async _readReady(file: string): Promise<string> {
    try {
      return (await readFile(file, 'utf-8')).trim()
    } catch {
      return ''
    }
  }

  private async _exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  private async _writeConfigs(paths: ReturnType<typeof getRuntimePaths>): Promise<void> {
    // 골격 config 파일. operator 가 UV_DEFAULT_INDEX 등을 환경변수로 설정하면
    // uv 는 환경변수를 파일보다 우선 적용하므로 여기서는 하드코딩하지 않는다.
    await writeFile(
      paths.appUvToml,
      '# Orca 앱 전용 uv config. 사내 인덱스는 UV_DEFAULT_INDEX 환경변수로 지정하세요.\n',
      'utf-8'
    )
    await writeFile(
      paths.appPipConf,
      '[global]\n# 사내 인덱스는 PIP_INDEX_URL 환경변수로 지정하세요.\n',
      'utf-8'
    )
    // 폐쇄망 운영자용 orca.env 템플릿. 본파일(orca.env)은 건드리지 않고 example 만,
    // 그것도 아직 없을 때만 기록한다(운영자 편집을 덮어쓰지 않기 위해).
    if (!(await this._exists(paths.orcaEnvExample))) {
      await writeFile(paths.orcaEnvExample, ORCA_ENV_TEMPLATE, 'utf-8')
    }
  }

  private _exec(
    bin: string,
    args: string[],
    env: Record<string, string>,
    onLog: (line: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = execFile(bin, args, { env, maxBuffer: 10 * 1024 * 1024 })
      child.stdout?.on('data', (d: Buffer) => onLog(d.toString()))
      child.stderr?.on('data', (d: Buffer) => onLog(d.toString()))
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`${bin} ${args.join(' ')} 종료 코드: ${code}`))
      })
      child.on('error', reject)
    })
  }

  private _execCapture(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(bin, args, (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout.trim())
      })
    })
  }
}
