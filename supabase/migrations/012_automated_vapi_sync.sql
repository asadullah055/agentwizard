-- Migration: Automated VAPI Sync System
-- This eliminates the need for frontend sync buttons

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create VAPI sync log table for monitoring
CREATE TABLE IF NOT EXISTS vapi_sync_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    calls_synced INTEGER DEFAULT 0,
    assistants_synced INTEGER DEFAULT 0,
    error_message TEXT,
    response_data JSONB
);

-- Function to sync VAPI data automatically
CREATE OR REPLACE FUNCTION sync_vapi_data_automated()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
    vapi_api_key TEXT;
    vapi_response JSON;
    calls_count INTEGER := 0;
    assistants_count INTEGER := 0;
    call_record RECORD;
    assistant_record RECORD;
BEGIN
    -- Create sync log entry
    INSERT INTO vapi_sync_log (status) 
    VALUES ('running') 
    RETURNING id INTO log_id;

    -- Get VAPI API key from vault
    SELECT decrypted_secret INTO vapi_api_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'VAPI_API_KEY';

    IF vapi_api_key IS NULL THEN
        UPDATE vapi_sync_log 
        SET status = 'failed', 
            completed_at = NOW(),
            error_message = 'VAPI_API_KEY not found in vault'
        WHERE id = log_id;
        
        RETURN json_build_object(
            'success', false,
            'error', 'VAPI_API_KEY not configured',
            'log_id', log_id
        );
    END IF;

    BEGIN
        -- Fetch calls from VAPI API using pg_net
        SELECT INTO vapi_response 
            content::json
        FROM http((
            'GET',
            'https://api.vapi.ai/call',
            ARRAY[
                http_header('Authorization', 'Bearer ' || vapi_api_key),
                http_header('Content-Type', 'application/json')
            ],
            NULL,
            NULL
        )::http_request);

        -- Process VAPI calls (with deduplication)
        FOR call_record IN 
            SELECT * FROM json_to_recordset(vapi_response->'data') AS x(
                id TEXT,
                "assistantId" TEXT,
                "phoneNumberId" TEXT,
                type TEXT,
                "startedAt" TEXT,
                "endedAt" TEXT,
                "endedReason" TEXT,
                cost NUMERIC,
                transcript TEXT,
                "recordingUrl" TEXT,
                summary TEXT,
                analysis JSONB,
                "artifactId" TEXT
            )
        LOOP
            -- Insert with conflict resolution (upsert)
            INSERT INTO vapi_calls (
                call_id, assistant_id, phone_number_id, call_type,
                started_at, ended_at, ended_reason, cost_usd,
                transcript, recording_url, summary, analysis,
                created_at, updated_at
            ) VALUES (
                call_record.id,
                call_record."assistantId",
                call_record."phoneNumberId",
                CASE 
                    WHEN call_record.type = 'inboundPhoneCall' THEN 'inbound'
                    WHEN call_record.type = 'outboundPhoneCall' THEN 'outbound'
                    ELSE 'unknown'
                END,
                call_record."startedAt"::TIMESTAMPTZ,
                call_record."endedAt"::TIMESTAMPTZ,
                call_record."endedReason",
                call_record.cost,
                call_record.transcript,
                call_record."recordingUrl",
                call_record.summary,
                call_record.analysis,
                NOW(),
                NOW()
            )
            ON CONFLICT (call_id) 
            DO UPDATE SET
                ended_at = EXCLUDED.ended_at,
                ended_reason = EXCLUDED.ended_reason,
                cost_usd = EXCLUDED.cost_usd,
                transcript = EXCLUDED.transcript,
                recording_url = EXCLUDED.recording_url,
                summary = EXCLUDED.summary,
                analysis = EXCLUDED.analysis,
                updated_at = NOW();
            
            calls_count := calls_count + 1;
        END LOOP;

        -- Fetch and sync assistants
        SELECT INTO vapi_response 
            content::json
        FROM http((
            'GET',
            'https://api.vapi.ai/assistant',
            ARRAY[
                http_header('Authorization', 'Bearer ' || vapi_api_key),
                http_header('Content-Type', 'application/json')
            ],
            NULL,
            NULL
        )::http_request);

        -- Process assistants
        FOR assistant_record IN 
            SELECT * FROM json_to_recordset(vapi_response->'data') AS x(
                id TEXT,
                name TEXT,
                "firstMessage" TEXT,
                model JSONB,
                voice JSONB,
                "createdAt" TEXT,
                "updatedAt" TEXT
            )
        LOOP
            INSERT INTO vapi_assistants (
                assistant_id, name, first_message, model_config,
                voice_config, created_at, updated_at
            ) VALUES (
                assistant_record.id,
                assistant_record.name,
                assistant_record."firstMessage",
                assistant_record.model,
                assistant_record.voice,
                assistant_record."createdAt"::TIMESTAMPTZ,
                NOW()
            )
            ON CONFLICT (assistant_id) 
            DO UPDATE SET
                name = EXCLUDED.name,
                first_message = EXCLUDED.first_message,
                model_config = EXCLUDED.model_config,
                voice_config = EXCLUDED.voice_config,
                updated_at = NOW();
            
            assistants_count := assistants_count + 1;
        END LOOP;

        -- Update sync log with success
        UPDATE vapi_sync_log 
        SET status = 'success',
            completed_at = NOW(),
            calls_synced = calls_count,
            assistants_synced = assistants_count
        WHERE id = log_id;

        RETURN json_build_object(
            'success', true,
            'calls_synced', calls_count,
            'assistants_synced', assistants_count,
            'log_id', log_id
        );

    EXCEPTION WHEN OTHERS THEN
        -- Update sync log with failure
        UPDATE vapi_sync_log 
        SET status = 'failed',
            completed_at = NOW(),
            error_message = SQLERRM
        WHERE id = log_id;
        
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'log_id', log_id
        );
    END;
END;
$$;

-- Schedule the sync to run every 15 minutes
SELECT cron.schedule(
    'vapi-auto-sync',
    '*/15 * * * *',  -- Every 15 minutes
    'SELECT sync_vapi_data_automated();'
);

-- Create function to get sync status
CREATE OR REPLACE FUNCTION get_vapi_sync_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    latest_sync RECORD;
    sync_stats RECORD;
BEGIN
    -- Get latest sync attempt
    SELECT * INTO latest_sync
    FROM vapi_sync_log 
    ORDER BY started_at DESC 
    LIMIT 1;

    -- Get sync statistics for last 24 hours
    SELECT 
        COUNT(*) as total_syncs,
        COUNT(*) FILTER (WHERE status = 'success') as successful_syncs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
        AVG(calls_synced) FILTER (WHERE status = 'success') as avg_calls_synced
    INTO sync_stats
    FROM vapi_sync_log 
    WHERE started_at > NOW() - INTERVAL '24 hours';

    RETURN json_build_object(
        'latest_sync', row_to_json(latest_sync),
        'stats_24h', row_to_json(sync_stats),
        'next_scheduled_sync', 'Every 15 minutes via pg_cron'
    );
END;
$$;

-- Grant necessary permissions
ALTER FUNCTION sync_vapi_data_automated() OWNER TO postgres;
ALTER FUNCTION get_vapi_sync_status() OWNER TO postgres;

COMMENT ON FUNCTION sync_vapi_data_automated() IS 'Automatically syncs VAPI data every 15 minutes via pg_cron';
COMMENT ON FUNCTION get_vapi_sync_status() IS 'Returns status of automated VAPI sync operations'; 