CREATE TABLE managed_worktrees (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE REFERENCES sessions(id) ON DELETE SET NULL,
  repo_root TEXT NOT NULL,
  source_cwd TEXT NOT NULL,
  worktree_root TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  base_oid TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_managed_worktrees_session ON managed_worktrees(session_id);
