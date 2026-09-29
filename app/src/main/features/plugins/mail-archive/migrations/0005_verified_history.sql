-- A personal archive is cumulative. current_revision records the last import, not visibility.
CREATE VIEW archive_verified_occurrence AS
SELECT o.*, s.source_kind, s.source_path, r.fingerprint, r.verified_at
FROM archive_source_occurrence o
JOIN archive_source_revision r ON r.source_id=o.source_id AND r.revision=o.revision
JOIN archive_source s ON s.source_id=o.source_id
WHERE r.state='verified';
