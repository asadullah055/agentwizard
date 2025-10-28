-- Migration: 20250801150000_add_contact_enhancement_cron.sql
-- Purpose: Set up CRON job for contact enhancement

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a scheduled job to enhance contact data every 30 minutes
-- This calls our edge function to process 10 contacts at a time
SELECT cron.schedule(
    'enhance-contact-data', -- job name
    '*/30 * * * *',         -- every 30 minutes
    $$
    SELECT
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/enhance-contact-data',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
        ),
        body := jsonb_build_object(
          'trigger', 'cron',
          'timestamp', extract(epoch from now())
        )
      );
    $$
);

-- Alternative: Create a simpler CRON that calls a stored procedure
-- This approach works if the above doesn't work due to environment variables

-- Create a stored procedure for contact enhancement
CREATE OR REPLACE FUNCTION enhance_contacts_batch()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    -- This function will be called by CRON
    -- For now, it just logs the execution
    INSERT INTO public.cron_logs (job_name, executed_at, status)
    VALUES ('enhance-contact-data', NOW(), 'triggered')
    ON CONFLICT DO NOTHING;
    
    -- Return a simple result
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Contact enhancement scheduled',
        'timestamp', extract(epoch from now())
    );
END;
$$;

-- Create a table to log CRON executions (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alternative CRON job that calls the stored procedure
SELECT cron.schedule(
    'enhance-contact-data-simple', -- job name
    '*/30 * * * *',                -- every 30 minutes
    'SELECT enhance_contacts_batch();'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION enhance_contacts_batch() TO authenticated;
GRANT EXECUTE ON FUNCTION enhance_contacts_batch() TO anon;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_name_date ON public.cron_logs(job_name, executed_at DESC);

-- Optional: Create a view to see recent CRON executions
CREATE OR REPLACE VIEW public.cron_status AS
SELECT 
    job_name,
    COUNT(*) as total_executions,
    MAX(executed_at) as last_execution,
    COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '24 hours') as executions_last_24h
FROM public.cron_logs
GROUP BY job_name
ORDER BY last_execution DESC; 