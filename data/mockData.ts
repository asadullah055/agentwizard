// Re-export from centralized data for backward compatibility
export { 
  centralAnalyticsData as mockAnalyticsData,
  centralRecentCallsData as recentCallsData,
  getAnalyticsData,
  getRecentCalls,
  getDerivedMetrics,
  type AnalyticsData,
  type RecentCall
} from './centralData';

export const availableAgents = [
  { 
    id: 'f3b4e78d-86a5-42cd-95d2-8375cb73513f', 
    name: 'Daniel', 
    specialty: 'Mortgage Specialist',
    phoneNumberId: 'fa8ce041-da8b-4606-b7d4-c1898dc29203',
    status: 'active',
    total_calls: 1156,
    success_rate: 75.0
  },
  { 
    id: '868adc0a-e654-484d-87be-e2b784dd7e63', 
    name: 'David', 
    specialty: 'Lead Specialist',
    phoneNumberId: 'bcf19ea0-d655-4d78-bd0b-17b9bf1baf2a',
    status: 'active',
    total_calls: 1034,
    success_rate: 71.9
  },
  { 
    id: 'jo-assistant-id', 
    name: 'Christine', 
    specialty: 'Senior Advisor',
    phoneNumberId: 'jo-phone-number-id',
    status: 'active',
    total_calls: 657,
    success_rate: 79.8
  }
]; 