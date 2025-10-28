-- Daily Call Queue System
-- Migration: 020_daily_call_queue_system.sql
-- Purpose: Preload contacts daily and track their progress through the calling pipeline

-- Daily call queue table
CREATE TABLE IF NOT EXISTS daily_call_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    contact_id VARCHAR NOT NULL,
    phone_number VARCHAR NOT NULL,
    contact_data JSONB NOT NULL,
    priority_score INTEGER DEFAULT 50,
    
    -- Status tracking
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'sent_to_n8n', 'calling', 'completed', 'failed', 'skipped')),
    sent_to_n8n_at TIMESTAMPTZ,
    n8n_batch_id VARCHAR,
    call_initiated_at TIMESTAMPTZ,
    call_completed_at TIMESTAMPTZ,
    vapi_call_id VARCHAR,
    call_outcome VARCHAR,
    
    -- Metadata
    skip_reason VARCHAR,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates per day
    UNIQUE(queue_date, contact_id)
);

-- Indexes for performance
CREATE INDEX idx_queue_date_status ON daily_call_queue(queue_date, status);
CREATE INDEX idx_queue_pending ON daily_call_queue(queue_date, status) WHERE status = 'pending';
CREATE INDEX idx_queue_contact ON daily_call_queue(contact_id);
CREATE INDEX idx_queue_phone ON daily_call_queue(phone_number);

-- Function to preload daily contacts
CREATE OR REPLACE FUNCTION preload_daily_contacts(
    p_target_count INTEGER DEFAULT 100,
    p_queue_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    loaded_count INTEGER,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_loaded_count INTEGER := 0;
BEGIN
    -- Clear any pending contacts from previous days
    UPDATE daily_call_queue 
    SET status = 'skipped',
        skip_reason = 'Expired - new day started',
        updated_at = NOW()
    WHERE queue_date < p_queue_date 
      AND status = 'pending';

    -- Check if already loaded for today
    SELECT COUNT(*) INTO v_loaded_count
    FROM daily_call_queue
    WHERE queue_date = p_queue_date;
    
    IF v_loaded_count > 0 THEN
        RETURN QUERY SELECT v_loaded_count, 'Contacts already loaded for today'::TEXT;
        RETURN;
    END IF;
    
    -- Insert fresh contacts with smart filtering
    WITH eligible_contacts AS (
        -- This would be replaced with actual GHL API call in edge function
        -- For now, showing the SQL logic
        SELECT 
            contact_id,
            phone_number,
            contact_data,
            -- Priority scoring
            CASE 
                WHEN last_called_at IS NULL THEN 100
                WHEN last_called_at < NOW() - INTERVAL '30 days' THEN 80
                WHEN last_called_at < NOW() - INTERVAL '14 days' THEN 60
                ELSE 40
            END as priority_score
        FROM (
            -- Placeholder for GHL contacts
            SELECT 
                'contact_' || generate_series AS contact_id,
                '+447' || LPAD(generate_series::text, 9, '0') AS phone_number,
                jsonb_build_object(
                    'firstName', 'Test',
                    'lastName', 'User',
                    'email', 'test@example.com'
                ) AS contact_data,
                NULL::TIMESTAMPTZ as last_called_at
            FROM generate_series(1, p_target_count)
        ) AS mock_contacts
        WHERE NOT EXISTS (
            -- Check 2-week cooldown
            SELECT 1 FROM call_attempts ca
            WHERE ca.phone_number = mock_contacts.phone_number
              AND ca.last_ended_reason IN ('customer-ended-call', 'voicemail', 'assistant-ended-call')
              AND ca.last_attempt_at > NOW() - INTERVAL '14 days'
        )
        ORDER BY priority_score DESC, RANDOM()
        LIMIT p_target_count
    )
    INSERT INTO daily_call_queue (
        queue_date,
        contact_id,
        phone_number,
        contact_data,
        priority_score,
        status
    )
    SELECT 
        p_queue_date,
        contact_id,
        phone_number,
        contact_data,
        priority_score,
        'pending'
    FROM eligible_contacts
    ON CONFLICT (queue_date, contact_id) DO NOTHING;
    
    GET DIAGNOSTICS v_loaded_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_loaded_count, ('Loaded ' || v_loaded_count || ' contacts for ' || p_queue_date)::TEXT;
END;
$$;

-- Function to get next batch from queue
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
          -- Double-check cooldown
          AND NOT EXISTS (
              SELECT 1 FROM webhook_cache wc
              WHERE wc.contact_id = dcq.contact_id
                AND wc.last_sent_at > NOW() - INTERVAL '30 minutes'
          )
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

-- Function to update queue status
CREATE OR REPLACE FUNCTION update_queue_status(
    p_contact_id VARCHAR,
    p_status VARCHAR,
    p_vapi_call_id VARCHAR DEFAULT NULL,
    p_call_outcome VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE daily_call_queue
    SET status = p_status,
        vapi_call_id = COALESCE(p_vapi_call_id, vapi_call_id),
        call_outcome = COALESCE(p_call_outcome, call_outcome),
        call_initiated_at = CASE WHEN p_status = 'calling' THEN NOW() ELSE call_initiated_at END,
        call_completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE call_completed_at END,
        updated_at = NOW()
    WHERE contact_id = p_contact_id
      AND queue_date = CURRENT_DATE;
    
    RETURN FOUND;
END;
$$;

-- Analytics view
CREATE OR REPLACE VIEW daily_queue_analytics AS
SELECT 
    queue_date,
    COUNT(*) as total_contacts,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'sent_to_n8n') as sent_to_n8n,
    COUNT(*) FILTER (WHERE status = 'calling') as calling,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 1) as completion_rate,
    MIN(created_at) as queue_created_at,
    MAX(call_completed_at) as last_call_at
FROM daily_call_queue
GROUP BY queue_date
ORDER BY queue_date DESC;

-- Scheduled job to preload contacts (to be called by edge function)
CREATE OR REPLACE FUNCTION daily_preload_job()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result FROM preload_daily_contacts(100);
    
    RETURN jsonb_build_object(
        'success', true,
        'loaded_count', v_result.loaded_count,
        'message', v_result.message,
        'timestamp', NOW()
    );
END;
$$;

-- Enable RLS
ALTER TABLE daily_call_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Service role can manage queue" ON daily_call_queue
    FOR ALL TO service_role USING (true);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER update_daily_call_queue_updated_at
    BEFORE UPDATE ON daily_call_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 