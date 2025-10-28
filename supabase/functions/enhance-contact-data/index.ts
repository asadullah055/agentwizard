import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

interface ContactToEnhance {
  phone_number: string;
  call_id: string;
  current_metadata?: any;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting contact enhancement job...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get GHL API key from environment
    const ghlApiKey = Deno.env.get('GHL_API_KEY')
    if (!ghlApiKey) {
      throw new Error('GHL_API_KEY not found in environment variables')
    }

    const locationId = "w3EnlHbulBh4u124N5wd"

    // Step 1: Find contacts that need enhancement (skip test numbers)
    const { data: contactsToEnhance, error: selectError } = await supabase
      .from('vapi_calls')
      .select('phone_number, call_id, metadata')
      .eq('status', 'ended')
      .or('metadata.is.null,metadata->contact_name.is.null')
      .not('phone_number', 'like', '+44780000%')
      .not('phone_number', 'like', '+447800%')
      .limit(10)

    if (selectError) {
      throw new Error(`Failed to fetch contacts: ${selectError.message}`)
    }

    console.log(`📋 Found ${contactsToEnhance?.length || 0} contacts to enhance`)

    if (!contactsToEnhance || contactsToEnhance.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No contacts found that need enhancement',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 2: Process each contact
    let processed = 0
    let enhanced = 0
    let errors = 0

    for (const contact of contactsToEnhance) {
      try {
        console.log(`🔍 Processing contact: ${contact.phone_number}`)

        // Prepare phone number variants for GHL search
        const phoneVariants = [
          contact.phone_number,
          contact.phone_number.replace('+44', '0'),
          contact.phone_number.replace(/^\+44/, '0'),
          contact.phone_number.replace(/^0/, '+44')
        ].filter((phone, index, arr) => arr.indexOf(phone) === index) // Remove duplicates

        // Try each phone variant until we find a match
        let ghlContacts = []
        let searchSuccessful = false

        for (const phoneVariant of phoneVariants) {
          if (searchSuccessful) break

          const ghlSearchResponse = await fetch('https://services.leadconnectorhq.com/contacts/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Version': '2021-04-15',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              locationId,
              page: 1,
              pageLimit: 1,
              filters: [
                {
                  field: "phone",
                  operator: "eq",
                  value: phoneVariant
                }
              ]
            })
          })

          if (!ghlSearchResponse.ok) {
            console.error(`❌ GHL API error for ${phoneVariant}: ${ghlSearchResponse.status}`)
            continue
          }

          const ghlData = await ghlSearchResponse.json()
          if (ghlData.contacts && ghlData.contacts.length > 0) {
            ghlContacts = ghlData.contacts
            searchSuccessful = true
            console.log(`✅ Found contact for ${phoneVariant}`)
          }
        }

        if (ghlContacts.length === 0) {
          console.log(`⚠️ No GHL contact found for ${contact.phone_number}`)
          processed++
          continue
        }

        // Step 3: Extract contact data
        const ghlContact: GHLContact = ghlContacts[0]
        
        // Merge with existing metadata
        const existingMetadata = contact.metadata || {}
        const enhancedMetadata = {
          ...existingMetadata,
          contact_id: ghlContact.id,
          contact_name: `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim(),
          firstName: ghlContact.firstName,
          lastName: ghlContact.lastName,
          email: ghlContact.email,
          ghl_phone: ghlContact.phone,
          tags: ghlContact.tags || [],
          customFields: ghlContact.customFields || {},
          enhanced_at: new Date().toISOString(),
          enhanced_source: 'ghl_cron_job'
        }

        // Step 4: Update vapi_calls with enhanced metadata
        const { error: updateError } = await supabase
          .from('vapi_calls')
          .update({ 
            metadata: enhancedMetadata,
            customer_name: enhancedMetadata.contact_name
          })
          .eq('call_id', contact.call_id)

        if (updateError) {
          console.error(`❌ Failed to update contact ${contact.phone_number}: ${updateError.message}`)
          errors++
          continue
        }

        console.log(`✅ Enhanced contact: ${enhancedMetadata.contact_name} (${contact.phone_number})`)
        enhanced++
        processed++

        // Add small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`❌ Error processing contact ${contact.phone_number}:`, error)
        errors++
        processed++
      }
    }

    // Step 5: Return summary
    const result = {
      success: true,
      message: `Contact enhancement completed`,
      processed,
      enhanced,
      errors,
      timestamp: new Date().toISOString()
    }

    console.log('📊 Enhancement Summary:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Contact enhancement job failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/* Example usage:
 * This function can be called:
 * 1. Via CRON job every 15-30 minutes
 * 2. Manually via API call
 * 3. Triggered after new calls are synced
 * 
 * It will:
 * - Find up to 10 contacts with missing/incomplete data
 * - Search GHL API for each contact by phone number
 * - Update vapi_calls.metadata with enriched contact data
 * - Provide detailed logging and error handling
 */ 