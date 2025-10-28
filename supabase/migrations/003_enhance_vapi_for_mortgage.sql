-- Enhanced VAPI schema for Mortgage Outbound Campaign
-- Migration: 003_enhance_vapi_for_mortgage.sql

-- Add mortgage-specific columns to vapi_calls
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS call_picked_up BOOLEAN DEFAULT false;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS user_sentiment_score INTEGER CHECK (user_sentiment_score >= 1 AND user_sentiment_score <= 5);
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS key_details TEXT;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS do_not_call_again BOOLEAN DEFAULT false;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS follow_up_booked BOOLEAN DEFAULT false;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS campaign_id VARCHAR;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS lead_source VARCHAR;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS call_outcome VARCHAR;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS agent_notes TEXT;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS compliance_consent BOOLEAN DEFAULT false;

-- Create mortgage-specific lookup tables
CREATE TABLE IF NOT EXISTS vapi_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    daily_call_limit INTEGER,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vapi_call_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outcome_code VARCHAR UNIQUE NOT NULL,
    outcome_name VARCHAR NOT NULL,
    category VARCHAR NOT NULL, -- 'interested', 'not_qualified', 'callback', 'dnc', 'no_answer'
    description TEXT,
    requires_follow_up BOOLEAN DEFAULT false,
    is_successful BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default call outcomes for mortgage campaigns
INSERT INTO vapi_call_outcomes (outcome_code, outcome_name, category, requires_follow_up, is_successful) VALUES
('INTERESTED', 'Customer Interested', 'interested', true, true),
('QUALIFIED', 'Qualified Lead', 'interested', true, true),
('NOT_QUALIFIED', 'Not Qualified', 'not_qualified', false, false),
('CALLBACK_REQUESTED', 'Callback Requested', 'callback', true, false),
('FOLLOW_UP_SCHEDULED', 'Follow-up Scheduled', 'callback', true, true),
('NOT_INTERESTED', 'Not Interested', 'not_qualified', false, false),
('DO_NOT_CALL', 'Do Not Call Request', 'dnc', false, false),
('NO_ANSWER', 'No Answer', 'no_answer', false, false),
('VOICEMAIL', 'Left Voicemail', 'no_answer', false, false),
('WRONG_NUMBER', 'Wrong Number', 'not_qualified', false, false),
('HUNG_UP', 'Customer Hung Up', 'not_qualified', false, false),
('TECHNICAL_ISSUE', 'Technical Issue', 'failed', false, false)
ON CONFLICT (outcome_code) DO NOTHING;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_vapi_calls_campaign_id ON vapi_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_call_outcome ON vapi_calls(call_outcome);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_follow_up_date ON vapi_calls(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_do_not_call ON vapi_calls(do_not_call_again);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_lead_source ON vapi_calls(lead_source);

-- Enhanced analytics view for mortgage campaigns
CREATE OR REPLACE VIEW vapi_mortgage_analytics AS
SELECT 
    DATE(started_at) as call_date,
    campaign_id,
    lead_source,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE call_picked_up = true) as calls_picked_up,
    COUNT(*) FILTER (WHERE status = 'ended' AND (analysis->>'successful')::boolean = true) as successful_calls,
    COUNT(*) FILTER (WHERE follow_up_booked = true) as follow_ups_booked,
    COUNT(*) FILTER (WHERE do_not_call_again = true) as dnc_requests,
    ROUND(AVG(duration_seconds), 2) as avg_duration,
    SUM(cost_usd) as total_cost,
    ROUND(AVG(user_sentiment_score), 2) as avg_sentiment_score,
    COUNT(*) FILTER (WHERE call_outcome IN ('INTERESTED', 'QUALIFIED', 'FOLLOW_UP_SCHEDULED')) as qualified_leads,
    ROUND(
        (COUNT(*) FILTER (WHERE call_outcome IN ('INTERESTED', 'QUALIFIED', 'FOLLOW_UP_SCHEDULED'))::decimal / 
         NULLIF(COUNT(*), 0) * 100), 2
    ) as conversion_rate
FROM vapi_calls 
WHERE started_at IS NOT NULL
GROUP BY DATE(started_at), campaign_id, lead_source
ORDER BY call_date DESC, campaign_id;

-- Function to get campaign performance
CREATE OR REPLACE FUNCTION get_campaign_performance(
    p_campaign_id VARCHAR DEFAULT NULL,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    campaign_id VARCHAR,
    campaign_name VARCHAR,
    total_calls BIGINT,
    calls_picked_up BIGINT,
    qualified_leads BIGINT,
    conversion_rate DECIMAL,
    avg_call_duration DECIMAL,
    total_cost DECIMAL,
    dnc_requests BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vc.campaign_id,
        COALESCE(vcamp.name, vc.campaign_id) as campaign_name,
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE vc.call_picked_up = true) as calls_picked_up,
        COUNT(*) FILTER (WHERE vc.call_outcome IN ('INTERESTED', 'QUALIFIED', 'FOLLOW_UP_SCHEDULED')) as qualified_leads,
        ROUND(
            (COUNT(*) FILTER (WHERE vc.call_outcome IN ('INTERESTED', 'QUALIFIED', 'FOLLOW_UP_SCHEDULED'))::decimal / 
             NULLIF(COUNT(*), 0) * 100), 2
        ) as conversion_rate,
        ROUND(AVG(vc.duration_seconds), 2) as avg_call_duration,
        COALESCE(SUM(vc.cost_usd), 0) as total_cost,
        COUNT(*) FILTER (WHERE vc.do_not_call_again = true) as dnc_requests
    FROM vapi_calls vc
    LEFT JOIN vapi_campaigns vcamp ON vc.campaign_id = vcamp.campaign_id
    WHERE DATE(vc.started_at) BETWEEN start_date AND end_date
    AND (p_campaign_id IS NULL OR vc.campaign_id = p_campaign_id)
    GROUP BY vc.campaign_id, vcamp.name
    ORDER BY total_calls DESC;
END;
$$;

-- Function to get follow-up schedule
CREATE OR REPLACE FUNCTION get_follow_up_schedule(
    days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
    call_id VARCHAR,
    customer_name VARCHAR,
    phone_number VARCHAR,
    follow_up_date TIMESTAMPTZ,
    campaign_id VARCHAR,
    agent_notes TEXT,
    original_call_date TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vc.call_id,
        vc.customer_name,
        vc.phone_number,
        vc.follow_up_date,
        vc.campaign_id,
        vc.agent_notes,
        vc.started_at as original_call_date
    FROM vapi_calls vc
    WHERE vc.follow_up_booked = true
    AND vc.follow_up_date IS NOT NULL
    AND DATE(vc.follow_up_date) BETWEEN CURRENT_DATE AND CURRENT_DATE + (days_ahead || ' days')::INTERVAL
    ORDER BY vc.follow_up_date ASC;
END;
$$;

-- Update RLS policies for new tables
ALTER TABLE vapi_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE vapi_call_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaigns" ON vapi_campaigns 
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can view call outcomes" ON vapi_call_outcomes 
    FOR SELECT TO authenticated USING (true); 