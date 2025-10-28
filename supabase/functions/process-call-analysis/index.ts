// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Webhook endpoints
const CUSTOMER_ENGAGEMENT_WEBHOOK_URL = 'https://n8n.srv775533.hstgr.cloud/webhook/848b9a9c-f0f6-4236-9bc4-9e10f214f98d'
const ERROR_WEBHOOK_URL = CUSTOMER_ENGAGEMENT_WEBHOOK_URL

interface CallAnalysisResult {
  key_details: string
  user_sentiment: string
  asked_explicitly_to_NOT_call_again: string | boolean
  follow_up_date: string
  call_with_agent_booked: string | boolean
}

interface ToolCallSummary {
  total: number
  successes: number
  warnings: number
  errors: number
  no_result: number
}

interface ProcessingResult {
  call_id: string
  status: 'success' | 'error'
  sentiment?: string
  follow_up_date?: string | null
  error?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🤖 Starting call analysis processing...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Optional override: accept specific call_ids to process
    let overrideCallIds: string[] = []
    try {
      const body = await req.json()
      if (body && Array.isArray(body.call_ids)) {
        overrideCallIds = body.call_ids.map((v: unknown) => String(v)).filter(Boolean)
      }
    } catch (_) {
      // no body or invalid JSON; ignore
    }

    // Fetch unprocessed calls - handle NULL or 'pending'
    const { data: pendingCalls, error: fetchError } = overrideCallIds.length > 0
      ? await supabase
          .from('vapi_calls')
          .select('*')
          .in('call_id', overrideCallIds)
          .not('transcript', 'is', null)
      : await supabase
      .from('vapi_calls')
      .select('*')
      .or('ai_analysis_status.is.null,ai_analysis_status.eq.pending')
      .not('transcript', 'is', null)
      .not('ended_reason', 'is', null)
      .order('ended_at', { ascending: true })
      .limit(5) // Process fewer calls for parallel processing

    if (fetchError) {
      throw new Error(`Failed to fetch calls: ${fetchError.message}`)
    }

    if (!pendingCalls || pendingCalls.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending calls to process',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📋 Found ${pendingCalls.length} calls to process`)

    // Process calls in parallel for better performance
    const processingPromises = pendingCalls.map(async (call) => {
      try {
        console.log(`🔄 Processing call ${call.call_id}...`)

        // Mark as processing
        await supabase
          .from('vapi_calls')
          .update({ ai_analysis_status: 'processing' })
          .eq('call_id', call.call_id)

        // 1. Extract tool calls (replicate n8n Code node logic)
        const toolCallAnalysis = extractToolCalls(call.transcript)

        // 1.1 Derive booking/calendar attempt & success flags from tool calls
        let callsArr = Array.isArray(toolCallAnalysis.calls)
          ? (toolCallAnalysis.calls as Array<Record<string, unknown>>)
          : []
        // Fallback: if no calls extracted from transcript, use existing stored analysis if present
        if (callsArr.length === 0 && Array.isArray((call as Record<string, unknown>)?.tool_calls_analysis)) {
          callsArr = ((call as Record<string, unknown>).tool_calls_analysis as unknown[])
            .filter(Boolean)
            .map(c => c as Record<string, unknown>)
        }
        const calendarCalls = callsArr.filter(c => String(c.name) === 'get_calendar_availability')
        const bookingCalls = callsArr.filter(c => String(c.name) === 'book_ghl_slot')
        const engagementTools = callsArr.filter(c => String(c.name) !== 'end_call')

        // If we used fallback callsArr, recompute summary to keep counts consistent
        const usedFallback = (Array.isArray(toolCallAnalysis.calls) ? toolCallAnalysis.calls as unknown[] : []).length === 0 && callsArr.length > 0
        const derivedSummary = usedFallback ? {
          total: callsArr.length,
          successes: callsArr.filter(c => String(c.status) === 'success').length,
          warnings: callsArr.filter(c => String(c.status) === 'warning').length,
          errors: callsArr.filter(c => String(c.status) === 'error').length,
          no_result: callsArr.filter(c => String(c.status) === 'no_result').length
        } : null

        const calendar_check_attempted = calendarCalls.length > 0
        const booking_attempted = bookingCalls.length > 0
        const calendar_checked_success = calendarCalls.some(c => String(c.status) === 'success')
        const booking_attempt_success = bookingCalls.some(c => String(c.status) === 'success')
        
        // 2. Run AI analysis with retry logic (replicate n8n AI prompt)
        const aiAnalysis = await runAIAnalysisWithRetry(call.transcript, toolCallAnalysis)
        
        // 3. Calculate follow-up logic
        const followUpData = calculateFollowUp(aiAnalysis, call.ended_at)
        
        // 4. Update database with results
        // Derive a stable call_outcome from existing fields so downstream reports are consistent
        const callOutcomeDerived = String((call as Record<string, unknown>)?.call_outcome 
          ?? (call as Record<string, unknown>)?.ended_reason 
          ?? (call as Record<string, unknown>)?.status 
          ?? '').trim()

        const updateData = {
          ai_analysis_status: 'completed',
          ai_analysis_processed_at: new Date().toISOString(),
          ai_analysis_prompt_version: 'v11', // Updated version with improvements
          
          // Tool call analysis
          tool_calls_total: derivedSummary ? derivedSummary.total : toolCallAnalysis.total,
          tool_calls_successful: derivedSummary ? derivedSummary.successes : toolCallAnalysis.successes,
          tool_calls_warnings: derivedSummary ? derivedSummary.warnings : toolCallAnalysis.warnings,
          tool_calls_failed: derivedSummary ? derivedSummary.errors : toolCallAnalysis.errors,
          tool_calls_no_result: derivedSummary ? derivedSummary.no_result : toolCallAnalysis.no_result,
          tool_calls_analysis: callsArr,

          // Derived attempt/success flags
          calendar_check_attempted,
          booking_attempted,
          calendar_checked_success,
          booking_attempt_success,
          
          // AI analysis results
          key_details: aiAnalysis.key_details,
          user_sentiment: aiAnalysis.user_sentiment,
          // Persist derived outcome for reporting (fallback to null if empty)
          call_outcome: callOutcomeDerived || null,
          asked_explicitly_to_not_call_again: Boolean(aiAnalysis.asked_explicitly_to_NOT_call_again),
          call_with_agent_booked: Boolean(aiAnalysis.call_with_agent_booked),
          
          // Follow-up data (handle empty strings properly)
          follow_up_date: followUpData.date || null,
          follow_up_type: followUpData.type,
          follow_up_reason: followUpData.reason,
          follow_up_urgency: followUpData.urgency,
          
          // Business metrics
          call_business_successful: determineBusinessSuccess(aiAnalysis, toolCallAnalysis),
          conversation_quality_score: calculateQualityScore(aiAnalysis, call)
        }

        const { error: updateError } = await supabase
          .from('vapi_calls')
          .update(updateData)
          .eq('call_id', call.call_id)

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`)
        }

        // 4.5. Update queue status from 'sent_to_n8n' to 'completed' for outbound calls only
        if (call.call_type === 'outbound' && call.phone_number) {
          try {
            const callDate = new Date(call.started_at).toISOString().split('T')[0]
            const { error: queueUpdateError } = await supabase
              .from('daily_call_queue')
              .update({ status: 'completed' })
              .eq('phone_number', call.phone_number)
              .eq('queue_date', callDate)
              .eq('status', 'sent_to_n8n')

            if (queueUpdateError) {
              console.error(`⚠️ Failed to update queue status for call ${call.call_id}:`, queueUpdateError)
            } else {
              console.log(`🔄 Updated queue status to 'completed' for ${call.phone_number} on ${callDate}`)
            }
          } catch (queueError) {
            console.error(`⚠️ Error updating queue status for call ${call.call_id}:`, queueError)
            // Don't fail the entire process if queue update fails
          }
        }

        // 5. Send customer engagement webhook for ANY tool call (excluding end_call), regardless of success
        if (engagementTools.length > 0) {
          try {
            const result = await sendCustomerEngagementWebhook(call, toolCallAnalysis, aiAnalysis, engagementTools)
            await recordWebhookLog(supabase, String(call.call_id), CUSTOMER_ENGAGEMENT_WEBHOOK_URL, result.payload, 'sent', null)
            console.log(`📬 Customer engagement webhook sent for call ${call.call_id}`)
          } catch (webhookError) {
            console.error(`⚠️ Failed to send engagement webhook for call ${call.call_id}:`, webhookError)
            try {
              await recordWebhookLog(supabase, String(call.call_id), CUSTOMER_ENGAGEMENT_WEBHOOK_URL, { error: String((webhookError as Error)?.message || webhookError) }, 'failed', String((webhookError as Error)?.message || webhookError))
            } catch (logErr) {
              console.warn('⚠️ Failed to record webhook failure:', logErr)
            }
            // Don't fail the entire process if webhook fails
          }
        }

        // 5.1 If end_call tool exists and is error/no_result, send an error webhook
        const endCall = callsArr.find(c => String(c.name) === 'end_call') as Record<string, unknown> | undefined
        if (endCall && ['error', 'no_result'].includes(String(endCall.status))) {
          try {
            const errRes = await sendErrorWebhook(call, endCall, toolCallAnalysis)
            await recordWebhookLog(supabase, String(call.call_id), ERROR_WEBHOOK_URL, errRes.payload, 'sent', null)
            console.log(`📬 Error webhook sent for call ${call.call_id}`)
          } catch (errHook) {
            console.error(`⚠️ Failed to send error webhook for call ${call.call_id}:`, errHook)
            try {
              await recordWebhookLog(supabase, String(call.call_id), ERROR_WEBHOOK_URL, { error: String((errHook as Error)?.message || errHook) }, 'failed', String((errHook as Error)?.message || errHook))
            } catch (logErr) {
              console.warn('⚠️ Failed to record error webhook failure:', logErr)
            }
          }
        }

        return {
          call_id: call.call_id,
          status: 'success' as const,
          sentiment: aiAnalysis.user_sentiment,
          follow_up_date: followUpData.date
        }

      } catch (error) {
        console.error(`❌ Error processing call ${call.call_id}:`, error)
        
        // Mark as failed
        await supabase
          .from('vapi_calls')
          .update({
            ai_analysis_status: 'failed',
            processing_error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('call_id', call.call_id)

        return {
          call_id: call.call_id,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Wait for all parallel processing to complete
    const results = await Promise.all(processingPromises)
    console.log(`✅ Completed parallel processing of ${results.length} calls`)

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Replicate the exact n8n Code node logic
function extractToolCalls(transcript: unknown): ToolCallSummary & { calls: unknown[] } {
  const msgs = Array.isArray((transcript as Record<string, unknown>)?.messages) 
    ? (transcript as Record<string, unknown>).messages as unknown[]
    : Array.isArray(transcript) 
    ? transcript as unknown[]
    : []

  // Collect invocations
  const invocations: { msg: unknown; call: unknown }[] = []
  msgs.forEach((m: unknown) => {
    const message = m as Record<string, unknown>
    const callsArr = message.toolCalls || message.tool_calls
    if (Array.isArray(callsArr) && callsArr.length) {
      callsArr.forEach((c: unknown) => invocations.push({ msg: m, call: c }))
    }
  })

  // Match invocations with results
  const calls = invocations.map(({ call }) => {
    const callObj = call as Record<string, unknown>
    const id = callObj.id || callObj.tool_call_id
    const name = (callObj.function as Record<string, unknown>)?.name || callObj.name || 'unknown'
    const args = (callObj.function as Record<string, unknown>)?.arguments || callObj.arguments || null

    const resMsg = msgs.find((r: unknown) => {
      const result = r as Record<string, unknown>
      return (result.role === 'tool_call_result' && result.toolCallId === id) ||
             (result.role === 'tool' && result.tool_call_id === id)
    })

    let status = 'no_result'
    let resText: string | null = null

    if (resMsg) {
      const resultMsg = resMsg as Record<string, unknown>
      resText = String(resultMsg.result || resultMsg.content || '').trim()

      const isEmptyJson = ['', '{}', '[]'].includes(resText)
      if (isEmptyJson) {
        status = 'success'
      } else if (resText === 'No result returned.') {
        status = 'no_result'
      } else {
        try {
          const parsed = JSON.parse(resText)
          status = (parsed as Record<string, unknown>).error ? 'error' : 'warning'
        } catch {
          status = 'warning'
        }
      }
    }

    return {
      tool_call_id: id,
      name,
      arguments: args,
      result_content: resText,
      status
    }
  })

  // Generate summary
  const summary = {
    total: calls.length,
    successes: calls.filter(c => c.status === 'success').length,
    warnings: calls.filter(c => c.status === 'warning').length,
    errors: calls.filter(c => c.status === 'error').length,
    no_result: calls.filter(c => c.status === 'no_result').length,
    calls
  }

  return summary
}

// AI Analysis with retry logic for API timeouts
async function runAIAnalysisWithRetry(transcript: unknown, toolCalls: unknown, maxRetries: number = 3): Promise<CallAnalysisResult> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 AI Analysis attempt ${attempt}/${maxRetries}`)
      return await runAIAnalysis(transcript, toolCalls, true)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`⚠️ AI Analysis attempt ${attempt} failed:`, lastError.message)

      // Targeted fallback: if the error is due to the json_object response_format requirement,
      // retry ONCE immediately without response_format while still requesting JSON output.
      const needsJsonFormatFallback = /must contain the word 'json'.*response_format.*json_object/i.test(lastError.message)
      if (needsJsonFormatFallback) {
        try {
          console.log('↩️ Retrying analysis without response_format (json_object) due to API constraint...')
          return await runAIAnalysis(transcript, toolCalls, false)
        } catch (fallbackError) {
          lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
          console.warn('⚠️ Fallback without response_format also failed:', lastError.message)
        }
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff, max 10s
        console.log(`⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('AI Analysis failed after all retries')
}

async function runAIAnalysis(transcript: unknown, toolCalls: unknown, useJsonResponseFormat: boolean): Promise<CallAnalysisResult> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const transcriptText = extractTranscriptText(transcript)
  const toolCallsJson = JSON.stringify(toolCalls, null, 2)
  
  const prompt = `# You are analyzing a call transcript from **Clark Mortgages** - a UK mortgage advisory service.

IMPORTANT: Respond with a single valid json object only. Do not include any explanations or extra text.

## ANALYSIS GOALS
1. Extract mortgage-specific information accurately
2. Determine customer sentiment and engagement level  
3. Calculate precise follow-up dates for mortgage renewals
4. Identify if human advisor booking occurred

## MORTGAGE INFORMATION TO EXTRACT
Look for these specific details and include in key_details:
- **Current mortgage rate** (e.g., "2.5%", "fixed at 3.2%")
- **Rate type** (fixed rate, variable rate, tracker, discounted)
- **Deal end/expiry date** (when current rate ends)
- **Property value** and **outstanding balance** 
- **Monthly payments** and any affordability concerns
- **Reason for calling** (remortgage, purchase, rate review)
- **Lender name** (Nationwide, Halifax, Barclays, etc.)
- **Employment/income changes** affecting affordability

## SENTIMENT ANALYSIS
Rate customer reception as:
- **Positive**: Engaged, asking questions, providing details, willing to discuss
- **Neutral**: Polite but brief, limited engagement  
- **Negative**: Hostile, hung up quickly, explicitly refused service
- **Leave BLANK**: If call went to voicemail

## FOLLOW-UP DATE RULES (UK MORTGAGE MARKET)
**ONLY set follow_up_date if specific mortgage details are provided:**

1. **Fixed Rate Mortgages**: 
   - Set 6 months before expiry (standard review timing)
   - If rate expires within 6 months: Set for 2-4 weeks from today

2. **Variable/Tracker Rates**: Set for 3-6 months (market review timing)

3. **Recent Purchases**: Set for 18-24 months (when initial deals typically end)

**LEAVE BLANK** if:
- No specific mortgage details discussed
- Customer explicitly refused service  
- Call was just general inquiry without personal details

Today's date: ${new Date().toISOString().split('T')[0]}

## FIELDS TO RETURN
• **key_details** – One sentence (≤ 250 characters) with MORTGAGE DETAILS ONLY: rate, term, balance, expiry date, property value, lender, employment status, urgency, callback preferences. If NO mortgage information discussed, say exactly "no mortgage information spoken about"

• **asked_explicitly_to_NOT_call_again** – true if prospect clearly asked for no further contact (e.g. "Take me off your list"); otherwise false.

## OUTPUT SCHEMA

{
  "key_details": "<summary of all useful mortgage details here>",
  "user_sentiment": "Positive, Neutral, Negative",
  "asked_explicitly_to_NOT_call_again": false,
  "follow_up_date": "",
  "call_with_agent_booked": false
}

TOOL CALLS SUMMARY
${JSON.stringify((toolCalls as Record<string, unknown>).summary || {})}

TOOL CALLS DETAILED:
${toolCallsJson}

TRANSCRIPT:
${transcriptText}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
      ...(useJsonResponseFormat ? { response_format: { type: 'json_object' as const } } : {})
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as Record<string, unknown>
  const choices = data.choices as Record<string, unknown>[]
  const message = choices?.[0]?.message as Record<string, unknown>
  const content = message?.content as string

  console.log('🔍 Raw OpenAI response:', content)

  try {
    const result = JSON.parse(String(content)) as Record<string, unknown>
    return {
      key_details: String(result.key_details || ''),
      user_sentiment: String(result.user_sentiment || ''),
      asked_explicitly_to_NOT_call_again: result.asked_explicitly_to_NOT_call_again === 'true' || result.asked_explicitly_to_NOT_call_again === true,
      follow_up_date: String(result.follow_up_date || ''),
      call_with_agent_booked: result.call_with_agent_booked === 'true' || result.call_with_agent_booked === true
    }
  } catch (error) {
    console.error('❌ Failed to parse JSON response:', content)
    throw new Error(`Invalid JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function extractTranscriptText(transcript: unknown): string {
  if (typeof transcript === 'string') return transcript
  
  const transcriptObj = transcript as Record<string, unknown>
  if (transcriptObj?.messages && Array.isArray(transcriptObj.messages)) {
    return transcriptObj.messages
      .filter((m: unknown) => {
        const msg = m as Record<string, unknown>
        return msg.role === 'user' || msg.role === 'assistant'
      })
      .map((m: unknown) => {
        const msg = m as Record<string, unknown>
        return `${msg.role}: ${msg.content}`
      })
      .join('\n')
  }
  
  return JSON.stringify(transcript)
}

function calculateFollowUp(analysis: CallAnalysisResult, callEndedAt: string) {
  if (analysis.call_with_agent_booked) {
    return {
      type: 'agent_booking_followup',
      reason: 'Follow up on scheduled agent appointment',
      urgency: 'high',
      date: null
    }
  }

  if (analysis.asked_explicitly_to_NOT_call_again) {
    return {
      type: null,
      reason: 'Customer requested no further contact',
      urgency: null,
      date: null
    }
  }

  if (analysis.follow_up_date) {
    return {
      type: 'mortgage_expiry',
      reason: 'Mortgage-based follow-up',
      urgency: 'medium',
      date: analysis.follow_up_date
    }
  }

  // Default retry for failed calls
  const retryDate = new Date(callEndedAt)
  retryDate.setDate(retryDate.getDate() + 21) // 3 weeks
  
  return {
    type: 'failed_call_retry',
    reason: 'Standard retry for unsuccessful call',
    urgency: 'low',
    date: retryDate.toISOString().split('T')[0]
  }
}

function determineBusinessSuccess(analysis: CallAnalysisResult, toolCalls: unknown): boolean {
  // Success if agent booking or good sentiment with mortgage details
  const agentBooked = Boolean(analysis.call_with_agent_booked && analysis.call_with_agent_booked !== '' && analysis.call_with_agent_booked !== 'false')
  return agentBooked || 
         (analysis.user_sentiment === 'Positive' && analysis.key_details !== 'no mortgage information spoken about')
}

function calculateQualityScore(analysis: CallAnalysisResult, call: Record<string, unknown>): number {
  let score = 5 // Base score
  
  if (analysis.user_sentiment === 'Positive') score += 3
  else if (analysis.user_sentiment === 'Negative') score -= 2
  
  if (analysis.call_with_agent_booked) score += 2
  if (analysis.key_details && analysis.key_details !== 'no mortgage information spoken about') score += 1
  if (analysis.asked_explicitly_to_NOT_call_again) score -= 3
  
  return Math.max(1, Math.min(10, score))
}

async function sendCustomerEngagementWebhook(
  call: Record<string, unknown>, 
  toolCallAnalysis: any, 
  aiAnalysis: CallAnalysisResult, 
  engagementTools: any[]
): Promise<{ payload: Record<string, unknown> }> {
  
  // Calculate engagement level
  let engagementLevel = 'low'
  if (aiAnalysis.call_with_agent_booked) {
    engagementLevel = 'very_high'
  } else if (toolCallAnalysis.total >= 5 || (toolCallAnalysis.total >= 2 && aiAnalysis.user_sentiment === 'Positive')) {
    engagementLevel = 'high'
  } else if (toolCallAnalysis.total >= 2) {
    engagementLevel = 'medium'
  }

  // Extract tool function names from engagement tools
  const toolFunctionsUsed = engagementTools.map((tool: any) => tool.name)

  // Format call date/time
  const startedAt = new Date(call.started_at as string)
  const callDate = startedAt.toISOString().split('T')[0]
  const callTime = startedAt.toTimeString().split(' ')[0]

  const payload = {
    event_type: 'customer_engagement_detected',
    trigger_reason: `Customer showed engagement with ${engagementTools.length} tool calls`,
    customer_data: {
      call_id: call.call_id,
      customer_name: call.customer_name,
      phone_number: call.phone_number,
      call_date: callDate,
      call_time: callTime,
      tool_calls_total: toolCallAnalysis.total,
      tool_calls_successful: toolCallAnalysis.successes,
      engagement_level: engagementLevel,
      key_details: aiAnalysis.key_details,
      user_sentiment: aiAnalysis.user_sentiment,
      call_with_agent_booked: aiAnalysis.call_with_agent_booked,
      tool_functions_used: toolFunctionsUsed,
      transcript: call.transcript
    },
    metadata: {
      timestamp: new Date().toISOString(),
      analysis_version: 'v1.2_enhanced_tool_calls',
      webhook_version: 'v1.0',
      source: 'clark_mortgages_call_analysis'
    }
  }

  console.log(`📤 Sending customer engagement webhook for call ${call.call_id}:`, {
    engagement_level: engagementLevel,
    tool_functions_used: toolFunctionsUsed,
    engagement_tools_count: engagementTools.length
  })

  const response = await fetch(CUSTOMER_ENGAGEMENT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Clark-Mortgages-Analysis/1.0'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} - ${await response.text()}`)
  }

  console.log(`✅ Customer engagement webhook sent successfully for call ${call.call_id}`)
  return { payload }
} 

async function sendErrorWebhook(
  call: Record<string, unknown>,
  endCall: Record<string, unknown>,
  toolCallAnalysis: any
): Promise<{ payload: Record<string, unknown> }> {
  const startedAt = new Date(call.started_at as string)
  const callDate = startedAt.toISOString().split('T')[0]
  const callTime = startedAt.toTimeString().split(' ')[0]

  const payload = {
    event_type: 'end_call_error',
    trigger_reason: `end_call returned status ${String(endCall.status)}`,
    customer_data: {
      call_id: call.call_id,
      phone_number: call.phone_number,
      call_date: callDate,
      call_time: callTime,
      tool_calls_total: toolCallAnalysis.total,
      end_call_status: endCall.status,
      end_call_result: endCall.result_content || null
    },
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'clark_mortgages_call_analysis'
    }
  }

  const response = await fetch(ERROR_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Clark-Mortgages-Analysis/1.0'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Error webhook failed: ${response.status} - ${await response.text()}`)
  }

  console.log(`✅ Error webhook sent successfully for call ${call.call_id}`)
  return { payload }
}

async function recordWebhookLog(
  supabase: any,
  callId: string,
  webhookUrl: string,
  payload: Record<string, unknown>,
  status: 'sent' | 'failed',
  errorMessage: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('webhook_log')
      .insert({
        call_id: callId,
        webhook_url: webhookUrl,
        payload,
        status,
        error_message: errorMessage
      })
    if (error) {
      console.warn('⚠️ Failed to insert webhook_log row:', error)
    }
  } catch (err) {
    console.warn('⚠️ Exception recording webhook_log row:', err)
  }
} 