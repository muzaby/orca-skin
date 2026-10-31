type SessionBinding = { backend: string; cwd: string | null; project_id: string | null }

export const sameSessionBinding = (
  current: SessionBinding | undefined,
  expected: SessionBinding
): boolean =>
  !!current &&
  current.backend === expected.backend &&
  current.cwd === expected.cwd &&
  current.project_id === expected.project_id
