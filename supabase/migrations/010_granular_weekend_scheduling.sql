-- Migration: 010_granular_weekend_scheduling.sql
-- Add support for granular weekend scheduling (Saturday only, Sunday only)

-- Update the day_type constraint to include new options
ALTER TABLE cron_schedules DROP CONSTRAINT IF EXISTS cron_schedules_day_type_check;
ALTER TABLE cron_schedules ADD CONSTRAINT cron_schedules_day_type_check 
    CHECK (day_type IN ('weekday', 'weekend', 'saturday', 'sunday'));

-- Update the function that checks which schedules should run
CREATE OR REPLACE FUNCTION should_call_now()
RETURNS TABLE (
    should_call BOOLEAN,
    current_schedule JSONB,
    calling_enabled JSONB,
    active_schedules JSONB
) LANGUAGE plpgsql AS $$
DECLARE
    current_time TIMESTAMPTZ;
    current_day_of_week INTEGER; -- 0=Sunday, 1=Monday, ..., 6=Saturday  
    current_hour INTEGER;
    current_minute INTEGER;
    timezone_setting TEXT := 'Europe/London';
    calling_enabled_setting JSONB;
    matching_schedule RECORD;
    all_schedules JSONB;
BEGIN
    -- Get timezone from settings, expecting a JSONB object like {"value": "Europe/London"}
    SELECT setting_value INTO timezone_setting 
    FROM calling_settings 
    WHERE setting_name = 'timezone' 
    LIMIT 1;
    
    -- Convert to specified timezone by extracting the value from JSON
    current_time := NOW() AT TIME ZONE COALESCE(timezone_setting ->> 'value', 'Europe/London');
    current_day_of_week := EXTRACT(DOW FROM current_time)::INTEGER;
    current_hour := EXTRACT(HOUR FROM current_time)::INTEGER;
    current_minute := EXTRACT(MINUTE FROM current_time)::INTEGER;
    
    -- Get calling enabled setting
    SELECT setting_value INTO calling_enabled_setting
    FROM calling_settings 
    WHERE setting_name = 'calling_enabled' 
    LIMIT 1;
    
    -- Get all active schedules
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'description', description,
            'day_type', day_type,
            'start_hour', start_hour,
            'start_minute', start_minute,
            'end_hour', end_hour,
            'end_minute', end_minute,
            'interval_minutes', interval_minutes
        )
    ) INTO all_schedules
    FROM cron_schedules 
    WHERE is_active = true;
    
    -- Check if calling is enabled
    IF NOT COALESCE((calling_enabled_setting #>> '{value,value}')::BOOLEAN, 
                   (calling_enabled_setting #>> '{value}')::BOOLEAN, 
                   FALSE) THEN
        RETURN QUERY SELECT FALSE, NULL::JSONB, calling_enabled_setting, all_schedules;
        RETURN;
    END IF;
    
    -- Find matching schedule based on current time and day
    FOR matching_schedule IN 
        SELECT * FROM cron_schedules 
        WHERE is_active = true
        AND current_hour >= start_hour 
        AND current_hour <= end_hour
        AND CASE 
            -- Handle start/end minute logic
            WHEN start_hour = end_hour THEN 
                current_minute >= start_minute AND current_minute <= end_minute
            WHEN current_hour = start_hour THEN 
                current_minute >= start_minute
            WHEN current_hour = end_hour THEN 
                current_minute <= end_minute
            ELSE TRUE
        END
        AND (
            -- CORRECTED: Unified interval logic.
            -- Calculates total minutes from the schedule's start time and checks if it's a multiple
            -- of the interval. This works correctly across hour boundaries.
            ((current_hour - start_hour) * 60 + (current_minute - start_minute)) % interval_minutes = 0
        )
        AND CASE day_type
            -- UPDATED: Handle granular weekend scheduling
            WHEN 'weekday' THEN current_day_of_week BETWEEN 1 AND 5
            WHEN 'weekend' THEN current_day_of_week IN (0, 6)  -- Both Saturday and Sunday
            WHEN 'saturday' THEN current_day_of_week = 6        -- Saturday only
            WHEN 'sunday' THEN current_day_of_week = 0          -- Sunday only
            ELSE FALSE
        END
        ORDER BY 
            -- Priority: more specific day types first
            CASE day_type
                WHEN 'saturday' THEN 1
                WHEN 'sunday' THEN 1  
                WHEN 'weekday' THEN 2
                WHEN 'weekend' THEN 3
                ELSE 4
            END,
            start_hour, start_minute
        LIMIT 1
    LOOP
        -- Found a matching schedule
        RETURN QUERY SELECT 
            TRUE,
            jsonb_build_object(
                'id', matching_schedule.id,
                'name', matching_schedule.name,
                'description', matching_schedule.description,
                'day_type', matching_schedule.day_type,
                'current_time', current_time,
                'day_of_week', current_day_of_week,
                'hour', current_hour,
                'minute', current_minute,
                'interval_minutes', matching_schedule.interval_minutes
            ),
            calling_enabled_setting,
            all_schedules;
        RETURN;
    END LOOP;
    
    -- No matching schedule found
    RETURN QUERY SELECT FALSE, NULL::JSONB, calling_enabled_setting, all_schedules;
    RETURN;
END;
$$;

-- Add helper function to get human-readable day type descriptions
CREATE OR REPLACE FUNCTION get_day_type_description(day_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE day_type
        WHEN 'weekday' THEN 'Weekdays (Mon-Fri)'
        WHEN 'weekend' THEN 'Weekends (Sat & Sun)'
        WHEN 'saturday' THEN 'Saturdays Only'
        WHEN 'sunday' THEN 'Sundays Only'
        ELSE 'Unknown'
    END;
$$;

-- Update any existing weekend schedules with a note about the new options
-- (This is optional - existing 'weekend' schedules will continue to work for both days)

COMMENT ON COLUMN cron_schedules.day_type IS 
'Schedule day type: weekday (Mon-Fri), weekend (Sat&Sun), saturday (Sat only), sunday (Sun only)';

-- Create an index for better performance on schedule lookups
CREATE INDEX IF NOT EXISTS idx_cron_schedules_day_type_active 
ON cron_schedules(day_type, is_active) WHERE is_active = true; 