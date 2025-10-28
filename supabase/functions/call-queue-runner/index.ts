import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const retellApiKey = Deno.env.get("RETELL_API_KEY")!;
const vapiApiKey = Deno.env.get("VAPI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface QueueItem {
  id: string;
  call_job_id: string;
  contact_id: string;
  attempts: number;
  max_attempts: number;
  job: {
    agent_id: string;
    config_json: { rate_limit?: number };
    agent: {
      provider: "retell" | "vapi";
      external_agent_id: string;
    };
  };
  contact: {
    phone_e164: string;
    first_name: string;
    last_name: string;
  };
}

async function startRetellCall(
  agentId: string,
  phone: string,
  metadata: Record<string, string>
): Promise<string> {
  const response = await fetch(
    "https://api.retellai.com/v2/create-phone-call",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        to_number: phone,
        metadata,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Retell API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.call_id;
}

async function startVapiCall(
  assistantId: string,
  phone: string,
  metadata: Record<string, string>
): Promise<string> {
  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      customer: { number: phone },
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`VAPI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

serve(async (req) => {
  try {
    // 1. Get active jobs
    const { data: activeJobs } = await supabase
      .from("call_jobs")
      .select("id, config_json")
      .in("status", ["queued", "running"]);

    if (!activeJobs || activeJobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;

    for (const job of activeJobs) {
      const rateLimit = job.config_json?.rate_limit || 10;

      // 2. Pull queued contacts for this job
      const { data: queueItems, error: fetchError } = await supabase
        .from("call_job_contacts")
        .select(
          `
          id,
          call_job_id,
          contact_id,
          attempts,
          max_attempts,
          job:call_jobs!inner(
            agent_id,
            config_json,
            agent:agents!inner(provider, external_agent_id)
          ),
          contact:contacts!inner(phone_e164, first_name, last_name)
        `
        )
        .eq("call_job_id", job.id)
        .eq("status", "queued")
        .lte("scheduled_at", new Date().toISOString())
        .limit(rateLimit);

      if (fetchError || !queueItems || queueItems.length === 0) {
        continue;
      }

      // 3. Process each item
      for (const item of queueItems as unknown as QueueItem[]) {
        try {
          // Mark as calling
          await supabase
            .from("call_job_contacts")
            .update({ status: "calling", attempts: item.attempts + 1 })
            .eq("id", item.id);

          const provider = item.job.agent.provider;
          const agentId = item.job.agent.external_agent_id;
          const phone = item.contact.phone_e164;
          const metadata = {
            contact_id: item.contact_id,
            job_id: item.call_job_id,
            first_name: item.contact.first_name || "",
            last_name: item.contact.last_name || "",
          };

          let externalCallId: string;

          if (provider === "retell") {
            externalCallId = await startRetellCall(agentId, phone, metadata);
          } else {
            externalCallId = await startVapiCall(agentId, phone, metadata);
          }

          // Create call_run record
          await supabase.from("call_runs").insert({
            external_call_id: externalCallId,
            agent_id: item.job.agent_id,
            contact_id: item.contact_id,
            provider,
            direction: "outbound",
            status: "initiated",
            started_at: new Date().toISOString(),
          });

          totalProcessed++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";

          // Update failure status
          const shouldRetry = item.attempts + 1 < item.max_attempts;

          await supabase
            .from("call_job_contacts")
            .update({
              status: shouldRetry ? "queued" : "failed",
              last_error: errorMsg,
              scheduled_at: shouldRetry
                ? new Date(Date.now() + 60000).toISOString() // retry in 1 min
                : undefined,
            })
            .eq("id", item.id);
        }
      }

      // 4. Update job status
      await supabase
        .from("call_jobs")
        .update({ status: "running" })
        .eq("id", job.id);
    }

    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Queue runner error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
