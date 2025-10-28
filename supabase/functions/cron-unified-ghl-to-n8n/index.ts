import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ===========================================
// UNIFIED GHL TO N8N - 2 WEEK COOLDOWN VERSION
// Following the exact action plan blueprint
// ===========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 UNIFIED SCRIPT (2-WEEK COOLDOWN): Starting GHL → N8N flow...');
    
    // EXPLICIT DEBUG: Log all environment variables
    console.log('🔍 DEBUG: Environment Variables Check:');
    console.log('SUPABASE_URL exists:', !!Deno.env.get('SUPABASE_URL'));
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    console.log('GHL_API_KEY exists:', !!Deno.env.get('GHL_API_KEY'));
    console.log('SUPABASE_URL value:', Deno.env.get('SUPABASE_URL'));
    console.log('SUPABASE_SERVICE_ROLE_KEY first 20 chars:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 20));
    console.log('GHL_API_KEY first 20 chars:', Deno.env.get('GHL_API_KEY')?.substring(0, 20));
    
    // Check environment variables first (following action plan)
    const requiredEnvs = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      GHL_API_KEY: Deno.env.get('GHL_API_KEY')
    };
    
    for (const [key, value] of Object.entries(requiredEnvs)) {
      if (!value) {
        console.error(`❌ Missing environment variable: ${key}`);
        return new Response(JSON.stringify({ error: `Missing ${key}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log(`✅ ${key}: ${value.substring(0, 8)}...`);
    }
    
    // Get parameters
    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '5');
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const bypassCRON = url.searchParams.get('bypassCRON') === 'true' || url.searchParams.get('force') === 'true';
    const n8nWebhookUrl = url.searchParams.get('n8n_webhook_url') || 
                         'https://n8n.srv775533.hstgr.cloud/webhook/4dd32021-9932-4ce7-af28-b265759b4f72';
    
    console.log(`📊 Batch size: ${batchSize}, Dry run: ${dryRun}`);
    
    // Initialize Supabase client
    const supabase = createClient(
      requiredEnvs.SUPABASE_URL!,
      requiredEnvs.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // CRITICAL: Re-implement schedule check logic directly in this function
    console.log('⏰ Checking if we should be calling based on schedule (internal logic)...');

    const { data: settings, error: settingsError } = await supabase
      .from('calling_settings')
      .select('setting_name, setting_value');

    if (settingsError) {
      console.error('❌ Failed to fetch calling settings:', settingsError);
      throw new Error('Failed to fetch calling settings');
    }

    const timezone = settings.find(s => s.setting_name === 'timezone')?.setting_value?.value || 'Europe/London';
    const callingEnabled = settings.find(s => s.setting_name === 'calling_enabled')?.setting_value?.value === true;

    if (!callingEnabled && !bypassCRON) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Calling is currently disabled in settings'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // FULL SCHEDULE LOGIC: Replicate the SQL function's logic in TypeScript
    const { data: schedules, error: schedulesError } = await supabase
      .from('cron_schedules')
      .select('*')
      .eq('is_active', true);

    if (schedulesError) {
      console.error('❌ Failed to fetch cron schedules:', schedulesError);
      throw new Error('Failed to fetch cron schedules');
    }
    
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = now.getHours();
    const minute = now.getMinutes();

    let matchingSchedule = null;

    for (const s of schedules) {
      const dayTypeMatch = 
        (s.day_type === 'weekday' && dayOfWeek >= 1 && dayOfWeek <= 5) ||
        (s.day_type === 'weekend' && (dayOfWeek === 0 || dayOfWeek === 6)) ||
        (s.day_type === 'saturday' && dayOfWeek === 6) ||
        (s.day_type === 'sunday' && dayOfWeek === 0);

      if (dayTypeMatch) {
        const inTimeWindow = hour >= s.start_hour && hour <= s.end_hour;
        if (inTimeWindow) {
          const totalMinutesFromStart = (hour - s.start_hour) * 60 + (minute - s.start_minute);
          if (totalMinutesFromStart >= 0 && totalMinutesFromStart % s.interval_minutes === 0) {
            matchingSchedule = s;
            break; // Found the first matching schedule
          }
        }
      }
    }

    if (!matchingSchedule && !bypassCRON) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Outside scheduled calling hours',
        schedule_check: {
          should_call: false,
          current_time: new Date().toISOString(),
          checked_time_in_timezone: now.toISOString(),
          reason: 'No active schedule matched the current time'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (bypassCRON) {
      console.log('🟡 bypassCRON=true → skipping schedule checks and proceeding to send');
    }
    
    const scheduleLabel = (matchingSchedule && (matchingSchedule as any).name) || (bypassCRON ? 'bypassCRON (no schedule)' : 'unspecified');
    console.log(`✅ Within calling hours for schedule: "${scheduleLabel}"`);
    
    // Enforce remaining daily capacity before dequeuing
    console.log('📊 Checking remaining daily capacity...');

    const todayStr = new Date().toISOString().split('T')[0];

    // 1) Get max daily calls
    const { data: settingsData } = await supabase
      .from('calling_settings')
      .select('setting_value')
      .eq('setting_name', 'max_daily_calls')
      .single();

    let maxDailyCalls = 30;
    if (settingsData?.setting_value) {
      const sv: any = settingsData.setting_value;
      maxDailyCalls = typeof sv === 'number' ? sv : (sv?.value ?? 30);
    }

    // 2) Count outbound calls started today
    const { count: outboundCount } = await supabase
      .from('vapi_calls')
      .select('call_id', { count: 'exact', head: true })
      .eq('call_type', 'outbound')
      .gte('started_at', `${todayStr}T00:00:00.000Z`)
      .lte('started_at', `${todayStr}T23:59:59.999Z`);
    
    const outboundCompletedOrStarted = outboundCount ?? 0;

    // 3) Count current processing in queue (sent_to_n8n + calling)
    const { data: queueToday } = await supabase
      .from('daily_call_queue')
      .select('status')
      .eq('queue_date', todayStr);

    const statusCounts = (queueToday || []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const processingNow = (statusCounts['sent_to_n8n'] || 0) + (statusCounts['calling'] || 0);

    // 4) Compute remaining capacity
    const remainingCapacity = Math.max(0, maxDailyCalls - (outboundCompletedOrStarted + processingNow));
    console.log('📊 Capacity check:', { maxDailyCalls, outboundCompletedOrStarted, processingNow, remainingCapacity });

    if (remainingCapacity <= 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No remaining daily capacity. Skipping dequeue.',
        details: { maxDailyCalls, outboundCompletedOrStarted, processingNow }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Clamp batch size to remaining capacity
    const effectiveBatchSize = Math.max(0, Math.min(batchSize, remainingCapacity));
    if (effectiveBatchSize === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Effective batch size is zero after capacity clamp. Skipping dequeue.',
        details: { batchSize, remainingCapacity }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // NEW: Auto-reset stale 'sent_to_n8n' rows older than 15 minutes
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      // Reset where sent_to_n8n_at is older than threshold
      await supabase
        .from('daily_call_queue')
        .update({ status: 'pending', updated_at: new Date().toISOString(), skip_reason: 'stale_sent_to_n8n_auto_reset' })
        .eq('queue_date', todayStr)
        .eq('status', 'sent_to_n8n')
        .lt('sent_to_n8n_at', fifteenMinutesAgo);
      // Reset where sent_to_n8n_at is null but updated_at is old
      await supabase
        .from('daily_call_queue')
        .update({ status: 'pending', updated_at: new Date().toISOString(), skip_reason: 'stale_sent_to_n8n_auto_reset' })
        .eq('queue_date', todayStr)
        .eq('status', 'sent_to_n8n')
        .is('sent_to_n8n_at', null)
        .lt('updated_at', fifteenMinutesAgo);
      console.log('🧹 Stale sent_to_n8n cleanup executed');
    } catch (cleanupErr) {
      console.warn('⚠️ Stale sent_to_n8n cleanup failed:', cleanupErr);
    }

    // STEP 1: Get contacts from daily queue instead of GHL (respecting capacity)
    console.log('📞 STEP 1: Getting contacts from daily queue...');
    
    const { data: queueContacts, error: queueError } = await supabase
      .rpc('get_next_call_batch', {
        p_batch_size: effectiveBatchSize,
        p_queue_date: todayStr
      });
    
    if (queueError) {
      throw new Error(`Queue fetch error: ${queueError.message}`);
    }
    
    if (!queueContacts || queueContacts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending contacts in daily queue',
        contacts_to_call: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('🧾 QUEUE DEBUG:', {
      queue_count: queueContacts.length,
      sample: queueContacts[0] ? {
        contact_id: queueContacts[0].contact_id,
        phone: queueContacts[0]?.contact_data?.phone,
        status: queueContacts[0]?.status
      } : null
    });
    
    console.log(`✅ Retrieved ${queueContacts.length} contacts from daily queue`);
    
    // Transform queue data to match expected format
    const finalContacts = queueContacts.map(qc => ({
      id: qc.contact_id,
      phone: qc.contact_data.phone,
      firstName: qc.contact_data.firstName,
      firstNameLowerCase: qc.contact_data.firstName?.toLowerCase(),
      lastName: qc.contact_data.lastName,
      email: qc.contact_data.email,
      tags: qc.contact_data.tags || [],
      source: qc.contact_data.source,
      dateAdded: qc.contact_data.dateAdded,
      customFields: qc.contact_data.customFields || {},
      additionalPhones: qc.contact_data.additionalPhones || [],
      queue_id: qc.queue_id
    }));
    
    console.log(`✅ QUEUE SUCCESS: ${finalContacts.length} contacts ready to send`);
    
    // STEP 2: Double-check webhook deduplication (safety check)
    console.log('🚫 STEP 2: Final webhook deduplication check...');
    
    const contactIds = finalContacts.map(c => c.id);
    const { data: filteredIds, error: filterError } = await supabase
      .rpc('filter_recently_sent_contacts', {
        p_contact_ids: contactIds,
        p_webhook_url: n8nWebhookUrl,
        p_minutes_threshold: 30  // Increased to 30 minutes for queue system
      });
    
    if (filterError) {
      console.warn('⚠️ Webhook deduplication failed:', filterError);
    }
    
    const deduplicatedIds = filteredIds || contactIds;
    const deduplicatedContacts = finalContacts
      .filter(contact => deduplicatedIds.includes(contact.id))
      .slice(0, effectiveBatchSize);
    
    console.log('🧮 DEDUP DEBUG:', {
      input_ids: contactIds.length,
      filtered_ids: deduplicatedIds.length,
      final_contacts: deduplicatedContacts.length
    });
    
    console.log(`✅ Final contacts after webhook deduplication: ${deduplicatedContacts.length}`);
    console.log(`📊 QUEUE PROCESS: ${queueContacts.length} from queue → ${deduplicatedContacts.length} after deduplication`);
    
    if (deduplicatedContacts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'All contacts filtered out by webhook deduplication',
        queue_contacts: queueContacts.length,
        deduplicated: 0,
        contacts_to_call: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // STEP 3: Send to N8N
    return await sendContactsToN8N(deduplicatedContacts, n8nWebhookUrl, supabase, dryRun, '2week_cooldown');
    
  } catch (error) {
    console.error('💥 UNIFIED SCRIPT ERROR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}, { verifyJwt: false });

// Helper functions with timeout and parallel processing
async function fetchGHLContacts(apiKey: string, limit: number): Promise<any[]> {
  try {
    console.log(`📡 Fetching ${limit} contacts from GHL...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    // Note: GHL API doesn't support sortBy/sortOrder parameters
    // Will implement pagination-based variation instead
    const hour = new Date().getHours();
    const page = (hour % 3) + 1; // Rotate through pages 1, 2, 3 based on hour
    console.log(`📊 Using page: ${page} (hour: ${hour})`);
    
    const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: "w3EnlHbulBh4u124N5wd",
        page: page,                 // Rotate pages for variety
        pageLimit: limit,
        // Removed sortBy and sortOrder - not supported by GHL API
        filters: [
          {
            field: "customFields.49ed0UL01AXEugvJOfAm",
            operator: "not_exists"
          },
          {
            field: "tags",
            operator: "eq",
            value: "existing lead"
          }
        ]
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`GHL API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`📊 GHL API returned ${data.contacts?.length || 0} contacts`);
    return data.contacts || [];
    
  } catch (error) {
    console.error('❌ GHL fetch failed:', error);
    return [];
  }
}

async function sendContactsToN8N(contacts: any[], webhookUrl: string, supabase: any, dryRun: boolean, source: string): Promise<Response> {
  console.log(`🚀 Sending ${contacts.length} contacts to N8N (${source})...`);
  
  if (dryRun) {
    console.log('🧪 DRY RUN - Not actually sending to N8N');
    return new Response(JSON.stringify({
      success: true,
      message: `DRY RUN: Would send ${contacts.length} contacts with 2-WEEK cooldown`,
      source,
      cooldown_logic: '2-WEEK for: customer-ended-call, voicemail, assistant-ended-call',
      contacts_to_send: contacts.length,
      sample_contact: contacts[0] ? {
        id: contacts[0].id,
        firstName: contacts[0].firstNameLowerCase,
        email: contacts[0].email,
        phone: contacts[0].phone
      } : null,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const n8nPayload = {
    trigger: 'supabase_unified_2week_cooldown',
    source,
    cooldown_logic: '2-WEEK for: customer-ended-call, voicemail, assistant-ended-call',
    timestamp: new Date().toISOString(),
    batch_size: contacts.length,
    contacts: contacts.map(contact => ({
      id: contact.id,
      phone: contact.phone,
      firstName: contact.firstNameLowerCase || contact.firstName || '',
      firstNameLowerCase: contact.firstNameLowerCase || contact.firstName || '',
      lastName: contact.lastNameLowerCase || contact.lastName || '',
      email: contact.email || '',
      tags: contact.tags || [],
      source: contact.source || '',
      dateAdded: contact.dateAdded || '',
      customFields: contact.customFields || {},
      additionalPhones: contact.additionalPhones || []
    }))
  };
  
  try {
    console.log(`📡 Calling n8n webhook: ${webhookUrl}`);
    
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload)
    });
    
    console.log(`📊 n8n response status: ${n8nResponse.status}`);
    
    // Accept any 2xx status code as success (200, 201, 202, etc.)
    if (n8nResponse.status < 200 || n8nResponse.status >= 300) {
      const errorText = await n8nResponse.text();
      console.error('❌ n8n webhook failed:', errorText);
      throw new Error(`N8N webhook failed: ${n8nResponse.status} - ${errorText}`);
    }
    
    console.log('✅ n8n webhook successful!');
    
    // Record sent contacts
    const { error: recordError } = await supabase
      .rpc('record_sent_contacts', {
        p_contact_data: n8nPayload.contacts,  // Pass as jsonb directly, not JSON.stringify
        p_webhook_url: webhookUrl
      });
    
    if (recordError) {
      console.warn('⚠️ Failed to record sent contacts:', recordError);
    } else {
      console.log('✅ Recorded sent contacts in webhook cache');
    }
    
    console.log(`✅ Successfully sent ${contacts.length} contacts to N8N with 2-WEEK cooldown`);

    // NEW: Mark queue rows as 'calling' after successful webhook dispatch
    try {
      const phoneNumbers: string[] = contacts.map(c => String(c.phone));
      const todayStr = new Date().toISOString().split('T')[0];
      if (phoneNumbers.length > 0) {
        await supabase
          .from('daily_call_queue')
          .update({ status: 'calling', call_initiated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('queue_date', todayStr)
          .in('phone_number', phoneNumbers)
          .eq('status', 'sent_to_n8n');
        console.log('🔄 Updated queue status to calling for dispatched contacts');
      }
    } catch (queueMarkErr) {
      console.warn('⚠️ Failed to mark dispatched contacts as calling:', queueMarkErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Unified 2-WEEK cooldown complete: ${contacts.length} contacts sent`,
      source,
      cooldown_logic: '2-WEEK for: customer-ended-call, voicemail, assistant-ended-call',
      contacts_sent: contacts.length,
      n8n_response_status: n8nResponse.status,
      sample_contact: contacts[0] ? {
        id: contacts[0].id,
        firstName: contacts[0].firstNameLowerCase,
        email: contacts[0].email,
        phone: contacts[0].phone
      } : null,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ N8N send failed:', error);

    // NEW: Requeue contacts to pending if webhook fails
    try {
      const phoneNumbers: string[] = contacts.map(c => String(c.phone));
      const todayStr = new Date().toISOString().split('T')[0];
      if (phoneNumbers.length > 0) {
        await supabase
          .from('daily_call_queue')
          .update({ status: 'pending', updated_at: new Date().toISOString(), skip_reason: 'n8n_webhook_failed' })
          .eq('queue_date', todayStr)
          .in('phone_number', phoneNumbers)
          .eq('status', 'sent_to_n8n');
        console.log('↩️ Requeued contacts back to pending due to webhook failure');
      }
    } catch (requeueErr) {
      console.warn('⚠️ Failed to requeue contacts after webhook failure:', requeueErr);
    }

    throw error;
  }
}
