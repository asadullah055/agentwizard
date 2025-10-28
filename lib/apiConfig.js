// API Configuration for Demo Dashboard
// This file handles connections to your VAPI system

const API_CONFIG = {
  // Base URLs
  BASE_URL: window.location.origin, // Automatically uses current domain
  VAPI_API_URL: 'https://api.vapi.ai',
  
  // Endpoints
  ENDPOINTS: {
    TEST_CALL: '/api/test-call',
    ANALYTICS: '/api/analytics',
    RECENT_CALLS: '/api/recent-calls'
  },
  
  // Demo mode settings - automatically detects environment
  DEMO_MODE: !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'), // Auto-enable demo mode for deployed sites
  
  // VAPI Settings (used when DEMO_MODE is false)
  VAPI: {
    // These will be passed to your backend API
    ASSISTANT_IDS: {
      SARAH: 'f3b4e78d-86a5-42cd-95d2-8375cb73513f',
      JAMES: '868adc0a-e654-484d-87be-e2b784dd7e63',
      JO: 'jo-assistant-id'
    },
    PHONE_NUMBER_IDS: {
      SARAH: 'fa8ce041-da8b-4606-b7d4-c1898dc29203',
      JAMES: 'bcf19ea0-d655-4d78-bd0b-17b9bf1baf2a',
      JO: 'jo-phone-number-id'
    }
  }
};

// API Helper Functions
const apiHelpers = {
  
  // Make a test call
  async makeTestCall(callData) {
    if (API_CONFIG.DEMO_MODE) {
      // Simulate API call for demo
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            call_id: 'demo_' + Date.now(),
            status: 'initiated'
          });
        }, 1000);
      });
    } else {
      // Real API call
      const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.TEST_CALL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(callData)
      });
      return await response.json();
    }
  },
  
  // Get analytics data
  async getAnalytics(timeRange = 'week') {
    if (API_CONFIG.DEMO_MODE) {
      // Return mock data for demo
      return mockAnalyticsData;
    } else {
      // Real API call
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYTICS}?range=${timeRange}`);
      return await response.json();
    }
  },
  
  // Get recent calls
  async getRecentCalls(limit = 5) {
    if (API_CONFIG.DEMO_MODE) {
      // Return mock data for demo
      return recentCallsData.slice(0, limit);
    } else {
      // Real API call
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECENT_CALLS}?limit=${limit}`);
      return await response.json();
    }
  },
  
  // Format phone number for VAPI
  formatPhoneForVAPI(phoneNumber) {
    // Remove all non-numeric characters
    const numbers = phoneNumber.replace(/\D/g, '');
    
    // Format for UK numbers
    if (numbers.startsWith('44')) {
      return '+' + numbers;
    } else if (numbers.startsWith('0')) {
      return '+44' + numbers.slice(1);
    } else if (numbers.length >= 10) {
      return '+44' + numbers;
    }
    
    return phoneNumber;
  },
  
  // Build call payload for VAPI
  buildCallPayload(selectedAgent, phoneNumber, overrides = {}) {
    return {
      assistantId: selectedAgent.id,
      phoneNumberId: selectedAgent.phoneNumberId,
      customer: {
        number: this.formatPhoneForVAPI(phoneNumber)
      },
      assistantOverrides: {
        variableValues: {
          pronunciation: overrides.pronunciation || 'Demo User',
          first_name: overrides.first_name || 'Demo',
          email: overrides.email || 'demo@example.com',
          phone_number: this.formatPhoneForVAPI(phoneNumber),
          ...overrides
        }
      },
      metadata: {
        CRM_id: overrides.crm_id || 'demo-test-call',
        test_call: true,
        initiated_from: 'demo-dashboard',
        timestamp: new Date().toISOString(),
        ...overrides.metadata
      }
    };
  }
};

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
  window.apiHelpers = apiHelpers;
}

// Export for Node.js/module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, apiHelpers };
} 