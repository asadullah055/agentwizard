// Types for Retell AI integration
export interface CreateCallRequest {
  phoneNumber: string;
  agentId: string;
  metadata?: {
    customerName?: string;
    firstName?: string;
    email?: string;
    phoneNumber?: string;
    pronunciation?: string;
    companyName?: string;
    contactId?: string;
    notes?: string;
    testCall?: boolean;
    customData?: boolean;
  };
}

export interface CreateWebCallRequest {
  agentId: string;
  agentVersion?: number;
  metadata?: {
    customerName?: string;
    firstName?: string;
    email?: string;
    phoneNumber?: string;
    pronunciation?: string;
    companyName?: string;
    contactId?: string;
    notes?: string;
    testCall?: boolean;
    customData?: boolean;
  };
  retellLlmDynamicVariables?: {
    customer_name?: string;
    first_name?: string;
    email?: string;
    phone_number?: string;
    pronunciation?: string;
    company_name?: string;
    [key: string]: any;
  };
}

export interface CreateCallResponse {
  success: boolean;
  callId?: string;
  status?: string;
  message?: string;
  error?: string;
  callData?: {
    toNumber?: string;
    agentId?: string;
    timestamp?: string;
  };
}

export interface CreateWebCallResponse {
  success: boolean;
  callId?: string;
  webCallUrl?: string;
  status?: string;
  message?: string;
  error?: string;
  callData?: {
    callId?: string;
    webCallUrl?: string;
    agentId?: string;
    timestamp?: string;
  };
}

export interface GetCallsRequest {
  agentId?: string;
  limit?: number;
  before?: string;
  after?: string;
}

export interface CallRecord {
  id: string;
  from: string;
  to: string;
  direction: string;
  duration: number;
  transcript: string;
  status: string;
  created_at: string;
  agent_id: string;
}

export interface CallAnalytics {
  totalCalls: number;
  successfulCalls: number;
  averageDuration: number;
  commonOutcomes: Array<{
    outcome: string;
    count: number;
    percentage: number;
  }>;
}

export interface GetCallsResponse {
  success: boolean;
  calls?: CallRecord[];
  analytics?: CallAnalytics;
  error?: string;
}

export class RetellApiClient {
  private baseUrl: string;

  constructor() {
    // Use production URL if deployed, localhost for development
    this.baseUrl =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `https://${window.location.hostname}`
        : "http://localhost:3000";
  }

  async createCall(request: CreateCallRequest): Promise<CreateCallResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/retell-create-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to create call:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async createWebCall(
    request: CreateWebCallRequest
  ): Promise<CreateWebCallResponse> {
    try {
      // Transform the request to match what the Netlify function expects
      const requestBody = {
        agentId: request.agentId,
        agentVersion: request.agentVersion || 1,
        metadata: request.metadata || {},
        retellLlmDynamicVariables: {
          customer_name: request.metadata?.customerName || "",
          first_name: request.metadata?.firstName || "",
          email: request.metadata?.email || "",
          phone_number: request.metadata?.phoneNumber || "",
          pronunciation: request.metadata?.pronunciation || "",
          company_name: request.metadata?.companyName || "",
          ...request.retellLlmDynamicVariables,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/api/retell-create-web-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to create web call:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getCalls(request?: GetCallsRequest): Promise<GetCallsResponse> {
    try {
      const params = new URLSearchParams();
      if (request?.agentId) params.append("agentId", request.agentId);
      if (request?.limit) params.append("limit", request.limit.toString());
      if (request?.before) params.append("before", request.before);
      if (request?.after) params.append("after", request.after);

      const response = await fetch(
        `${this.baseUrl}/api/retell-get-calls?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to get calls:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAnalytics(agentId?: string): Promise<GetCallsResponse> {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append("agentId", agentId);
      params.append("analytics", "true");

      const response = await fetch(
        `${this.baseUrl}/api/retell-get-calls?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to get analytics:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getRecentCalls(limit: number = 10): Promise<GetCallsResponse> {
    return this.getCalls({ limit });
  }
}

// Export a singleton instance
export const retellApi = new RetellApiClient();
