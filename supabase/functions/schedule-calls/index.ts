import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🕒 Cron trigger received')
    
    if (req.method === 'GET') {
      // GET endpoint to check next calling window
      const now = new Date()
      
      return new Response(JSON.stringify({
        success: true,
        current_time: now.toISOString(),
        current_status: getCurrentStatus(now),
        next_calling_window: getNextCallingWindow(now),
        schedule_info: {
          weekdays: {
            "8:15-8:45": "Every 5 minutes",
            "12:30-12:55": "Every 5 minutes", 
            "13:00-13:30": "Every 5 minutes",
            "17:00-17:30": "Every 5 minutes"
          },
          weekends: {
            "10:00-11:00": "Every 10 minutes",
            "13:00-14:00": "Every 10 minutes",
            "17:00-18:00": "Every 10 minutes"
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST method - check schedule and trigger calls
    // Allow ?test_time=2025-07-24T08:20:00Z for dry-run window checks
    const urlObj = new URL(req.url)
    const testTimeParam = urlObj.searchParams.get('test_time')
    const now = testTimeParam ? new Date(testTimeParam) : new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const dayOfWeek = now.getDay()
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    let shouldCall = false
    let scheduleReason = ''
    
    if (isWeekday) {
      // Weekday schedule
      if (hour === 8 && minute >= 15 && minute <= 45 && minute % 5 === 0) {
        shouldCall = true
        scheduleReason = 'Weekday morning calling window (8:15-8:45)'
      } else if (hour === 12 && minute >= 30 && minute <= 55 && minute % 5 === 0) {
        shouldCall = true
        scheduleReason = 'Weekday lunch calling window (12:30-12:55)'
      } else if (hour === 13 && minute >= 0 && minute <= 30 && minute % 5 === 0) {
        shouldCall = true
        scheduleReason = 'Weekday afternoon calling window (13:00-13:30)'
      } else if (hour === 17 && minute >= 0 && minute <= 30 && minute % 5 === 0) {
        shouldCall = true
        scheduleReason = 'Weekday evening calling window (17:00-17:30)'
      }
    } else if (isWeekend) {
      // Weekend schedule (FIXED LOGIC)
      if ((hour === 10) && minute % 10 === 0) { // 10:00, 10:10, ..., 10:50
        shouldCall = true
        scheduleReason = 'Weekend morning calling window (10:00-10:50)'
      } else if (hour === 11 && minute === 0) { // 11:00
        shouldCall = true
        scheduleReason = 'Weekend morning calling window (11:00)'
      } else if ((hour === 13) && minute % 10 === 0) { // 13:00, 13:10, ..., 13:50
        shouldCall = true
        scheduleReason = 'Weekend afternoon calling window (13:00-13:50)'
      } else if (hour === 14 && minute === 0) { // 14:00
        shouldCall = true
        scheduleReason = 'Weekend afternoon calling window (14:00)'
      } else if ((hour === 17) && minute % 10 === 0) { // 17:00, 17:10, ..., 17:50
        shouldCall = true
        scheduleReason = 'Weekend evening calling window (17:00-17:50)'
      } else if (hour === 18 && minute === 0) { // 18:00
        shouldCall = true
        scheduleReason = 'Weekend evening calling window (18:00)'
      }
    }
    
    if (!shouldCall) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Outside calling schedule',
        current_time: now.toISOString(),
        day_of_week: isWeekday ? 'weekday' : 'weekend',
        hour: hour,
        minute: minute,
        next_window: getNextCallingWindow(now)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`✅ Triggering calls: ${scheduleReason}`)
    
    // Trigger the actual calling process
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')
    // Pass batch_size so downstream uses the same value
    const { data: batchSetting } = await supabase
      .from('calling_settings')
      .select('setting_value')
      .eq('setting_name', 'batch_size')
      .single()
    const batchSize = parseInt(batchSetting?.setting_value?.value ?? '10', 10)

    const response = await fetch(`${baseUrl}/functions/v1/start-calling?batch_size=${batchSize}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`Calling process failed: ${response.status}`)
    }
    
    const result = await response.json()
    
    return new Response(JSON.stringify({
      success: true,
      message: `Scheduled calls triggered: ${scheduleReason}`,
      calling_result: result,
      triggered_at: now.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error in cron schedule:', error)
    return new Response(JSON.stringify({
      error: 'Cron execution failed', 
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function getCurrentStatus(now: Date): string {
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayOfWeek = now.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
  
  if (isWeekday) {
    if (hour === 8 && minute >= 15 && minute <= 45) return 'ACTIVE - Weekday morning window'
    if (hour === 12 && minute >= 30 && minute <= 55) return 'ACTIVE - Weekday lunch window'
    if (hour === 13 && minute >= 0 && minute <= 30) return 'ACTIVE - Weekday afternoon window'
    if (hour === 17 && minute >= 0 && minute <= 30) return 'ACTIVE - Weekday evening window'
  } else {
    if ((hour === 10 || hour === 11)) return 'ACTIVE - Weekend morning window'
    if ((hour === 13 || hour === 14)) return 'ACTIVE - Weekend afternoon window'  
    if ((hour === 17 || hour === 18)) return 'ACTIVE - Weekend evening window'
  }
  
  return 'INACTIVE - Outside calling windows'
}

function getNextCallingWindow(now: Date): string {
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
  
  if (isWeekday) {
    if (hour < 8) return 'Today 8:15 AM'
    if (hour < 12) return 'Today 12:30 PM'
    if (hour < 13) return 'Today 1:00 PM'
    if (hour < 17) return 'Today 5:00 PM'
    return 'Tomorrow 8:15 AM'
  } else {
    if (hour < 10) return 'Today 10:00 AM'
    if (hour < 13) return 'Today 1:00 PM'
    if (hour < 17) return 'Today 5:00 PM'
    return 'Tomorrow 10:00 AM'
  }
} 