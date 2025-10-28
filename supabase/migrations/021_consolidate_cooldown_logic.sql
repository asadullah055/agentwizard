-- Migration: 021_consolidate_cooldown_logic.sql
-- Purpose: Simplify and centralize the contact cooldown logic.

-- The original get_next_call_batch function had a redundant and potentially
-- confusing 30-minute cooldown check against a 'webhook_cache' table.
-- The primary cooldown logic (e.g., 14-day wait after a call) is already
-- handled during the initial preload of the queue via the preload_daily_contacts function.
-- This extra check is unnecessary and complicates the system.

-- By removing it, we make the queue processing simpler: if a contact is in
-- the queue with a 'pending' status, it is considered ready to call. The
-- preload function is the single gatekeeper for eligibility.

-- Function to get next batch from queue (Simplified Version)
CREATE OR REPLACE FUNCTION get_next_call_batch(
    p_batch_size INTEGER DEFAULT 5,
    p_queue_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    queue_id UUID,
    contact_id VARCHAR,
    phone_number VARCHAR,
    contact_data JSONB,
    priority_score INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH batch AS (
        SELECT 
            dcq.id,
            dcq.contact_id,
            dcq.phone_number,
            dcq.contact_data,
            dcq.priority_score
        FROM daily_call_queue dcq
        WHERE dcq.queue_date = p_queue_date
          AND dcq.status = 'pending'
        -- REMOVED: Redundant 30-minute cooldown check.
        -- The preload function is now the single source of truth for cooldown.
        ORDER BY dcq.priority_score DESC, dcq.created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE daily_call_queue
    SET status = 'sent_to_n8n',
        sent_to_n8n_at = NOW(),
        updated_at = NOW()
    FROM batch
    WHERE daily_call_queue.id = batch.id
    RETURNING 
        daily_call_queue.id,
        daily_call_queue.contact_id,
        daily_call_queue.phone_number,
        daily_call_queue.contact_data,
        daily_call_queue.priority_score;
END;
$$;

COMMENT ON FUNCTION get_next_call_batch(INTEGER, DATE) IS 'Dequeues the next batch of contacts ready for calling, using a row-locking mechanism to prevent race conditions. Cooldown logic is handled by the preload function, not here.'; 