-- VAPI Database Functions
-- Migration: 002_create_vapi_functions.sql

-- Function to update analytics for a specific date
CREATE OR REPLACE FUNCTION update_vapi_analytics_for_date(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO vapi_analytics (
        date, 
        total_calls, 
        successful_calls, 
        failed_calls,
        total_duration_seconds, 
        avg_duration_seconds,
        total_cost_usd,
        avg_sentiment_score
    )
    SELECT 
        target_date,
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'ended' AND (analysis->>'successful')::boolean = true) as successful_calls,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
        COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
        ROUND(AVG(duration_seconds), 2) as avg_duration_seconds,
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        ROUND(AVG((analysis->>'sentiment_score')::decimal), 2) as avg_sentiment_score
    FROM vapi_calls 
    WHERE DATE(started_at) = target_date
    ON CONFLICT (date) DO UPDATE SET
        total_calls = EXCLUDED.total_calls,
        successful_calls = EXCLUDED.successful_calls,
        failed_calls = EXCLUDED.failed_calls,
        total_duration_seconds = EXCLUDED.total_duration_seconds,
        avg_duration_seconds = EXCLUDED.avg_duration_seconds,
        total_cost_usd = EXCLUDED.total_cost_usd,
        avg_sentiment_score = EXCLUDED.avg_sentiment_score,
        updated_at = NOW();
END;
$$;

-- Function to refresh analytics for the last N days
CREATE OR REPLACE FUNCTION refresh_vapi_analytics(days_back INTEGER DEFAULT 7)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_date_iter DATE;
BEGIN
    -- Loop through the last N days and update analytics
    FOR i IN 0..days_back-1 LOOP
        current_date_iter := CURRENT_DATE - i;
        PERFORM update_vapi_analytics_for_date(current_date_iter);
    END LOOP;
END;
$$;

-- Function to get call analytics for a date range
CREATE OR REPLACE FUNCTION get_vapi_call_metrics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_calls BIGINT,
    successful_calls BIGINT,
    success_rate DECIMAL,
    total_duration_seconds BIGINT,
    avg_duration_seconds DECIMAL,
    total_cost_usd DECIMAL,
    avg_cost_per_call DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'ended' AND (analysis->>'successful')::boolean = true) as successful_calls,
        ROUND(
            (COUNT(*) FILTER (WHERE status = 'ended' AND (analysis->>'successful')::boolean = true)::decimal / 
             NULLIF(COUNT(*), 0) * 100), 2
        ) as success_rate,
        COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
        ROUND(AVG(duration_seconds), 2) as avg_duration_seconds,
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        ROUND(COALESCE(SUM(cost_usd), 0) / NULLIF(COUNT(*), 0), 4) as avg_cost_per_call
    FROM vapi_calls 
    WHERE DATE(started_at) BETWEEN start_date AND end_date;
END;
$$;

-- Function to get assistant performance metrics
CREATE OR REPLACE FUNCTION get_assistant_performance(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    assistant_id VARCHAR,
    assistant_name VARCHAR,
    total_calls BIGINT,
    successful_calls BIGINT,
    success_rate DECIMAL,
    avg_duration_seconds DECIMAL,
    total_cost_usd DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vc.assistant_id,
        COALESCE(va.name, vc.assistant_id) as assistant_name,
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE vc.status = 'ended' AND (vc.analysis->>'successful')::boolean = true) as successful_calls,
        ROUND(
            (COUNT(*) FILTER (WHERE vc.status = 'ended' AND (vc.analysis->>'successful')::boolean = true)::decimal / 
             NULLIF(COUNT(*), 0) * 100), 2
        ) as success_rate,
        ROUND(AVG(vc.duration_seconds), 2) as avg_duration_seconds,
        COALESCE(SUM(vc.cost_usd), 0) as total_cost_usd
    FROM vapi_calls vc
    LEFT JOIN vapi_assistants va ON vc.assistant_id = va.assistant_id
    WHERE DATE(vc.started_at) BETWEEN start_date AND end_date
    GROUP BY vc.assistant_id, va.name
    ORDER BY total_calls DESC;
END;
$$;

-- Function to clean up old webhook events (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM vapi_webhook_events 
    WHERE processed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Function to get hourly call volume for charts
CREATE OR REPLACE FUNCTION get_hourly_call_volume(
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    hour_of_day INTEGER,
    call_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM started_at)::INTEGER as hour_of_day,
        COUNT(*) as call_count
    FROM vapi_calls 
    WHERE DATE(started_at) BETWEEN start_date AND end_date
    GROUP BY EXTRACT(HOUR FROM started_at)
    ORDER BY hour_of_day;
END;
$$;

-- Function to update call status (for webhook events)
CREATE OR REPLACE FUNCTION update_vapi_call_status(
    p_call_id VARCHAR,
    p_status VARCHAR,
    p_ended_at TIMESTAMPTZ DEFAULT NULL,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_cost_usd DECIMAL DEFAULT NULL,
    p_transcript JSONB DEFAULT NULL,
    p_analysis JSONB DEFAULT NULL,
    p_recording_url VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE vapi_calls 
    SET 
        status = p_status,
        ended_at = COALESCE(p_ended_at, ended_at),
        duration_seconds = COALESCE(p_duration_seconds, duration_seconds),
        cost_usd = COALESCE(p_cost_usd, cost_usd),
        transcript = COALESCE(p_transcript, transcript),
        analysis = COALESCE(p_analysis, analysis),
        recording_url = COALESCE(p_recording_url, recording_url),
        updated_at = NOW()
    WHERE call_id = p_call_id;
    
    RETURN FOUND;
END;
$$;

-- Trigger to automatically update analytics when calls are modified
CREATE OR REPLACE FUNCTION trigger_update_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update analytics for the date when the call started
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.started_at IS NOT NULL THEN
            PERFORM update_vapi_analytics_for_date(DATE(NEW.started_at));
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.started_at IS NOT NULL THEN
            PERFORM update_vapi_analytics_for_date(DATE(OLD.started_at));
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Create trigger on vapi_calls table
DROP TRIGGER IF EXISTS trigger_vapi_calls_analytics ON vapi_calls;
CREATE TRIGGER trigger_vapi_calls_analytics
    AFTER INSERT OR UPDATE OR DELETE ON vapi_calls
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_analytics();

-- Create a view for easy call analytics querying
CREATE OR REPLACE VIEW vapi_call_analytics AS
SELECT 
    DATE(started_at) as call_date,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'ended' AND (analysis->>'successful')::boolean = true) as successful_calls,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
    COUNT(*) FILTER (WHERE status IN ('queued', 'ringing', 'in-progress')) as active_calls,
    ROUND(AVG(duration_seconds), 2) as avg_duration,
    SUM(cost_usd) as total_cost,
    ROUND(AVG((analysis->>'sentiment_score')::decimal), 2) as avg_sentiment
FROM vapi_calls 
WHERE started_at IS NOT NULL
GROUP BY DATE(started_at)
ORDER BY call_date DESC; 