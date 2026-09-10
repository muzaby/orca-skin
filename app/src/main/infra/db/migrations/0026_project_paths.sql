ALTER TABLE projects ADD COLUMN cwd TEXT;
ALTER TABLE projects ADD COLUMN cwd_key TEXT;
CREATE UNIQUE INDEX idx_projects_cwd_key ON projects(cwd_key) WHERE cwd_key IS NOT NULL;
