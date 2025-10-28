-- Migration to fix MAX calls enforcement to use the correct settings table
-- This updates the should_call_phone_number function to read from calling_settings instead of call_frequency_settings

CREATE OR REPLACE FUNCTION should_call_phone_number(
    p_phone_number VARCHAR,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
    should_call BOOLEAN,
    reason TEXT,
    attempts_today INTEGER,
    total_attempts INTEGER,
    last_attempt TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
DECLARE
    v_attempts_today INTEGER := 0;
    v_total_attempts INTEGER := 0;
    v_last_attempt TIMESTAMPTZ;
    v_last_call_ended_reason TEXT;
    v_cooldown_hours INTEGER := 24;
    v_max_daily INTEGER := 100; -- Default value
    v_max_total INTEGER := 10;
    current_date_start TIMESTAMPTZ;
    current_time TIME;
    call_window_start TIME := '09:00';
    call_window_end TIME := '18:00';
    enabled_days JSONB;
BEGIN
    -- Get max daily calls from calling_settings table (NEW)
    SELECT (setting_value ->> 'value')::INTEGER INTO v_max_daily 
    FROM calling_settings WHERE setting_name = 'max_daily_calls';
    
    -- If not found, use default
    IF v_max_daily IS NULL THEN
        v_max_daily := 100;
    END IF;
    
    -- Get other settings from old table (keeping for compatibility)
    SELECT (setting_value #>> '{}')::INTEGER INTO v_max_total 
    FROM call_frequency_settings WHERE setting_name = 'max_total_attempts';
    
    SELECT (setting_value #>> '{}')::TIME INTO call_window_start 
    FROM call_frequency_settings WHERE setting_name = 'call_window_start';
    
    SELECT (setting_value #>> '{}')::TIME INTO call_window_end 
    FROM call_frequency_settings WHERE setting_name = 'call_window_end';
    
    SELECT setting_value INTO enabled_days 
    FROM call_frequency_settings WHERE setting_name = 'enabled_days';
    
    -- Set defaults if not found
    IF v_max_total IS NULL THEN v_max_total := 10; END IF;
    
    -- Get current day start (midnight in current timezone)
    current_date_start := date_trunc('day', p_current_time);
    
    -- Get time component
    current_time := p_current_time::TIME;
    
    -- Count attempts today
    SELECT COUNT(*), MAX(created_at)
    INTO v_attempts_today, v_last_attempt
    FROM call_attempts 
    WHERE phone_number = p_phone_number 
    AND created_at >= current_date_start;
    
    -- Count total attempts
    SELECT COUNT(*)
    INTO v_total_attempts
    FROM call_attempts 
    WHERE phone_number = p_phone_number;
    
    -- Get last call ended reason
    SELECT ended_reason INTO v_last_call_ended_reason
    FROM vapi_calls 
    WHERE phone_number = p_phone_number 
    ORDER BY started_at DESC 
    LIMIT 1;
    
    -- Check daily limit (ENFORCED HERE!)
    IF v_attempts_today >= v_max_daily THEN
        RETURN QUERY SELECT FALSE, 'Daily limit reached (' || v_attempts_today || '/' || v_max_daily || ')', v_attempts_today, v_total_attempts, v_last_attempt, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;
    
    -- Check total limit
    IF v_total_attempts >= v_max_total THEN
        RETURN QUERY SELECT FALSE, 'Total limit reached (' || v_total_attempts || '/' || v_max_total || ')', v_attempts_today, v_total_attempts, v_last_attempt, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;
    
    -- Check time window
    IF current_time < call_window_start OR current_time > call_window_end THEN
        RETURN QUERY SELECT FALSE, 'Outside calling window (' || call_window_start || '-' || call_window_end || ')', v_attempts_today, v_total_attempts, v_last_attempt, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;
    
    -- Check cooldown based on last call result
    IF v_last_attempt IS NOT NULL THEN
        CASE v_last_call_ended_reason
            WHEN 'customer-did-not-answer' THEN
                SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours
                FROM call_frequency_settings WHERE setting_name = 'no_pickup_cooldown_hours';
            WHEN 'twilio-failed-to-connect-call' THEN
                SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours
                FROM call_frequency_settings WHERE setting_name = 'failed_connection_cooldown_hours';
            WHEN 'customer-ended-call' THEN
                SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours
                FROM call_frequency_settings WHERE setting_name = 'customer_ended_cooldown_hours';
            ELSE
                SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours
                FROM call_frequency_settings WHERE setting_name = 'default_cooldown_hours';
        END CASE;
        
        IF v_cooldown_hours IS NULL THEN v_cooldown_hours := 24; END IF;
        
        IF v_last_attempt + INTERVAL '1 hour' * v_cooldown_hours > p_current_time THEN
            RETURN QUERY SELECT FALSE, 'Cooldown active (' || v_cooldown_hours || 'h after ' || v_last_call_ended_reason || ')', v_attempts_today, v_total_attempts, v_last_attempt, v_last_attempt + INTERVAL '1 hour' * v_cooldown_hours;
            RETURN;
        END IF;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT TRUE, 'Ready to call', v_attempts_today, v_total_attempts, v_last_attempt, NULL::TIMESTAMPTZ;
END;
$$; 