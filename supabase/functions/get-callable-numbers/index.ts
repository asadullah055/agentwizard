import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface CallableNumber {
  phone_number: string
  can_call: boolean
  reason: string
  priority_score: number
}

interface GetCallableNumbersRequest {
  limit?: number
  current_time?: string
}

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
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let limit = 50
    let current_time = new Date().toISOString()

    if (req.method === 'POST') {
      // Production use by n8n
      const body = await req.json() as GetCallableNumbersRequest
      limit = body.limit || 50
      current_time = body.current_time || new Date().toISOString()

      console.log(`🔍 n8n requesting ${limit} callable numbers...`)
    } else {
      // GET method for testing
      const url = new URL(req.url)
      limit = parseInt(url.searchParams.get('limit') || '50', 10)
      current_time = url.searchParams.get('current_time') || new Date().toISOString()

      console.log(`🧪 Test request for ${limit} callable numbers...`)
    }

    const { data: callableNumbers, error } = await supabase
      .rpc('get_numbers_ready_to_call', {
        p_limit: limit,
        p_current_time: current_time
      })

    if (error) {
      console.error('Error getting callable numbers:', error)
      return new Response(JSON.stringify({
        error: 'Failed to get callable numbers',
        details: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const readyNumbers = (callableNumbers as CallableNumber[])?.filter(n => n.can_call) || []

    console.log(`✅ Found ${readyNumbers.length} numbers ready to call (out of ${callableNumbers?.length || 0} checked)`)

    return new Response(JSON.stringify({
      success: true,
      numbers: readyNumbers,
      total_available: readyNumbers.length,
      total_checked: callableNumbers?.length || 0,
      timestamp: new Date().toISOString(),
      note: req.method === 'GET' ? 'This is a test endpoint. Use POST for production n8n integration.' : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in get-callable-numbers function:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}) 