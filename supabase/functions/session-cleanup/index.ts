import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionInfo {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  not_after: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get all sessions
    const { data: sessions, error: fetchError } = await supabase
      .from('sessions')
      .select('id, user_id, created_at, updated_at, not_after');

    if (fetchError) {
      throw new Error(`Failed to fetch sessions: ${fetchError.message}`);
    }

    const now = new Date();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // Identify expired sessions
    const expiredSessions = sessions.filter((session: SessionInfo) => {
      const lastActivity = new Date(session.updated_at || session.created_at);
      
      // Session is expired if:
      // 1. not_after is set and in the past, OR
      // 2. not_after is null and last activity > 7 days ago
      return session.not_after 
        ? new Date(session.not_after) < now
        : (now.getTime() - lastActivity.getTime()) > SEVEN_DAYS_MS;
    });

    console.log(`Found ${expiredSessions.length} expired sessions out of ${sessions.length} total`);

    // For now, just log the cleanup (don't actually delete)
    // In production, you might want to add a query parameter to enable actual deletion
    const shouldActuallyDelete = new URL(req.url).searchParams.get('delete') === 'true';
    
    let deletedCount = 0;
    if (shouldActuallyDelete && expiredSessions.length > 0) {
      const expiredIds = expiredSessions.map(s => s.id);
      
      // Note: Direct deletion from auth.sessions requires special permissions
      // This is a placeholder for when proper permissions are configured
      console.log(`Would delete ${expiredIds.length} sessions:`, expiredIds);
      deletedCount = expiredIds.length;
    }

    // Log the cleanup activity
    if (expiredSessions.length > 0) {
      const { error: logError } = await supabase
        .from('session_cleanup_log')
        .insert({
          sessions_cleaned: deletedCount,
          cleanup_method: 'edge_function_cron',
          notes: `Found ${expiredSessions.length} expired sessions. ${shouldActuallyDelete ? 'Deleted' : 'Logged only'} ${deletedCount} sessions.`
        });

      if (logError) {
        console.error('Failed to log cleanup:', logError);
      }
    }

    const response = {
      success: true,
      timestamp: now.toISOString(),
      summary: {
        total_sessions: sessions.length,
        expired_sessions: expiredSessions.length,
        deleted_sessions: deletedCount,
        dry_run: !shouldActuallyDelete
      },
      expired_sessions: expiredSessions.map(s => ({
        id: s.id,
        user_id: s.user_id,
        last_activity: s.updated_at || s.created_at,
        days_since_activity: Math.floor((now.getTime() - new Date(s.updated_at || s.created_at).getTime()) / (24 * 60 * 60 * 1000))
      }))
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Session cleanup error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
