export type ProviderName = "retell" | "vapi";

export interface StartCallParams {
  agentExternalId: string;
  toPhoneE164: string;
  metadata?: Record<string, string>;
}

export interface StartCallResult {
  externalCallId: string;
}

export interface TelephonyProvider {
  startCall(params: StartCallParams): Promise<StartCallResult>;
  stopCall(externalCallId: string): Promise<void>;
  getAgentPrompt(externalAgentId: string): Promise<string>;
  importAgent(
    externalAgentId: string
  ): Promise<{ name: string; prompt: string; config: unknown }>;
}
