-- Migration: 20250801130000_add_contact_call_history_function.sql
-- Purpose: Add the get_contact_call_history function that properly joins with assistant data

-- Function to get contact call history with assistant names
CREATE OR REPLACE FUNCTION get_contact_call_history()
RETURNS TABLE (
    phone_number VARCHAR,
    contact_name VARCHAR,
    total_calls BIGINT,
    first_call_date TIMESTAMPTZ,
    last_call_date TIMESTAMPTZ,
    last_call_outcome VARCHAR,
    successful_calls BIGINT,
    call_outcomes JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH call_summary AS (
        SELECT 
            vc.phone_number,
            -- Extract contact name from metadata if available
            COALESCE(
                vc.metadata->>'contact_name',
                vc.metadata->>'name',
                NULL
            ) as contact_name,
            COUNT(*) as total_calls,
            MIN(vc.started_at) as first_call_date,
            MAX(vc.started_at) as last_call_date,
            -- Get the most recent call outcome
            (ARRAY_AGG(vc.ended_reason ORDER BY vc.started_at DESC))[1] as last_call_outcome,
            -- Count successful calls (customer or assistant ended)
            COUNT(*) FILTER (WHERE vc.ended_reason IN ('customer-ended-call', 'assistant-ended-call')) as successful_calls
        FROM public.vapi_calls vc
        WHERE vc.status = 'ended'
        GROUP BY vc.phone_number, contact_name
    ),
    call_details AS (
        SELECT 
            vc.phone_number,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'date', vc.started_at,
                    'outcome', vc.ended_reason,
                    'duration', COALESCE(vc.duration_seconds, 0),
                    'picked_up', vc.ended_reason NOT IN ('customer-did-not-answer', 'voicemail', 'customer-busy', 'twilio-failed-to-connect-call'),
                    'assistant', COALESCE(va.name, 'Unknown Assistant')
                ) ORDER BY vc.started_at DESC
            ) as call_outcomes
        FROM public.vapi_calls vc
        LEFT JOIN public.vapi_assistants va ON vc.assistant_id = va.assistant_id
        WHERE vc.status = 'ended'
        GROUP BY vc.phone_number
    )
    SELECT 
        cs.phone_number,
        cs.contact_name,
        cs.total_calls,
        cs.first_call_date,
        cs.last_call_date,
        cs.last_call_outcome,
        cs.successful_calls,
        cd.call_outcomes
    FROM call_summary cs
    LEFT JOIN call_details cd ON cs.phone_number = cd.phone_number
    ORDER BY cs.last_call_date DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_contact_call_history() TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_call_history() TO anon; 