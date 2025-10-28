import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VapiCustomer {
  name?: string;
  number: string;
}

interface VapiCall {
  id: string;
  assistantId?: string;
  phoneNumberId?: string;
  customer?: VapiCustomer;
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended' | 'failed';
  type: string;
  startedAt: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  analysis?: any;
  createdAt: string;
}

interface VapiAssistant {
  id: string;
  name: string;
  firstMessage?: string;
  model?: any;
  voice?: any;
  createdAt: string;
  updatedAt?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting VAPI automated sync...')

    const vapiApiKey = Deno.env.get('VAPI_API_KEY')
    if (!vapiApiKey) {
      throw new Error('VAPI_API_KEY not found in Edge Function secrets')
    }
    
    const authHeaders = {
      'Authorization': `Bearer ${vapiApiKey}`,
      'Content-Type': 'application/json'
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: logEntry, error: logError } = await supabase
      .from('vapi_sync_log')
      .insert({ status: 'running' })
      .select()
      .single()

    if (logError) throw new Error(`Failed to create sync log: ${logError.message}`)
    
    const logId = logEntry.id
    
    async function fetchAll(path: string) {
      const out = [];
      let page = 1;
      const pageSize = 1000; // VAPI's max limit is 1000
      while (true) {
        // The 'assistant' endpoint uses 'page', but 'call' does not. We'll handle this gracefully.
        const url = path === '/assistant' 
          ? `https://api.vapi.ai${path}?limit=${pageSize}&page=${page}`
          : `https://api.vapi.ai${path}?limit=${pageSize}`;

        console.log(`Fetching from ${url}`);
        const res = await fetch(url, { headers: authHeaders });
        const body = await res.text();

        if (!res.ok) {
          // If we get a 400 error for the 'call' endpoint, it's likely because we've fetched all records.
          // This is not ideal API design, but we can work with it.
          if (path === '/call' && res.status === 400 && body.includes("page")) {
             console.log("Likely end of records for /call endpoint. Breaking loop.");
             break;
          }
          throw new Error(`${path} failed with status ${res.status}: ${body}`);
        }

        const parsed = body ? JSON.parse(body) : [];
        const items = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
        
        if (!items.length) {
            console.log("No more items returned. Breaking loop.");
            break;
        }
        
        out.push(...items);

        // Only increment the page for the assistant endpoint, or if we assume other endpoints might support it.
        // For the /call endpoint, we will break after the first fetch since it doesn't support paging.
        if (path === '/call') {
            break;
        }
        page += 1;
      }
      return out;
    }

    let callsCount = 0
    let assistantsCount = 0

    try {
      // Fetch calls from VAPI API
      console.log('📞 Fetching last 100 calls from VAPI...')
      const callsResponse = await fetch('https://api.vapi.ai/call?limit=100', {
        headers: authHeaders,
      })

      if (!callsResponse.ok) {
        const errorBody = await callsResponse.text()
        throw new Error(`VAPI calls API error: ${callsResponse.status} ${callsResponse.statusText} - ${errorBody}`)
      }

      const callsData = await callsResponse.json()
      const calls: VapiCall[] = Array.isArray(callsData) ? callsData : callsData.data || []
      console.log(`✅ Fetched ${calls.length} calls from VAPI`)

      for (const call of calls) {
        const durationInSeconds = (call.startedAt && call.endedAt)
          ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
          : null

        const { error: callError } = await supabase
          .from('vapi_calls')
          .upsert({
            call_id: call.id,
            assistant_id: call.assistantId,
            phone_number: call.customer?.number,
            customer_name: call.customer?.name,
            call_type: call.type === 'inboundPhoneCall' ? 'inbound' : 
                      call.type === 'outboundPhoneCall' ? 'outbound' : 'unknown',
            status: call.status === 'forwarding' ? 'in-progress' : call.status,
            started_at: call.startedAt,
            ended_at: call.endedAt,
            duration_seconds: durationInSeconds,
            ended_reason: call.endedReason,
            cost_usd: call.cost,
            transcript: call.transcript ? { transcript: call.transcript } : null,
            recording_url: call.recordingUrl,
            analysis: call.analysis,
            created_at: call.createdAt, 
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'call_id'
          })

        if (callError) {
          console.warn(`⚠️ Error upserting call ${call.id}:`, callError)
        } else {
          callsCount++

          // Sync queue status for outbound calls to avoid stuck 'sent_to_n8n'
          try {
            if (call.type === 'outboundPhoneCall' && call.customer?.number && call.startedAt) {
              const callDate = new Date(call.startedAt).toISOString().split('T')[0]
              const phone = call.customer.number

              // Map VAPI call status to queue status
              let queueStatus: 'calling' | 'completed' | 'failed' | null = null
              if (call.status === 'ringing' || call.status === 'in-progress' || call.status === 'forwarding') {
                queueStatus = 'calling'
              } else if (call.status === 'ended') {
                queueStatus = 'completed'
              } else if (call.status === 'failed') {
                queueStatus = 'failed'
              }

              if (queueStatus) {
                const { error: qErr } = await supabase
                  .from('daily_call_queue')
                  .update({ status: queueStatus, updated_at: new Date().toISOString() })
                  .eq('queue_date', callDate)
                  .eq('phone_number', phone)
                  .in('status', ['sent_to_n8n', 'calling'])

                if (qErr) {
                  console.warn(`⚠️ Failed to sync queue status for ${phone} on ${callDate}:`, qErr)
                } else {
                  console.log(`🔄 Queue status set to '${queueStatus}' for ${phone} on ${callDate}`)
                }
              }
            }
          } catch (queueSyncErr) {
            console.warn('⚠️ Queue status sync error:', queueSyncErr)
          }
        }
      }

      // Fetch assistants from VAPI API
      console.log('🤖 Fetching last 1000 assistants from VAPI...')
      const assistantsResponse = await fetch('https://api.vapi.ai/assistant?limit=1000', {
        headers: authHeaders,
      })

      if (!assistantsResponse.ok) {
        const errorBody = await assistantsResponse.text()
        throw new Error(`VAPI assistants API error: ${assistantsResponse.status} ${assistantsResponse.statusText} - ${errorBody}`)
      }

      const assistantsData = await assistantsResponse.json()
      const assistants: VapiAssistant[] = Array.isArray(assistantsData) ? assistantsData : assistantsData.data || []
      console.log(`✅ Fetched ${assistants.length} assistants from VAPI`)

      for (const assistant of assistants) {
        const { error: assistantError } = await supabase
          .from('vapi_assistants')
          .upsert({
            assistant_id: assistant.id,
            name: assistant.name,
            first_message: assistant.firstMessage,
            model: assistant.model?.model || 'unknown',
            voice: assistant.voice?.voiceId || 'unknown',
            is_active: true,
            created_at: assistant.createdAt,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'assistant_id'
          })

        if (assistantError) {
          console.warn(`⚠️ Error upserting assistant ${assistant.id}:`, assistantError)
        } else {
          assistantsCount++
        }
      }

      await supabase
        .from('vapi_sync_log')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          calls_synced: callsCount,
          assistants_synced: assistantsCount
        })
        .eq('id', logId)

      console.log(`🎉 Sync completed successfully: ${callsCount} calls, ${assistantsCount} assistants`)

      return new Response(
        JSON.stringify({
          success: true,
          calls_synced: callsCount,
          assistants_synced: assistantsCount,
          log_id: logId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (e) {
      const error = e as Error;
      console.error('❌ Sync failed:', error)
      await supabase
        .from('vapi_sync_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', logId)

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          log_id: logId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

  } catch (e) {
    const error = e as Error;
    console.error('❌ Edge Function error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}, { verifyJwt: false }) 
