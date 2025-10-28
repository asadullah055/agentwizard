-- Migration: 20250801140000_enhance_contact_call_history.sql
-- Purpose: Enhanced contact call history function that integrates multiple contact data sources

-- Enhanced function to get contact call history with comprehensive contact data
CREATE OR REPLACE FUNCTION get_contact_call_history()
RETURNS TABLE (
    phone_number VARCHAR,
    contact_name VARCHAR,
    contact_id VARCHAR,
    email VARCHAR,
    ghl_tags TEXT[],
    total_calls BIGINT,
    first_call_date TIMESTAMPTZ,
    last_call_date TIMESTAMPTZ,
    last_call_outcome VARCHAR,
    successful_calls BIGINT,
    call_outcomes JSONB,
    contact_source VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH contact_enrichment AS (
        -- Get the most comprehensive contact data from multiple sources
        SELECT DISTINCT ON (vc.phone_number)
            vc.phone_number,
            -- Contact name from multiple sources (prioritized)
            COALESCE(
                -- From recent queue data (most up-to-date)
                dcq.contact_data->>'firstName' || ' ' || COALESCE(dcq.contact_data->>'lastName', ''),
                -- From vapi_calls metadata
                vc.metadata->>'contact_name',
                vc.metadata->>'name',
                vc.customer_name,
                -- From metadata fields
                vc.metadata->>'firstName' || ' ' || COALESCE(vc.metadata->>'lastName', ''),
                'Unknown Contact'
            ) as contact_name,
            -- Contact ID from queue or metadata
            COALESCE(
                dcq.contact_id,
                vc.metadata->>'contact_id',
                vc.metadata->>'id'
            ) as contact_id,
            -- Email from queue or metadata
            COALESCE(
                dcq.contact_data->>'email',
                vc.metadata->>'email'
            ) as email,
            -- Tags from queue data
            CASE 
                WHEN dcq.contact_data->>'tags' IS NOT NULL 
                THEN ARRAY(SELECT jsonb_array_elements_text(dcq.contact_data->'tags'))
                ELSE NULL
            END as ghl_tags,
            -- Source priority: queue > metadata > phone_history
            CASE 
                WHEN dcq.contact_id IS NOT NULL THEN 'queue'
                WHEN vc.metadata IS NOT NULL THEN 'call_metadata'
                ELSE 'phone_only'
            END as contact_source
        FROM public.vapi_calls vc
        LEFT JOIN public.daily_call_queue dcq ON vc.phone_number = dcq.phone_number
        WHERE vc.status = 'ended'
        ORDER BY vc.phone_number, 
                 dcq.created_at DESC NULLS LAST,
                 vc.created_at DESC
    ),
    call_summary AS (
        SELECT 
            ce.phone_number,
            ce.contact_name,
            ce.contact_id,
            ce.email,
            ce.ghl_tags,
            ce.contact_source,
            COUNT(vc.*) as total_calls,
            MIN(vc.started_at) as first_call_date,
            MAX(vc.started_at) as last_call_date,
            -- Get the most recent call outcome
            (ARRAY_AGG(vc.ended_reason ORDER BY vc.started_at DESC))[1] as last_call_outcome,
            -- Count successful calls (customer or assistant ended)
            COUNT(*) FILTER (WHERE vc.ended_reason IN ('customer-ended-call', 'assistant-ended-call')) as successful_calls
        FROM contact_enrichment ce
        JOIN public.vapi_calls vc ON ce.phone_number = vc.phone_number
        WHERE vc.status = 'ended'
        GROUP BY ce.phone_number, ce.contact_name, ce.contact_id, ce.email, ce.ghl_tags, ce.contact_source
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
                    'assistant', COALESCE(va.name, 'Unknown Assistant'),
                    'call_id', vc.call_id,
                    'cost', vc.cost_usd,
                    'recording_url', vc.recording_url
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
        cs.contact_id,
        cs.email,
        cs.ghl_tags,
        cs.total_calls,
        cs.first_call_date,
        cs.last_call_date,
        cs.last_call_outcome,
        cs.successful_calls,
        cd.call_outcomes,
        cs.contact_source
    FROM call_summary cs
    LEFT JOIN call_details cd ON cs.phone_number = cd.phone_number
    ORDER BY cs.last_call_date DESC;
END;
$$;

-- Function to get contact details for a specific phone number
CREATE OR REPLACE FUNCTION get_contact_by_phone(p_phone_number VARCHAR)
RETURNS TABLE (
    phone_number VARCHAR,
    contact_name VARCHAR,
    contact_id VARCHAR,
    email VARCHAR,
    ghl_tags TEXT[],
    contact_source VARCHAR,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH contact_sources AS (
        -- Get contact data from daily_call_queue (most recent)
        SELECT 
            dcq.phone_number,
            dcq.contact_data->>'firstName' || ' ' || COALESCE(dcq.contact_data->>'lastName', '') as contact_name,
            dcq.contact_id,
            dcq.contact_data->>'email' as email,
            CASE 
                WHEN dcq.contact_data->>'tags' IS NOT NULL 
                THEN ARRAY(SELECT jsonb_array_elements_text(dcq.contact_data->'tags'))
                ELSE NULL
            END as ghl_tags,
            'queue' as contact_source,
            dcq.contact_data as metadata,
            dcq.created_at as source_date
        FROM public.daily_call_queue dcq
        WHERE dcq.phone_number = p_phone_number
        
        UNION ALL
        
        -- Get contact data from vapi_calls metadata
        SELECT 
            vc.phone_number,
            COALESCE(
                vc.metadata->>'contact_name',
                vc.metadata->>'name',
                vc.customer_name,
                vc.metadata->>'firstName' || ' ' || COALESCE(vc.metadata->>'lastName', '')
            ) as contact_name,
            COALESCE(
                vc.metadata->>'contact_id',
                vc.metadata->>'id'
            ) as contact_id,
            vc.metadata->>'email' as email,
            NULL::TEXT[] as ghl_tags,
            'call_metadata' as contact_source,
            vc.metadata,
            vc.created_at as source_date
        FROM public.vapi_calls vc
        WHERE vc.phone_number = p_phone_number 
          AND (vc.metadata IS NOT NULL OR vc.customer_name IS NOT NULL)
    )
    SELECT DISTINCT ON (cs.phone_number)
        cs.phone_number,
        cs.contact_name,
        cs.contact_id,
        cs.email,
        cs.ghl_tags,
        cs.contact_source,
        cs.metadata
    FROM contact_sources cs
    ORDER BY cs.phone_number, cs.source_date DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_contact_call_history() TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_call_history() TO anon;
GRANT EXECUTE ON FUNCTION get_contact_by_phone(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_by_phone(VARCHAR) TO anon; 