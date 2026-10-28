export interface ProjectResourceConfiguration {
  revision: string
}
export interface ProjectResourcePolicy {
  files(cwd: string): string[]
  read(cwd: string): Promise<ProjectResourceConfiguration>
  dirty?(cwd: string): void
}
