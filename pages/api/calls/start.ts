import { getProvider } from "@/lib/telephony";
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

interface StartCallRequest {
  agentId: string;
  contactId: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agentId, contactId }: StartCallRequest = req.body;

    // 1. Fetch agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, provider, external_agent_id, is_active")
      .eq("id", agentId)
      .single();

    if (agentError || !agent || !agent.is_active) {
      return res.status(404).json({ error: "Agent not found or inactive" });
    }

    // 2. Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, phone_e164, first_name, last_name")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // 3. Check DNC
    const { data: dnc } = await supabase
      .from("do_not_call")
      .select("phone_e164")
      .eq("phone_e164", contact.phone_e164)
      .single();

    if (dnc) {
      return res.status(400).json({ error: "Contact is on DNC list" });
    }

    // 4. Start call via provider
    const provider = getProvider(agent.provider);

    const result = await provider.startCall({
      agentExternalId: agent.external_agent_id,
      toPhoneE164: contact.phone_e164,
      metadata: {
        contact_id: contactId,
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
      },
    });

    // 5. Record call_run
    const { data: callRun, error: runError } = await supabase
      .from("call_runs")
      .insert({
        external_call_id: result.externalCallId,
        agent_id: agentId,
        contact_id: contactId,
        provider: agent.provider,
        direction: "outbound",
        status: "initiated",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      throw runError;
    }

    return res.status(200).json({
      callRunId: callRun.id,
      externalCallId: result.externalCallId,
      status: "initiated",
    });
  } catch (error) {
    console.error("Start call error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
