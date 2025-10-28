-- Migration: 022_create_daily_stats_table.sql
-- Purpose: Create a table to store daily pipeline statistics for efficient dashboard querying.

CREATE TABLE IF NOT EXISTS daily_pipeline_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stats_date DATE NOT NULL UNIQUE,
    total_in_queue INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    sent_to_n8n INTEGER DEFAULT 0,
    calling INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    completion_rate NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster date lookups
CREATE INDEX idx_stats_date ON daily_pipeline_stats(stats_date);

-- RLS Policy
ALTER TABLE daily_pipeline_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to authenticated users" ON daily_pipeline_stats
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage stats" ON daily_pipeline_stats
    FOR ALL TO service_role USING (true);


-- Function to refresh the daily statistics
CREATE OR REPLACE FUNCTION refresh_daily_pipeline_stats(p_target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO daily_pipeline_stats (
        stats_date,
        total_in_queue,
        pending,
        sent_to_n8n,
        calling,
        completed,
        failed,
        skipped,
        completion_rate
    )
    SELECT
        queue_date,
        total_contacts,
        pending,
        sent_to_n8n,
        calling,
        completed,
        failed,
        skipped,
        completion_rate
    FROM daily_queue_analytics
    WHERE queue_date = p_target_date
    ON CONFLICT (stats_date) DO UPDATE
    SET
        total_in_queue = EXCLUDED.total_in_queue,
        pending = EXCLUDED.pending,
        sent_to_n8n = EXCLUDED.sent_to_n8n,
        calling = EXCLUDED.calling,
        completed = EXCLUDED.completed,
        failed = EXCLUDED.failed,
        skipped = EXCLUDED.skipped,
        completion_rate = EXCLUDED.completion_rate,
        updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION refresh_daily_pipeline_stats(DATE) IS 'Updates the statistics for a given day in the daily_pipeline_stats table by sourcing data from the daily_queue_analytics view.'; 