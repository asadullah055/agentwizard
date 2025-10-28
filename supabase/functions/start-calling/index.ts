import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface GHLContact {
  id: string
  phone: string
  firstNameLowerCase: string
  email: string
}

interface OpenAIResponse {
  pronunciation: string
  phone_number: string
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
    console.log('🚀 Starting automated calling process (Supabase Edge Function)...')
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    if (req.method === 'GET') {
      // Test/dry run mode
      const url = new URL(req.url)
      const testBatchSize = parseInt(url.searchParams.get('batch_size') || '3', 10)

      console.log(`🧪 Test run: simulating batch of ${testBatchSize} contacts`)

      const ghlContacts = await fetchGHLContacts(testBatchSize)
      console.log(`📋 GHL test: Found ${ghlContacts.length} contacts`)

      if (ghlContacts.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Test completed - no contacts found in GHL',
          test_results: {
            ghl_contacts_found: 0,
            callable_contacts: 0,
            would_call: []
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Test duplicate prevention for first few
      const testResults = []

      for (const contact of ghlContacts.slice(0, 3)) {
        if (!contact.phone) {
          testResults.push({
            contact_id: contact.id,
            name: contact.firstNameLowerCase,
            phone: 'NO PHONE',
            can_call: false,
            reason: 'No phone number'
          })
          continue
        }

        const { data: canCallResult } = await supabase
          .rpc('should_call_phone_number', { 
            p_phone_number: formatPhoneForCheck(contact.phone)
          })

        const callCheck = canCallResult?.[0]
        testResults.push({
          contact_id: contact.id,
          name: contact.firstNameLowerCase,
          phone: contact.phone,
          can_call: callCheck?.can_call || false,
          reason: callCheck?.reason || 'Unknown',
          cooldown_until: callCheck?.cooldown_until,
          attempts_today: callCheck?.attempts_today
        })
      }

      const callableCount = testResults.filter(r => r.can_call).length

      return new Response(JSON.stringify({
        success: true,
        message: `Test completed - ${callableCount} of ${testResults.length} contacts would be called`,
        test_results: {
          ghl_contacts_found: ghlContacts.length,
          contacts_tested: testResults.length,
          callable_contacts: callableCount,
          would_call: testResults,
          note: 'This is a DRY RUN. Use POST to actually make calls.'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST method - actual calling
    // NEW: Pull batch size from calling_settings so UI & backend stay in sync
    const { data: batchSetting } = await supabase
      .from('calling_settings')
      .select('setting_value')
      .eq('setting_name', 'batch_size')
      .single()
      // Fallback to 10 if setting not found or malformed
    const defaultBatch = 10
    const uiBatchSize = parseInt(batchSetting?.setting_value?.value ?? defaultBatch, 10)
    console.log(`📦 UI-configured batch size: ${uiBatchSize} contacts`)

    let ghlContacts = await fetchGHLContacts(uiBatchSize * 2) // over-fetch then dedup

    // 🔁 De-duplicate by normalised phone number so same person isn’t dialled twice in a batch
    const seenNumbers = new Set<string>()
    ghlContacts = ghlContacts.filter((c) => {
      const norm = formatPhoneForCheck(c.phone ?? '')
      if (!norm) return false
      if (seenNumbers.has(norm)) return false
      seenNumbers.add(norm)
      return true
    }).slice(0, uiBatchSize)
    console.log(`📋 Found ${ghlContacts.length} contacts from GHL`)

    if (ghlContacts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No contacts found in GHL with criteria',
        contacts_found: 0,
        calls_initiated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Filter with duplicate prevention
    const callableContacts: GHLContact[] = []
    
    for (const contact of ghlContacts) {
      if (!contact.phone) {
        console.log(`⚠️ Skipping contact ${contact.id} - no phone number`)
        await updateGHLContactNullPhone(contact.id)
        continue
      }

      const { data: canCallResult } = await supabase
        .rpc('should_call_phone_number', { 
          p_phone_number: formatPhoneForCheck(contact.phone)
        })

      const callCheck = canCallResult?.[0]
      if (callCheck?.can_call) {
        callableContacts.push(contact)
        console.log(`✅ Contact ${contact.firstNameLowerCase} (${contact.phone}) - can call`)
      } else {
        console.log(`❌ Contact ${contact.firstNameLowerCase} (${contact.phone}) - blocked: ${callCheck?.reason}`)
      }
    }

    console.log(`📞 ${callableContacts.length} contacts passed duplicate prevention`)

    if (callableContacts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'All contacts are in cooldown period',
        contacts_found: ghlContacts.length,
        calls_initiated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process each contact: OpenAI → Random Assistant → VAPI Call
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const contact of callableContacts) {
      try {
        console.log(`🧠 Processing ${contact.firstNameLowerCase} (${contact.phone})...`)

        const pronunciation = await getOpenAIPronunciation(contact)
        const { assistantId, phoneNumberId, name } = getRandomAssistant()
        
        const callResult = await createVAPICall({
          assistantId,
          phoneNumberId, 
          contact,
          pronunciation
        })

        if (callResult.success) {
          // NEW: Immediately record the attempt to enforce cooldown before VAPI sync runs
          await supabase.rpc('record_call_attempt', {
            p_phone_number: formatPhoneForCheck(contact.phone),
            p_call_status: 'initiated',
            p_ended_reason: null
          })

          results.push({ 
            contact_id: contact.id,
            phone_number: contact.phone,
            name: contact.firstNameLowerCase,
            assistant: name,
            success: true, 
            call_id: callResult.call_id 
          })
          successCount++
          console.log(`✅ Call initiated: ${contact.firstNameLowerCase} → ${name}`)
        } else {
          results.push({ 
            contact_id: contact.id,
            phone_number: contact.phone,
            name: contact.firstNameLowerCase,
            success: false, 
            error: callResult.error 
          })
          errorCount++
          console.log(`❌ Call failed: ${contact.firstNameLowerCase} - ${callResult.error}`)
        }

        // Add delay between calls
        await new Promise(resolve => setTimeout(resolve, 3000))

      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error)
        results.push({ 
          contact_id: contact.id,
          phone_number: contact.phone,
          name: contact.firstNameLowerCase,
          success: false, 
          error: String(error) 
        })
        errorCount++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Calling batch completed: ${successCount} calls initiated, ${errorCount} failed`,
      batch_size: uiBatchSize,
      contacts_found: ghlContacts.length,
      contacts_callable: callableContacts.length,
      calls_initiated: successCount,
      calls_failed: errorCount,
      results: results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in automated calling process:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Helper functions
async function fetchGHLContacts(numberOfCalls: number): Promise<GHLContact[]> {
  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GHL_API_KEY')}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: "w3EnlHbulBh4u124N5wd",
        page: 1,
        pageLimit: numberOfCalls,
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
      })
    })

    if (!response.ok) {
      throw new Error(`GHL API error: ${response.status}`)
    }

    const data = await response.json()
    return data.contacts || []

  } catch (error) {
    console.error('Error fetching GHL contacts:', error)
    return []
  }
}

async function getOpenAIPronunciation(contact: GHLContact): Promise<OpenAIResponse> {
  try {
    const phoneFormatted = contact.phone.replace('+44', '0')
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `# You are a preprocessing assistant for an outbound AI voice agent.

## INPUT  (from previous step)
{
  "customer_name": "<string>", / e.g.  "Siobhán O'Neill"
  "phone_number": "<string_of_digits>"  // e.g.  "01244554030"
}

## TASKS
1. Build a **pronunciation guide** for customer_name:
   • Use a simple "read-it-as" phonetic spelling that English speakers recognise.
     – Example →  "Siobhán O'Neill" → "shuh-VAWN oh-NEEL".
   • Capitalise the syllable to emphasise if stress is not obvious.
   • Keep apostrophes and hyphens that affect pronunciation; drop others.
   • No IPA, no slashes, no brackets.

2. Convert phone_number to **spoken words** for the voice agent:
   • Spell out each digit as a word: 0→zero, 1→one, … 9→nine.
   • Insert a single space between words.
   • Insert " … " (space-ellipsis-space) **after every natural grouping** of
     2–4 digits to aid pacing.  
     – UK & EU: group as 3-3-4 or 2-4-4 depending on the length.  
     – North America: (3-3-4).  
     – If unsure, default to groups of 3-3-4 from left to right.
   • Do **not** add country-code words ("plus four four" etc.) unless it is
     present in the input.

OUTPUT  (strict JSON, no commentary, no trailing commas)
{
  "pronunciation": "<string>",
  "phone_number": "<string>"
}

## EXAMPLES
Input ➜  {"customer_name":"Siobhán", "phone_number":"01244554030"}
Output ➜ {"pronunciation":"shuh-VAWN","phone_number":"zero one … two four four … five five four … zero three zero"}

Input ➜  {"customer_name":"Nguyen", "phone_number":"4155550134"}
Output ➜ {"pronunciation":"nuh-GWEN",
"phone_number":"four one five … five five five … zero one three four"}

If any field is missing or empty, leave its output value an empty string.
Respond **only** with the JSON object.`
          },
          {
            role: 'user', 
            content: `Phone_number : "${phoneFormatted}"

first name: "${contact.firstNameLowerCase}"

----
----

PLEASE MAKE SURE TO START THE PHONE NUMBER WITH "ZERO" or "OH"

ALWAYS PUT AN OUTPUT !!!`
          }
        ],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    try {
      return JSON.parse(content)
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', content)
      return {
        pronunciation: contact.firstNameLowerCase,
        phone_number: phoneFormatted.split('').join(' ')
      }
    }

  } catch (error) {
    console.error('Error getting OpenAI pronunciation:', error)
    return {
      pronunciation: contact.firstNameLowerCase,
      phone_number: contact.phone.replace('+44', '0').split('').join(' ')
    }
  }
}

function getRandomAssistant(): { assistantId: string, phoneNumberId: string, name: string } {
  const isJames = Math.random() > 0.5
  
  if (isJames) {
    return {
      assistantId: "868adc0a-e654-484d-87be-e2b784dd7e63",
      phoneNumberId: "bcf19ea0-d655-4d78-bd0b-17b9bf1baf2a",
      name: "James"
    }
  } else {
    return {
      assistantId: "f3b4e78d-86a5-42cd-95d2-8375cb73513f",
      phoneNumberId: "fa8ce041-da8b-4606-b7d4-c1898dc29203",
      name: "Sarah"
    }
  }
}

async function createVAPICall(params: {
  assistantId: string
  phoneNumberId: string
  contact: GHLContact
  pronunciation: OpenAIResponse
}): Promise<{ success: boolean, call_id?: string, error?: string }> {
  try {
    const { assistantId, phoneNumberId, contact, pronunciation } = params
    
    const phoneNumber = contact.phone.startsWith('0') 
      ? '+44' + contact.phone.slice(1) 
      : contact.phone

    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistantId,
        phoneNumberId,
        customer: {
          number: phoneNumber
        },
        assistantOverrides: {
          variableValues: {
            pronunciation: pronunciation.pronunciation,
            first_name: contact.firstNameLowerCase,
            email: contact.email,
            phone_number: pronunciation.phone_number
          }
        },
        metadata: {
          CRM_id: contact.id
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`VAPI API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return { success: true, call_id: data.id }

  } catch (error) {
    console.error('Error creating VAPI call:', error)
    return { success: false, error: String(error) }
  }
}

async function updateGHLContactNullPhone(contactId: string) {
  try {
    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GHL_API_KEY')}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customFields: [
          {
            id: "49ed0UL01AXEugvJOfAm",
            value: "No Phone Number recorded"
          }
        ]
      })
    })
  } catch (error) {
    console.error('Error updating GHL contact:', error)
  }
}

function formatPhoneForCheck(phone: string): string {
  if (phone.startsWith('+44')) {
    return phone
  } else if (phone.startsWith('0')) {
    return '+44' + phone.slice(1)
  }
  return phone
} 