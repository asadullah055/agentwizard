-- Add Call Analysis Fields to match n8n system output
-- Migration: 023_add_call_analysis_fields.sql

-- Analysis Processing Status
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS ai_analysis_status VARCHAR DEFAULT 'pending' 
    CHECK (ai_analysis_status IN ('pending', 'processing', 'completed', 'failed'));

-- Tool Call Analysis (from n8n Code node)
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS tool_calls_successful INTEGER DEFAULT 0;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS tool_calls_failed INTEGER DEFAULT 0;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS tool_calls_warnings INTEGER DEFAULT 0;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS tool_calls_no_result INTEGER DEFAULT 0;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS tool_calls_total INTEGER DEFAULT 0;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS tool_calls_analysis JSONB;

-- Business Intelligence (from AI analysis)
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS key_details TEXT;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS user_sentiment VARCHAR 
    CHECK (user_sentiment IN ('Positive', 'Neutral', 'Negative', ''));
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS asked_explicitly_to_not_call_again BOOLEAN DEFAULT false;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS call_with_agent_booked BOOLEAN DEFAULT false;

-- Business Success Metrics
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS call_business_successful BOOLEAN;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS business_success_reason TEXT;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS conversation_quality_score INTEGER CHECK (conversation_quality_score BETWEEN 1 AND 10);

-- Follow-up Classification
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS follow_up_type VARCHAR CHECK (follow_up_type IN (
    'explicit_request', 'mortgage_midterm', 'mortgage_expiry', 
    'failed_call_retry', 'agent_booking_followup', 'general_followup'
));
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS follow_up_reason TEXT;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS follow_up_urgency VARCHAR DEFAULT 'medium' 
    CHECK (follow_up_urgency IN ('high', 'medium', 'low'));

-- Analysis Processing Metadata
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS ai_analysis_processed_at TIMESTAMPTZ;
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS ai_analysis_prompt_version VARCHAR DEFAULT 'v1.0';
ALTER TABLE vapi_calls ADD COLUMN IF NOT EXISTS processing_error_message TEXT;

-- Indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_vapi_calls_analysis_status ON vapi_calls(ai_analysis_status);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_follow_up_date ON vapi_calls(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_user_sentiment ON vapi_calls(user_sentiment);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_business_successful ON vapi_calls(call_business_successful); 