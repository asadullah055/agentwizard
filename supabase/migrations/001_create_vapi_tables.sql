-- VAPI Call Center Analytics Database Schema
-- Migration: 001_create_vapi_tables.sql

-- VAPI calls table - stores all call logs and details
CREATE TABLE vapi_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id VARCHAR UNIQUE NOT NULL,
    phone_number VARCHAR,
    customer_name VARCHAR,
    assistant_id VARCHAR,
    status VARCHAR NOT NULL CHECK (status IN ('queued', 'ringing', 'in-progress', 'forwarding', 'ended', 'failed')),
    call_type VARCHAR CHECK (call_type IN ('inbound', 'outbound')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    cost_usd DECIMAL(10,4),
    transcript JSONB,
    analysis JSONB,
    recording_url VARCHAR,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VAPI assistants table - manages AI assistants/agents
CREATE TABLE vapi_assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    model JSONB,
    voice JSONB,
    first_message VARCHAR,
    system_message TEXT,
    functions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VAPI webhook events table - audit trail for all webhook events
CREATE TABLE vapi_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR NOT NULL,
    call_id VARCHAR,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- VAPI analytics table - cached daily metrics for performance
CREATE TABLE vapi_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    avg_duration_seconds DECIMAL(8,2),
    total_cost_usd DECIMAL(10,4) DEFAULT 0,
    avg_sentiment_score DECIMAL(3,2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

-- Create indexes for optimal query performance
CREATE INDEX idx_vapi_calls_call_id ON vapi_calls(call_id);
CREATE INDEX idx_vapi_calls_status ON vapi_calls(status);
CREATE INDEX idx_vapi_calls_started_at ON vapi_calls(started_at);
CREATE INDEX idx_vapi_calls_assistant_id ON vapi_calls(assistant_id);
CREATE INDEX idx_vapi_calls_phone_number ON vapi_calls(phone_number);
CREATE INDEX idx_vapi_analytics_date ON vapi_analytics(date);
CREATE INDEX idx_vapi_webhook_events_call_id ON vapi_webhook_events(call_id);
CREATE INDEX idx_vapi_webhook_events_event_type ON vapi_webhook_events(event_type);

-- Enable Row Level Security (RLS)
ALTER TABLE vapi_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vapi_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vapi_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vapi_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to access all VAPI data
CREATE POLICY "Users can view VAPI calls" ON vapi_calls 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert VAPI calls" ON vapi_calls 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update VAPI calls" ON vapi_calls 
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete VAPI calls" ON vapi_calls 
    FOR DELETE TO authenticated USING (true);

-- Similar policies for other tables
CREATE POLICY "Users can manage assistants" ON vapi_assistants 
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can view webhook events" ON vapi_webhook_events 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert webhook events" ON vapi_webhook_events 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view analytics" ON vapi_analytics 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage analytics" ON vapi_analytics 
    FOR ALL TO authenticated USING (true); 