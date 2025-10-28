-- Call Frequency Management & Duplicate Prevention System
-- Migration: 004_call_frequency_management.sql
-- CRITICAL: Prevents duplicate calling and implements smart cooldowns

-- Call Attempts Tracking Table
CREATE TABLE IF NOT EXISTS call_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR NOT NULL,
    call_date DATE NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_call_status VARCHAR,
    last_ended_reason VARCHAR,
    cooldown_until TIMESTAMPTZ,
    do_not_call_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone_number, call_date)
);

-- Phone Number Call History (for long-term tracking)
CREATE TABLE IF NOT EXISTS phone_number_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR UNIQUE NOT NULL,
    total_attempts INTEGER DEFAULT 0,
    last_successful_call TIMESTAMPTZ,
    last_pickup_call TIMESTAMPTZ,
    permanent_dnc BOOLEAN DEFAULT false,
    dnc_reason VARCHAR,
    preferred_call_time JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Frequency Settings Table
CREATE TABLE IF NOT EXISTS call_frequency_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_name VARCHAR UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default frequency settings
INSERT INTO call_frequency_settings (setting_name, setting_value, description) VALUES
('default_cooldown_hours', '24', 'Default cooldown period in hours after any call attempt'),
('no_pickup_cooldown_hours', '72', 'Cooldown hours after no pickup (voicemail/no answer) - 3 DAYS'),
('failed_connection_cooldown_hours', '6', 'Cooldown hours after failed connection (Twilio failures)'),
('customer_ended_cooldown_hours', '168', 'Cooldown hours after customer ended call (7 days)'),
('max_attempts_per_day', '1', 'Maximum call attempts per phone number per day'),
('max_attempts_per_week', '3', 'Maximum call attempts per phone number per week'),
('max_total_attempts', '5', 'Maximum total attempts before permanent DNC'),
('call_window_start', '"09:00"', 'Daily calling window start time'),
('call_window_end', '"18:00"', 'Daily calling window end time'),
('enabled_days', '["monday","tuesday","wednesday","thursday","friday"]', 'Days of week when calling is allowed')
ON CONFLICT (setting_name) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_attempts_phone_date ON call_attempts(phone_number, call_date);
CREATE INDEX IF NOT EXISTS idx_call_attempts_cooldown ON call_attempts(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_call_attempts_phone_number ON call_attempts(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_history_number ON phone_number_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_history_dnc ON phone_number_history(permanent_dnc);

-- CRITICAL FUNCTION: Check if a phone number should be called
CREATE OR REPLACE FUNCTION should_call_phone_number(
    p_phone_number VARCHAR,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    can_call BOOLEAN,
    reason VARCHAR,
    cooldown_until TIMESTAMPTZ,
    attempts_today INTEGER,
    total_attempts INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_attempts_today INTEGER := 0;
    v_total_attempts INTEGER := 0;
    v_cooldown_until TIMESTAMPTZ;
    v_permanent_dnc BOOLEAN := false;
    v_max_daily INTEGER := 1;
    v_max_total INTEGER := 5;
    current_day VARCHAR;
    current_time TIME;
    call_window_start TIME := '09:00';
    call_window_end TIME := '18:00';
    enabled_days JSONB;
BEGIN
    -- Get settings
    SELECT (setting_value #>> '{}')::INTEGER INTO v_max_daily 
    FROM call_frequency_settings WHERE setting_name = 'max_attempts_per_day';
    
    SELECT (setting_value #>> '{}')::INTEGER INTO v_max_total 
    FROM call_frequency_settings WHERE setting_name = 'max_total_attempts';
    
    SELECT (setting_value #>> '{}')::TIME INTO call_window_start 
    FROM call_frequency_settings WHERE setting_name = 'call_window_start';
    
    SELECT (setting_value #>> '{}')::TIME INTO call_window_end 
    FROM call_frequency_settings WHERE setting_name = 'call_window_end';
    
    SELECT setting_value INTO enabled_days 
    FROM call_frequency_settings WHERE setting_name = 'enabled_days';
    
    -- Check current day and time
    current_day := lower(to_char(p_current_time, 'Day'));
    current_time := p_current_time::TIME;
    
    -- Check if permanent DNC
    SELECT COALESCE(permanent_dnc, false) INTO v_permanent_dnc 
    FROM phone_number_history 
    WHERE phone_number = p_phone_number;
    
    IF v_permanent_dnc THEN
        RETURN QUERY SELECT false, 'Permanent Do Not Call', NULL::TIMESTAMPTZ, 0, 0;
        RETURN;
    END IF;
    
    -- Check if day is enabled
    IF NOT (enabled_days ? trim(current_day)) THEN
        RETURN QUERY SELECT false, 'Outside calling days', NULL::TIMESTAMPTZ, 0, 0;
        RETURN;
    END IF;
    
    -- Check if within calling hours
    IF current_time < call_window_start OR current_time > call_window_end THEN
        RETURN QUERY SELECT false, 'Outside calling hours', NULL::TIMESTAMPTZ, 0, 0;
        RETURN;
    END IF;
    
    -- Get today's attempts and cooldown
    SELECT COALESCE(attempt_count, 0), cooldown_until 
    INTO v_attempts_today, v_cooldown_until
    FROM call_attempts 
    WHERE phone_number = p_phone_number 
    AND call_date = p_current_time::DATE;
    
    -- Get total attempts
    SELECT COALESCE(total_attempts, 0) INTO v_total_attempts
    FROM phone_number_history 
    WHERE phone_number = p_phone_number;
    
    -- Check cooldown (CRITICAL: 3+ day rule)
    IF v_cooldown_until IS NOT NULL AND v_cooldown_until > p_current_time THEN
        RETURN QUERY SELECT false, 'In cooldown period', v_cooldown_until, v_attempts_today, v_total_attempts;
        RETURN;
    END IF;
    
    -- Check daily limit (CRITICAL: max 1 per day)
    IF v_attempts_today >= v_max_daily THEN
        RETURN QUERY SELECT false, 'Daily limit reached', NULL::TIMESTAMPTZ, v_attempts_today, v_total_attempts;
        RETURN;
    END IF;
    
    -- Check total limit
    IF v_total_attempts >= v_max_total THEN
        RETURN QUERY SELECT false, 'Total limit reached', NULL::TIMESTAMPTZ, v_attempts_today, v_total_attempts;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT true, 'OK', NULL::TIMESTAMPTZ, v_attempts_today, v_total_attempts;
END;
$$;

-- CRITICAL FUNCTION: Record call attempt with smart cooldowns
CREATE OR REPLACE FUNCTION record_call_attempt(
    p_phone_number VARCHAR,
    p_call_status VARCHAR,
    p_ended_reason VARCHAR DEFAULT NULL,
    p_call_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_cooldown_hours INTEGER := 24;
    v_cooldown_until TIMESTAMPTZ;
BEGIN
    -- Smart cooldown based on ended reason (CRITICAL BUSINESS LOGIC)
    CASE 
        WHEN p_ended_reason IN ('customer-did-not-answer', 'voicemail', 'customer-busy') THEN
            SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours 
            FROM call_frequency_settings WHERE setting_name = 'no_pickup_cooldown_hours';
        WHEN p_ended_reason ILIKE '%twilio%' OR p_ended_reason ILIKE '%connection%' OR p_ended_reason ILIKE '%failed%' THEN
            SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours 
            FROM call_frequency_settings WHERE setting_name = 'failed_connection_cooldown_hours';
        WHEN p_ended_reason = 'customer-ended-call' THEN
            SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours 
            FROM call_frequency_settings WHERE setting_name = 'customer_ended_cooldown_hours';
        ELSE
            SELECT (setting_value #>> '{}')::INTEGER INTO v_cooldown_hours 
            FROM call_frequency_settings WHERE setting_name = 'default_cooldown_hours';
    END CASE;
    
    v_cooldown_until := p_call_time + (v_cooldown_hours || ' hours')::INTERVAL;
    
    -- Record call attempt
    INSERT INTO call_attempts (
        phone_number, call_date, attempt_count, last_attempt_at, 
        last_call_status, last_ended_reason, cooldown_until
    ) VALUES (
        p_phone_number, p_call_time::DATE, 1, p_call_time,
        p_call_status, p_ended_reason, v_cooldown_until
    )
    ON CONFLICT (phone_number, call_date) 
    DO UPDATE SET
        attempt_count = call_attempts.attempt_count + 1,
        last_attempt_at = p_call_time,
        last_call_status = p_call_status,
        last_ended_reason = p_ended_reason,
        cooldown_until = v_cooldown_until,
        updated_at = NOW();
    
    -- Update phone number history
    INSERT INTO phone_number_history (phone_number, total_attempts)
    VALUES (p_phone_number, 1)
    ON CONFLICT (phone_number)
    DO UPDATE SET
        total_attempts = phone_number_history.total_attempts + 1,
        last_successful_call = CASE 
            WHEN p_ended_reason = 'customer-ended-call' OR p_ended_reason = 'assistant-ended-call'
            THEN p_call_time 
            ELSE phone_number_history.last_successful_call 
        END,
        last_pickup_call = CASE 
            WHEN p_ended_reason NOT IN ('customer-did-not-answer', 'voicemail', 'customer-busy', 'twilio-failed-to-connect-call')
            THEN p_call_time 
            ELSE phone_number_history.last_pickup_call 
        END,
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- Function to get numbers ready to call (for n8n integration)
CREATE OR REPLACE FUNCTION get_numbers_ready_to_call(
    p_limit INTEGER DEFAULT 100,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    phone_number VARCHAR,
    can_call BOOLEAN,
    reason VARCHAR,
    priority_score INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH callable_numbers AS (
        SELECT 
            pnh.phone_number,
            (should_call_info).can_call,
            (should_call_info).reason,
            -- Priority scoring: less recent attempts = higher priority
            CASE 
                WHEN pnh.last_pickup_call IS NULL THEN 100
                WHEN pnh.last_successful_call IS NULL THEN 80
                ELSE 60 - EXTRACT(DAYS FROM (p_current_time - pnh.last_pickup_call))::INTEGER
            END as priority_score
        FROM phone_number_history pnh
        CROSS JOIN LATERAL should_call_phone_number(pnh.phone_number, p_current_time) as should_call_info
        WHERE pnh.permanent_dnc = false
    )
    SELECT 
        cn.phone_number,
        cn.can_call,
        cn.reason,
        cn.priority_score
    FROM callable_numbers cn
    WHERE cn.can_call = true
    ORDER BY cn.priority_score DESC, random()
    LIMIT p_limit;
END;
$$;

-- Enable RLS
ALTER TABLE call_frequency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_number_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage frequency settings" ON call_frequency_settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can manage call attempts" ON call_attempts FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can manage phone history" ON phone_number_history FOR ALL TO authenticated USING (true);

-- Trigger to automatically record call attempts when calls are synced
CREATE OR REPLACE FUNCTION trigger_record_call_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Record call attempt when a call is inserted or updated
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.phone_number IS NOT NULL AND NEW.status IS NOT NULL THEN
            PERFORM record_call_attempt(
                NEW.phone_number,
                NEW.status,
                NEW.ended_reason,
                COALESCE(NEW.started_at, NOW())
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- Create trigger on vapi_calls table to auto-record attempts
DROP TRIGGER IF EXISTS trigger_vapi_calls_record_attempt ON vapi_calls;
CREATE TRIGGER trigger_vapi_calls_record_attempt
    AFTER INSERT OR UPDATE ON vapi_calls
    FOR EACH ROW
    EXECUTE FUNCTION trigger_record_call_attempt(); 