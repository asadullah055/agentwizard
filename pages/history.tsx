import {
  Clock,
  Filter,
  Search
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { generateCallDuration, generateExtendedDates, getAnalyticsData, getRecentCalls } from '../data/centralData';

// Generate call history from centralized data
const generateCallHistory = () => {
  const recentCalls = getRecentCalls();
  const analyticsData = getAnalyticsData();
  const callRecords = [];
  const totalRecords = 50;
  
  // Generate extended dates with max 2 calls per day
  const callDates = generateExtendedDates(totalRecords);
  
  // Track customers who eventually get meetings (20% chance)
  const customersWithMeetings = new Set<string>();
  for (let i = 0; i < totalRecords; i++) {
    const customerId = `Contact ${String.fromCharCode(65 + (i % 15))}`;
    if (Math.random() < 0.2) {
      customersWithMeetings.add(customerId);
    }
  }
  
  for (let i = 0; i < totalRecords; i++) {
    const baseCall = recentCalls[i % recentCalls.length];
    const customerId = `Contact ${String.fromCharCode(65 + (i % 15))}`;
    const hasMeeting = customersWithMeetings.has(customerId);
    
    let selectedOutcome;
    
    // If this customer has a meeting and this is their most recent call (i < 5), make it meeting booked
    if (hasMeeting && i < 3) {
      selectedOutcome = analyticsData.callOutcomes.find(o => o.name.toLowerCase() === 'meeting booked');
    } else {
      // For other calls, avoid meeting booked to show progression
      const progressionOutcomes = analyticsData.callOutcomes.filter(o => o.name.toLowerCase() !== 'meeting booked');
      selectedOutcome = progressionOutcomes[Math.floor(Math.random() * progressionOutcomes.length)];
    }
    
    if (!selectedOutcome) {
      selectedOutcome = analyticsData.callOutcomes[0];
    }
    
    callRecords.push({
      id: `call-${i + 1}`,
      phoneNumber: `+44 7XXX XXX${String((i % 15) + 1).padStart(3, '0')}`,
      customer: customerId,
      agent: `AI Assistant ${String.fromCharCode(65 + (i % 3))}`,
      outcome: selectedOutcome.name,
      duration: generateCallDuration(selectedOutcome.name),
      date: callDates[i] || new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Contact was responsive and showed interest in the service offering.'
    });
  }
  
  return callRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const CallHistoryPage: React.FC = () => {
  const [callRecords, setCallRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate data on client side to prevent hydration errors
  useEffect(() => {
    const records = generateCallHistory();
    setCallRecords(records);
    setFilteredRecords(records);
    setIsLoading(false);
  }, []);

  const getOutcomeColor = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'meeting booked': return 'bg-emerald-500 text-white';
      case 'callback requested': return 'bg-blue-500 text-white';
      case 'voicemail': return 'bg-amber-500 text-white';
      case 'not interested': return 'bg-red-500 text-white';
      case 'customer ended call': return 'bg-slate-500 text-white';
      case 'failed to connect': return 'bg-red-400 text-white';
      case 'no answer': return 'bg-slate-400 text-white';
      case 'test call': return 'bg-purple-500 text-white';
      default: return 'bg-slate-300 text-slate-700';
    }
  };

  React.useEffect(() => {
    let filtered = callRecords;

    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.phoneNumber?.includes(searchTerm) ||
        record.agent?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (outcomeFilter !== 'all') {
      filtered = filtered.filter(record => record.outcome === outcomeFilter);
    }

    if (agentFilter !== 'all') {
      filtered = filtered.filter(record => record.agent === agentFilter);
    }

    setFilteredRecords(filtered);
  }, [searchTerm, outcomeFilter, agentFilter, callRecords]);

  const outcomes = [...new Set(callRecords.map(record => record.outcome))];
  const agents = [...new Set(callRecords.map(record => record.agent))];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-slate-600">Loading call history...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Call History</h1>
            <p className="text-slate-600">
              {filteredRecords.length} of {callRecords.length} calls
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200/50 rounded-xl hover:bg-white/80 transition-all duration-200"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer, phone, or agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Outcome</label>
                  <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All Outcomes</option>
                    {outcomes.map(outcome => (
                      <option key={outcome} value={outcome}>{outcome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Agent</label>
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All Agents</option>
                    {agents.map(agent => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Call Records Table */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 border-b border-slate-200/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-white/40 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{record.customer}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {record.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {record.agent}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getOutcomeColor(record.outcome)}`}>
                        {record.outcome}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {record.duration}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(record.date).toLocaleDateString()} {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No calls found</h3>
              <p className="text-slate-600">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CallHistoryPage; 