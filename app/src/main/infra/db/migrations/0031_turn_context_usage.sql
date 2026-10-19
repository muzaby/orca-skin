-- Context occupancy is the latest model step, independent of billable turn totals.
ALTER TABLE turn_usage ADD COLUMN context_tokens INTEGER;
ALTER TABLE turn_usage ADD COLUMN context_window INTEGER;
