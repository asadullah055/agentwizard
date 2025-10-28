import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

interface CreateJobRequest {
  agentId: string;
  name?: string;
  contactFilters?: {
    tags?: string[];
    source?: string;
    contactIds?: string[];
  };
  rateLimit?: number; // calls per minute
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      agentId,
      name,
      contactFilters,
      rateLimit = 10,
    }: CreateJobRequest = req.body;

    // 1. Validate agent exists and is outbound
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, mode, is_active")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.mode !== "outbound") {
      return res.status(400).json({ error: "Agent must be outbound mode" });
    }

    if (!agent.is_active) {
      return res.status(400).json({ error: "Agent is not active" });
    }

    // 2. Build contact query
    let contactQuery = supabase.from("contacts").select("id, phone_e164");

    if (contactFilters?.contactIds && contactFilters.contactIds.length > 0) {
      contactQuery = contactQuery.in("id", contactFilters.contactIds);
    }

    if (contactFilters?.tags && contactFilters.tags.length > 0) {
      contactQuery = contactQuery.contains("tags", contactFilters.tags);
    }

    if (contactFilters?.source) {
      contactQuery = contactQuery.eq("source", contactFilters.source);
    }

    // 3. Exclude DNC list
    const { data: dncList } = await supabase
      .from("do_not_call")
      .select("phone_e164");

    const dncPhones = dncList?.map((d) => d.phone_e164) || [];

    const { data: contacts, error: contactError } = await contactQuery;

    if (contactError) {
      throw contactError;
    }

    const validContacts =
      contacts?.filter((c) => !dncPhones.includes(c.phone_e164)) || [];

    if (validContacts.length === 0) {
      return res.status(400).json({ error: "No valid contacts found" });
    }

    // 4. Create call job
    const { data: job, error: jobError } = await supabase
      .from("call_jobs")
      .insert({
        agent_id: agentId,
        name: name || `Job ${new Date().toISOString()}`,
        status: "draft",
        total_contacts: validContacts.length,
        config_json: { rate_limit: rateLimit },
      })
      .select()
      .single();

    if (jobError) {
      throw jobError;
    }

    // 5. Enqueue contacts
    const jobContacts = validContacts.map((contact) => ({
      call_job_id: job.id,
      contact_id: contact.id,
      status: "queued",
      attempts: 0,
    }));

    const { error: enqueueError } = await supabase
      .from("call_job_contacts")
      .insert(jobContacts);

    if (enqueueError) {
      // Rollback job
      await supabase.from("call_jobs").delete().eq("id", job.id);
      throw enqueueError;
    }

    return res.status(200).json({
      jobId: job.id,
      totalContacts: validContacts.length,
      status: "draft",
    });
  } catch (error) {
    console.error("Create job error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
