import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===============================================
// DAILY CONTACT PRELOADER - Load 100 contacts at start of day
// ===============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🌅 DAILY PRELOAD: Starting daily contact preload...');
    console.log(`⏰ Current time: ${new Date().toISOString()}`);
    
    // Check environment variables
    const requiredEnvs = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      GHL_API_KEY: Deno.env.get('GHL_API_KEY')
    };
    
    for (const [key, value] of Object.entries(requiredEnvs)) {
      if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
    
    const supabase = createClient(
      requiredEnvs.SUPABASE_URL!,
      requiredEnvs.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check if already loaded today
    const today = new Date().toISOString().split('T')[0];
    const { count: existingCount } = await supabase
      .from('daily_call_queue')
      .select('*', { count: 'exact', head: true })
      .eq('queue_date', today);
    
    const targetTotal = 100
    const alreadyLoaded = existingCount ?? 0
    if (alreadyLoaded >= targetTotal) {
      return new Response(JSON.stringify({
        success: true,
        message: `Already loaded ${alreadyLoaded} contacts for today`,
        date: today,
        count: alreadyLoaded
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // STEP 1: Fetch 500 contacts from GHL to ensure we get 100 eligible ones
    console.log('📞 Fetching contacts from GHL...');
    const ghlContacts = await fetchGHLContactsWithPagination(requiredEnvs.GHL_API_KEY!, 500);
    
    if (ghlContacts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No contacts found in GHL',
        date: today
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`✅ Fetched ${ghlContacts.length} contacts from GHL`);
    
    // STEP 2: Filter eligible contacts with 2-week cooldown check
    console.log('🔍 Filtering eligible contacts...');
    type QueueContact = {
      contact_id: string;
      phone_number: string;
      contact_data: Record<string, unknown>;
      priority_score: number;
    };
    const eligibleContacts: QueueContact[] = [];
    
    const needed = Math.max(0, targetTotal - alreadyLoaded)
    for (const contact of ghlContacts) {
      if (!contact.phone || contact.phone.length < 8) {
        continue;
      }
      
      // Format phone for database check
      let phoneForCheck = contact.phone;
      if (phoneForCheck.startsWith('0')) {
        phoneForCheck = '+44' + phoneForCheck.slice(1);
      }
      
      // Check 2-week cooldown
      const { data: cooldownCheck } = await supabase
        .rpc('should_call_phone_number_smart', { 
          p_phone_number: phoneForCheck
        });
      
      if (cooldownCheck?.[0]?.can_call) {
        eligibleContacts.push({
          contact_id: contact.id,
          phone_number: phoneForCheck,
          contact_data: {
            id: contact.id,
            firstName: contact.firstNameLowerCase || contact.firstName || '',
            lastName: contact.lastNameLowerCase || contact.lastName || '',
            email: contact.email || '',
            phone: contact.phone,
            tags: contact.tags || [],
            source: contact.source || '',
            dateAdded: contact.dateAdded || '',
            customFields: contact.customFields || {},
            additionalPhones: contact.additionalPhones || []
          },
          priority_score: calculatePriorityScore(contact)
        });
        
        if (eligibleContacts.length >= needed) break;
      }
    }
    
    console.log(`✅ Found ${eligibleContacts.length} eligible contacts`);
    
    // STEP 3: Insert into daily queue (top-up only the missing amount)
    if (eligibleContacts.length > 0) {
      const { error: insertError } = await supabase
        .from('daily_call_queue')
        .insert(
          eligibleContacts.map(contact => ({
            queue_date: today,
            contact_id: contact.contact_id,
            phone_number: contact.phone_number,
            contact_data: contact.contact_data,
            priority_score: contact.priority_score,
            status: 'pending'
          }))
        );
      
      if (insertError) {
        throw insertError;
      }
    }
    
    // Lightweight summary (avoid view issues)
    const { count: loadedCount } = await supabase
      .from('daily_call_queue')
      .select('*', { count: 'exact', head: true })
      .eq('queue_date', today);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully preloaded ${eligibleContacts.length} contacts for today`,
      date: today,
      loaded_count: eligibleContacts.length,
      queue_count: loadedCount ?? 0,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Daily preload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}, { verifyJwt: false });

// Fetch contacts from GHL with pagination
async function fetchGHLContactsWithPagination(apiKey: string, targetCount: number): Promise<any[]> {
  const allContacts: any[] = [];
  let page = 1;
  const pageLimit = 100;
  
  while (allContacts.length < targetCount && page <= 5) {
    try {
      const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-04-15',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationId: "w3EnlHbulBh4u124N5wd",
          page: page,
          pageLimit: pageLimit,
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
      });
      
      if (!response.ok) {
        console.error(`GHL API error: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      const contacts = data.contacts || [];
      
      if (contacts.length === 0) break;
      
      allContacts.push(...contacts);
      page++;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('GHL fetch error:', error);
      break;
    }
  }
  
  return allContacts;
}

// Calculate priority score for contact
function calculatePriorityScore(contact: any): number {
  let score = 50;
  
  // Boost score for contacts without recent activity
  if (!contact.lastActivity || new Date(contact.lastActivity) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
    score += 30;
  }
  
  // Boost for contacts with certain tags
  if (contact.tags?.includes('hot lead')) {
    score += 20;
  }
  
  // Boost for older contacts
  if (contact.dateAdded) {
    const daysOld = Math.floor((Date.now() - new Date(contact.dateAdded).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld > 30) score += 10;
    if (daysOld > 60) score += 10;
  }
  
  return Math.min(score, 100);
} 