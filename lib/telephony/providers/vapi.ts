import {
  StartCallParams,
  StartCallResult,
  TelephonyProvider,
} from "../TelephonyProvider";

const VAPI_API_BASE = "https://api.vapi.ai/v1";

export const vapiProvider: TelephonyProvider = {
  async startCall({
    agentExternalId,
    toPhoneE164,
    metadata,
  }: StartCallParams): Promise<StartCallResult> {
    const res = await fetch(`${VAPI_API_BASE}/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentExternalId,
        to: toPhoneE164,
        metadata,
      }),
    });

    if (!res.ok) throw new Error(`VAPI startCall failed: ${res.statusText}`);
    const data = await res.json();
    return { externalCallId: data.id };
  },

  async stopCall(externalCallId: string): Promise<void> {
    await fetch(`${VAPI_API_BASE}/calls/${externalCallId}/stop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    });
  },

  async getAgentPrompt(externalAgentId: string): Promise<string> {
    const res = await fetch(`${VAPI_API_BASE}/agents/${externalAgentId}`, {
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    });
    const data = await res.json();
    return data.prompt ?? "";
  },

  async importAgent(externalAgentId: string) {
    const res = await fetch(`${VAPI_API_BASE}/agents/${externalAgentId}`, {
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    });
    const data = await res.json();
    return {
      name: data.name,
      prompt: data.prompt,
      config: data,
    };
  },
};
