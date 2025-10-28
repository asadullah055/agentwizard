// Centralized data management for consistency across all pages
export interface AnalyticsData {
  totalCalls: number;
  pickupRate: number;
  connectionRate: number;
  successRate: number;
  averageDuration: number;
  callOutcomes: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  timelineData: Array<{
    date: string;
    calls: number;
    pickups: number;
    meetings: number;
  }>;
}

export interface RecentCall {
  id: string;
  contact_name: string;
  phone_number: string;
  assistant: string;
  outcome: string;
  timestamp: string;
  duration: string;
}

// Helper function to generate realistic call duration based on outcome
export const generateCallDuration = (outcome: string): string => {
  let minSeconds = 30;
  let maxSeconds = 120;

  // Voicemail calls should be shorter (30s to 90s max)
  if (outcome.toLowerCase().includes("voicemail")) {
    maxSeconds = 90;
  }

  // Failed to connect and no answer should be very short
  if (
    outcome.toLowerCase().includes("failed to connect") ||
    outcome.toLowerCase().includes("no answer")
  ) {
    minSeconds = 15;
    maxSeconds = 45;
  }

  // Meeting booked calls tend to be longer
  if (outcome.toLowerCase().includes("meeting booked")) {
    minSeconds = 60;
    maxSeconds = 120;
  }

  const totalSeconds =
    Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

// Helper function to generate extended dates with max 2 calls per day
export const generateExtendedDates = (totalCalls: number): string[] => {
  const dates: string[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60); // Start 60 days ago

  let currentDate = new Date(startDate);
  let callsThisDay = 0;
  let callIndex = 0;

  while (callIndex < totalCalls) {
    // If we've reached 2 calls for this day, move to next day
    if (callsThisDay >= 2) {
      currentDate.setDate(currentDate.getDate() + 1);
      callsThisDay = 0;
    }

    // Add some random hours and minutes to the current date
    const callTime = new Date(currentDate);
    callTime.setHours(9 + Math.floor(Math.random() * 8)); // 9 AM to 5 PM
    callTime.setMinutes(Math.floor(Math.random() * 60));
    callTime.setSeconds(Math.floor(Math.random() * 60));

    dates.push(callTime.toISOString());
    callsThisDay++;
    callIndex++;

    // Sometimes skip days (weekends, etc.)
    if (Math.random() > 0.7) {
      currentDate.setDate(currentDate.getDate() + 1);
      callsThisDay = 0;
    }
  }

  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Most recent first
};

// Central data store - outcomes ordered by percentage (largest to smallest)
export const centralAnalyticsData: AnalyticsData = {
  totalCalls: 349,
  pickupRate: 66.5,
  connectionRate: 78.2,
  successRate: 3.2,
  averageDuration: 75, // Updated to reflect 30s-2min range
  callOutcomes: [
    { name: "Voicemail", value: 114, percentage: 32.7, color: "#3B82F6" },
    {
      name: "Customer ended call",
      value: 88,
      percentage: 25.2,
      color: "#10B981",
    },
    {
      name: "Failed to connect",
      value: 66,
      percentage: 18.9,
      color: "#F59E0B",
    },
    { name: "No answer", value: 63, percentage: 18.1, color: "#EF4444" },
    {
      name: "Callback requested",
      value: 22,
      percentage: 6.3,
      color: "#8B5CF6",
    },
    { name: "Meeting booked", value: 18, percentage: 5.1, color: "#10B981" },
    { name: "Not interested", value: 12, percentage: 3.4, color: "#EF4444" },
  ],
  timelineData: [
    { date: "2024-01-01", calls: 23, pickups: 15, meetings: 1 },
    { date: "2024-01-02", calls: 31, pickups: 21, meetings: 1 },
    { date: "2024-01-03", calls: 28, pickups: 19, meetings: 1 },
    { date: "2024-01-04", calls: 34, pickups: 23, meetings: 1 },
    { date: "2024-01-05", calls: 29, pickups: 20, meetings: 1 },
    { date: "2024-01-06", calls: 26, pickups: 17, meetings: 1 },
    { date: "2024-01-07", calls: 32, pickups: 22, meetings: 1 },
  ],
};

export const centralRecentCallsData: RecentCall[] = [
  {
    id: "1",
    contact_name: "Contact Alpha",
    phone_number: "+44 7XXX XXX001",
    assistant: "AI Assistant A",
    outcome: "Meeting booked",
    timestamp: "2024-01-15T14:30:00Z",
    duration: "2:04",
  },
  {
    id: "2",
    contact_name: "Contact Beta",
    phone_number: "+44 7XXX XXX002",
    assistant: "AI Assistant B",
    outcome: "Callback requested",
    timestamp: "2024-01-15T14:25:00Z",
    duration: "1:42",
  },
  {
    id: "3",
    contact_name: "Contact Gamma",
    phone_number: "+44 7XXX XXX003",
    assistant: "AI Assistant A",
    outcome: "Voicemail",
    timestamp: "2024-01-15T14:20:00Z",
    duration: "0:48",
  },
  {
    id: "4",
    contact_name: "Contact Delta",
    phone_number: "+44 7XXX XXX004",
    assistant: "AI Assistant C",
    outcome: "Not interested",
    timestamp: "2024-01-15T14:15:00Z",
    duration: "1:15",
  },
  {
    id: "5",
    contact_name: "Contact Echo",
    phone_number: "+44 7XXX XXX005",
    assistant: "AI Assistant B",
    outcome: "Customer ended call",
    timestamp: "2024-01-15T14:10:00Z",
    duration: "1:22",
  },
  {
    id: "6",
    contact_name: "Contact Foxtrot",
    phone_number: "+44 7XXX XXX006",
    assistant: "AI Assistant A",
    outcome: "Failed to connect",
    timestamp: "2024-01-15T14:05:00Z",
    duration: "0:32",
  },
  {
    id: "7",
    contact_name: "Contact Golf",
    phone_number: "+44 7XXX XXX007",
    assistant: "AI Assistant C",
    outcome: "Meeting booked",
    timestamp: "2024-01-15T14:00:00Z",
    duration: "1:58",
  },
  {
    id: "8",
    contact_name: "Contact Hotel",
    phone_number: "+44 7XXX XXX008",
    assistant: "AI Assistant B",
    outcome: "Callback requested",
    timestamp: "2024-01-15T13:55:00Z",
    duration: "1:05",
  },
];

// Derived calculations for consistency
export const getDerivedMetrics = (data: AnalyticsData) => {
  const totalMeetings = data.timelineData.reduce(
    (sum, day) => sum + day.meetings,
    0
  );
  const weeklyChange = {
    calls: "+12%",
    successRate: "+0.2%",
    pickupRate: "+8.3%",
    connectionRate: "+3.1%",
    averageDuration: "+5s",
  };

  return {
    totalMeetings,
    weeklyChange,
    dailyAverage: Math.round(data.totalCalls / 7),
    conversionRate: ((totalMeetings / data.totalCalls) * 100).toFixed(1),
  };
};

// Export functions for consistent data access
export const getAnalyticsData = (): AnalyticsData => centralAnalyticsData;
export const getRecentCalls = (limit?: number): RecentCall[] =>
  limit ? centralRecentCallsData.slice(0, limit) : centralRecentCallsData;
