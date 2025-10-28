import {
  StartCallParams,
  StartCallResult,
  TelephonyProvider,
} from "../TelephonyProvider";

const RETELL_API_BASE = "https://api.retellai.com";
const RETELL_API_KEY = process.env.NEXT_PUBLIC_RETELL_API_KEY!;

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${url} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Step 2 Helper — get LLM prompt text */
async function getPromptFromLLM(llmId: string): Promise<string> {
  const data = await fetchJson(`${RETELL_API_BASE}/get-retell-llm/${llmId}`);
  return (
    data.prompt ||
    data.general_prompt ||
    data.system_prompt ||
    (data.llm && (data.llm.prompt || data.llm.general_prompt)) ||
    ""
  );
}

/** Main Provider Implementation for Re:Tell */
export const retellProvider: TelephonyProvider = {
  async startCall({
    agentExternalId,
    toPhoneE164,
    metadata,
  }: StartCallParams): Promise<StartCallResult> {
    const res = await fetch(`${RETELL_API_BASE}/create-phone-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentExternalId,
        from_number: process.env.RETELL_PHONE_NUMBER,
        to_number: toPhoneE164,
        metadata,
      }),
    });
    if (!res.ok)
      throw new Error(`startCall failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { externalCallId: data.call_id };
  },

  async stopCall(externalCallId: string): Promise<void> {
    const res = await fetch(
      `${RETELL_API_BASE}/delete-call/${externalCallId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
      }
    );
    if (!res.ok) console.error("Failed to stop call", await res.text());
  },

  /** Step 1+2: first get agent → then get LLM prompt */
  async getAgentPrompt(externalAgentId: string): Promise<string> {
    const agent = await fetchJson(
      `${RETELL_API_BASE}/get-agent/${externalAgentId}`
    );

    const llmId = agent?.response_engine?.llm_id;
    if (!llmId) {
      console.warn("⚠️ No LLM linked with this agent:", agent);
      return "";
    }

    const prompt = await getPromptFromLLM(llmId);
    if (!prompt)
      console.warn("⚠️ Prompt empty for LLM:", llmId, "agent:", agent);
    return prompt;
  },

  /** Full import with agent config + prompt via its LLM */
  async importAgent(externalAgentId: string) {
    const agent = await fetchJson(
      `${RETELL_API_BASE}/get-agent/${externalAgentId}`
    );

    const llmId = agent?.response_engine?.llm_id;
    const prompt = llmId ? await getPromptFromLLM(llmId) : "";

    return {
      name: agent.agent_name ?? agent.name ?? externalAgentId,
      prompt,
      config: agent,
    };
  },
};
