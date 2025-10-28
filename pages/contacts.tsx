import {
  AlertCircle,
  Brain,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Filter,
  History,
  MessageSquare,
  Phone,
  Search,
  Target,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { Button } from "../components/ui/Button";
import {
  generateCallDuration,
  generateExtendedDates,
  getAnalyticsData,
  getRecentCalls,
} from "../data/centralData";
// Generate realistic transcript based on call outcome
const generateTranscript = (
  outcome: string,
  duration: string,
  contactName: string
): string => {
  const templates = {
    "Meeting booked": `AI: Hello, is this ${contactName}?
Contact: Yes, speaking.
AI: Hi ${contactName}, this is calling from our voice AI system regarding your recent inquiry about our services. Do you have a moment to chat?
Contact: Sure, what's this about?
AI: Great! I wanted to follow up on your interest in our automation solutions. Based on your profile, I think our AI calling system could really help streamline your business operations.
Contact: That sounds interesting. I've been looking for ways to improve our outreach.
AI: Perfect! I'd love to schedule a brief 15-minute demo where we can show you exactly how it works and discuss your specific needs. Are you available this Thursday at 2 PM?
Contact: Thursday works for me. What should I expect?
AI: Excellent! I'll send you a calendar invite. The demo will cover our AI capabilities, integration options, and we'll discuss how it can fit into your current workflow. You'll also get to see real results from similar businesses.
Contact: Sounds good, looking forward to it.
AI: Perfect! You'll receive the meeting details shortly. Thank you for your time, ${contactName}.`,

    Voicemail: `AI: Hello, this is calling from our voice AI system. I was trying to reach ${contactName} regarding their recent inquiry about our automation solutions. 

I wanted to follow up and share some exciting information about how our AI calling system is helping businesses like yours increase efficiency and reduce manual work. 

I'll try calling back tomorrow, but if you'd like to connect sooner, feel free to call us back at your convenience. We have some great case studies I think you'd find valuable.

Thank you, and have a great day!`,

    "Customer ended call": `AI: Hello, is this ${contactName}?
Contact: Yes, who is this?
AI: Hi, this is calling from our voice AI system regarding your inquiry about automation solutions.
Contact: I'm not interested in this right now.
AI: I understand. Just to clarify, this is about the business automation tools you showed interest in last week. It would only take—
Contact: No thank you, please remove me from your list.
AI: Of course, I'll make sure to update your preferences. Have a good day.`,

    "Not interested": `AI: Hello, is this ${contactName}?
Contact: Yes, speaking.
AI: Hi ${contactName}, this is calling from our voice AI system about your recent inquiry.
Contact: Oh, I remember filling out that form, but I've decided to go with a different solution.
AI: I understand completely. May I ask what solution you chose? Just for our feedback.
Contact: We went with a local provider that could offer more hands-on support.
AI: That makes perfect sense. Thank you for letting me know, and best of luck with your new solution!
Contact: Thanks, bye.`,

    "Failed to connect": `[Call failed to connect - Technical error or invalid number]`,

    "No answer": `[Phone rang but no answer - Voicemail not available]`,

    "Callback requested": `AI: Hello, is this ${contactName}?
Contact: Yes, this is ${contactName}.
AI: Hi, this is calling from our voice AI system regarding your inquiry about automation solutions.
Contact: Actually, this isn't a great time. I'm in the middle of something important.
AI: I completely understand. Would you prefer if I called back at a better time?
Contact: Yes, could you try me tomorrow afternoon? I'll have more time to talk then.
AI: Absolutely! I'll call you tomorrow between 2-4 PM. Does that work?
Contact: Perfect, talk to you then.
AI: Great, thank you ${contactName}. Have a wonderful day!`,
  };

  return (
    templates[outcome as keyof typeof templates] ||
    templates["Customer ended call"]
  );
};

// Generate post-call analysis based on outcome
const generateAnalysis = (outcome: string, duration: string): any => {
  const analyses = {
    "Meeting booked": {
      sentiment: "Positive",
      confidence: 0.87,
      keyPoints: [
        "Contact expressed genuine interest in automation solutions",
        "Currently looking for ways to improve outreach efficiency",
        "Available for demo on Thursday at 2 PM",
        "Wants to see real results from similar businesses",
      ],
      nextSteps: [
        "Send calendar invite for Thursday 2 PM demo",
        "Prepare case studies from similar industry",
        "Set up demo environment with relevant use cases",
        "Follow up with confirmation email 24 hours before",
      ],
      aiInsights:
        "High-quality lead with strong purchase intent. Contact was engaged throughout the conversation and asked relevant questions about implementation.",
      conversionProbability: "High (78%)",
      recommendedActions:
        "Priority follow-up. Prepare customized demo focusing on outreach automation.",
    },

    Voicemail: {
      sentiment: "Neutral",
      confidence: 0.92,
      keyPoints: [
        "Professional voicemail left",
        "Mentioned previous inquiry",
        "Offered case studies and value proposition",
        "Set expectation for follow-up call",
      ],
      nextSteps: [
        "Schedule follow-up call for next business day",
        "Prepare case studies mentioned in voicemail",
        "Try alternative contact methods if available",
        "Update contact preferences based on best times",
      ],
      aiInsights:
        "Standard voicemail delivery. Message was professional and included clear value proposition.",
      conversionProbability: "Medium (45%)",
      recommendedActions:
        "Continue nurture sequence. Try calling at different times.",
    },

    "Customer ended call": {
      sentiment: "Negative",
      confidence: 0.91,
      keyPoints: [
        "Contact answered but was not receptive",
        "Requested to be removed from calling list",
        "Showed no interest in learning more",
        "Professional but firm rejection",
      ],
      nextSteps: [
        "Update contact preferences to DNC (Do Not Call)",
        "Remove from active calling campaigns",
        "Consider alternative marketing channels",
        "Respect contact preference completely",
      ],
      aiInsights:
        "Clear rejection with DNC request. Contact was polite but firm about not wanting further contact.",
      conversionProbability: "Very Low (5%)",
      recommendedActions:
        "Honor DNC request. Remove from all calling lists immediately.",
    },

    "Not interested": {
      sentiment: "Neutral",
      confidence: 0.85,
      keyPoints: [
        "Contact was polite and professional",
        "Already chose alternative solution",
        "Went with local provider for hands-on support",
        "Provided constructive feedback",
      ],
      nextSteps: [
        'Update lead status to "Competitor Chosen"',
        "Log feedback about local provider preference",
        "Consider offering local support options for future",
        "Add to long-term nurture for future needs",
      ],
      aiInsights:
        "Professional interaction with valuable feedback. Contact chose competitor but conversation was positive.",
      conversionProbability: "Low (15%)",
      recommendedActions:
        "Long-term nurture. Consider partnership with local providers.",
    },

    "Failed to connect": {
      sentiment: "Neutral",
      confidence: 0.95,
      keyPoints: [
        "Technical connection failure",
        "Unable to establish call",
        "No contact interaction occurred",
        "System-level issue",
      ],
      nextSteps: [
        "Verify phone number accuracy",
        "Try calling at different time",
        "Check for carrier-specific issues",
        "Consider SMS or email outreach",
      ],
      aiInsights:
        "Technical failure - no meaningful interaction data available.",
      conversionProbability: "Unknown",
      recommendedActions: "Retry with verified contact information.",
    },

    "No answer": {
      sentiment: "Neutral",
      confidence: 0.9,
      keyPoints: [
        "Phone rang but no answer",
        "No voicemail system available",
        "Unable to leave message",
        "Contact may be unavailable",
      ],
      nextSteps: [
        "Try calling at different times of day",
        "Consider sending SMS if available",
        "Try alternative contact methods",
        "Schedule callback for peak hours",
      ],
      aiInsights:
        "No contact made. May indicate wrong timing or phone number issues.",
      conversionProbability: "Unknown",
      recommendedActions:
        "Retry during business hours. Verify contact information.",
    },

    "Callback requested": {
      sentiment: "Positive",
      confidence: 0.82,
      keyPoints: [
        "Contact was receptive but busy",
        "Specifically requested callback",
        "Provided preferred time window",
        "Professional and courteous interaction",
      ],
      nextSteps: [
        "Schedule callback for tomorrow 2-4 PM",
        "Set reminder in system for follow-up",
        "Prepare talking points for next conversation",
        "Mark contact as engaged lead",
      ],
      aiInsights:
        "Positive engagement. Contact showed interest but needed better timing for conversation.",
      conversionProbability: "Medium-High (65%)",
      recommendedActions:
        "High priority callback. Contact is engaged and interested.",
    },
  };

  return (
    analyses[outcome as keyof typeof analyses] ||
    analyses["Customer ended call"]
  );
};

// Generate contact history for each contact
const generateContactHistory = (
  contactId: string,
  callCount: number,
  shouldEndWithMeeting: boolean = false
) => {
  const analyticsData = getAnalyticsData();
  const outcomes = analyticsData.callOutcomes;
  const history = [];

  // Generate extended dates with max 2 calls per day
  const callDates = generateExtendedDates(callCount);

  for (let i = 0; i < callCount; i++) {
    let selectedOutcome;

    // If this is the most recent call (index 0) and should end with meeting, use meeting booked
    if (i === 0 && shouldEndWithMeeting) {
      selectedOutcome =
        outcomes.find((o) => o.name.toLowerCase() === "meeting booked") ||
        outcomes[0];
    } else {
      // For earlier calls, avoid meeting booked to show progression
      const progressionOutcomes = outcomes.filter(
        (o) => o.name.toLowerCase() !== "meeting booked"
      );
      selectedOutcome =
        progressionOutcomes[
          Math.floor(Math.random() * progressionOutcomes.length)
        ];
    }

    const duration = generateCallDuration(selectedOutcome.name);

    history.push({
      id: `${contactId}-call-${i + 1}`,
      date:
        callDates[i] ||
        new Date(
          Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000
        ).toISOString(),
      outcome: selectedOutcome.name,
      duration: duration,
      assistant: `AI Assistant ${String.fromCharCode(65 + (i % 3))}`,
      notes:
        "Call completed successfully. Contact showed interest in the service.",
      transcript: generateTranscript(selectedOutcome.name, duration, ""),
      analysis: generateAnalysis(selectedOutcome.name, duration),
    });
  }

  return history.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

// Generate more contacts from centralized data
const generateContactsData = () => {
  const baseContacts = getRecentCalls();
  const expandedContacts = [];

  for (let i = 0; i < 25; i++) {
    const baseContact = baseContacts[i % baseContacts.length];
    const callCount = Math.floor(Math.random() * 8) + 3; // 3-10 calls
    const contactId = `contact-${i + 1}`;
    const contactName = `Contact ${String.fromCharCode(65 + (i % 26))}${
      i > 25 ? Math.floor(i / 26) : ""
    }`;

    // 30% chance of ending with a meeting booked
    const shouldEndWithMeeting = Math.random() < 0.3;
    const finalOutcome = shouldEndWithMeeting
      ? "Meeting booked"
      : baseContact.outcome;

    expandedContacts.push({
      id: contactId,
      name: contactName,
      phone: `+44 7XXX XXX${String(i + 1).padStart(3, "0")}`,
      email: `contact${i + 1}@demo.com`,
      lastCalled: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      callCount: callCount,
      lastOutcome: finalOutcome,
      tag: ["Hot Lead", "Warm Lead", "Cold Lead", "Follow-up", "Prospect"][
        Math.floor(Math.random() * 5)
      ],
      created: new Date(
        Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      history: generateContactHistory(
        contactId,
        callCount,
        shouldEndWithMeeting
      ).map((call) => ({
        ...call,
        transcript: generateTranscript(
          call.outcome,
          call.duration,
          contactName
        ),
      })),
    });
  }

  return expandedContacts;
};

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Use useEffect to generate data only on client side to prevent hydration errors
  useEffect(() => {
    setContacts(generateContactsData());
    setIsLoading(false);
  }, []);

  const getOutcomeColor = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case "meeting booked":
        return "bg-emerald-500 text-white";
      case "callback requested":
        return "bg-blue-500 text-white";
      case "voicemail":
        return "bg-amber-500 text-white";
      case "not interested":
        return "bg-red-500 text-white";
      case "customer ended call":
        return "bg-slate-500 text-white";
      case "failed to connect":
        return "bg-red-400 text-white";
      case "no answer":
        return "bg-slate-400 text-white";
      case "test call":
        return "bg-purple-500 text-white";
      default:
        return "bg-slate-300 text-slate-700";
    }
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case "Hot Lead":
        return "bg-red-100 text-red-800";
      case "Warm Lead":
        return "bg-orange-100 text-orange-800";
      case "Cold Lead":
        return "bg-blue-100 text-blue-800";
      case "Follow-up":
        return "bg-purple-100 text-purple-800";
      case "Prospect":
        return "bg-green-100 text-green-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case "positive":
        return "text-emerald-600";
      case "negative":
        return "text-red-600";
      case "neutral":
        return "text-slate-600";
      default:
        return "text-slate-600";
    }
  };

  const getConversionColor = (probability: string) => {
    if (probability.includes("High")) return "text-emerald-600";
    if (probability.includes("Medium")) return "text-amber-600";
    if (probability.includes("Low")) return "text-red-600";
    return "text-slate-600";
  };

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.includes(searchTerm) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || contact.lastOutcome === filter;
    return matchesSearch && matchesFilter;
  });

  const toggleExpanded = (contactId: string) => {
    setExpandedContact(expandedContact === contactId ? null : contactId);
  };

  const openCallAnalysis = (call: any) => {
    setSelectedCall(call);
  };

  const closeCallAnalysis = () => {
    setSelectedCall(null);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-slate-600">Loading contacts...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Contact Management
            </h1>
            <p className="text-slate-600">
              Manage your contact database and call history -{" "}
              {filteredContacts.length} contacts
            </p>
          </div>
          <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <User className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
        {/* 👇👇👇 New section for CSV upload */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
          {/* <CsvUploadWizard /> */}
        </div>
        {/* Search and Filters */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 px-4 py-2 bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Outcomes</option>
                <option value="Voicemail">Voicemail</option>
                <option value="Customer ended call">Customer ended call</option>
                <option value="Failed to connect">Failed to connect</option>
                <option value="No answer">No answer</option>
                <option value="Callback requested">Callback requested</option>
                <option value="Meeting booked">Meeting booked</option>
                <option value="Not interested">Not interested</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 border-b border-slate-200/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Phone & Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Tag
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Outcome
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Called
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {filteredContacts.map((contact) => (
                  <React.Fragment key={contact.id}>
                    {/* Main Contact Row */}
                    <tr className="hover:bg-white/40 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div className="font-medium text-slate-900">
                            {contact.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">
                          {contact.phone}
                        </div>
                        <div className="text-xs text-slate-500">
                          {contact.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${getTagColor(
                            contact.tag
                          )}`}
                        >
                          {contact.tag}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">
                          {contact.callCount}
                        </div>
                        <div className="text-xs text-slate-500">
                          total calls
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${getOutcomeColor(
                            contact.lastOutcome
                          )}`}
                        >
                          {contact.lastOutcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div>
                          {new Date(contact.lastCalled).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(contact.lastCalled).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => toggleExpanded(contact.id)}
                            className="p-2"
                          >
                            {expandedContact === contact.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          <Button variant="ghost" className="p-2">
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" className="p-2">
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Contact History */}
                    {expandedContact === contact.id && contact.history && (
                      <tr>
                        <td colSpan={7} className="px-6 py-0">
                          <div className="bg-slate-50/50 rounded-xl mx-6 mb-4 border border-slate-200/30">
                            <div className="p-4 border-b border-slate-200/50">
                              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Call History for {contact.name}
                              </h4>
                            </div>
                            <div className="p-4">
                              {contact.history.length > 0 ? (
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                  {contact.history.map((call: any) => (
                                    <div
                                      key={call.id}
                                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200/50 hover:bg-slate-50 transition-colors duration-150"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <Calendar className="w-4 h-4 text-slate-400" />
                                          <span className="text-sm text-slate-600">
                                            {new Date(
                                              call.date
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-4 h-4 text-slate-400" />
                                          <span className="text-sm text-slate-600">
                                            {call.duration}
                                          </span>
                                        </div>
                                        <span
                                          className={`px-2 py-1 rounded text-xs font-medium ${getOutcomeColor(
                                            call.outcome
                                          )}`}
                                        >
                                          {call.outcome}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <div className="text-sm font-medium text-slate-900">
                                            {call.assistant}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {new Date(
                                              call.date
                                            ).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          onClick={() => openCallAnalysis(call)}
                                          className="p-2 hover:bg-blue-100"
                                          title="View Post-Call Analysis"
                                        >
                                          <FileText className="w-4 h-4 text-blue-600" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-6 text-slate-500">
                                  No call history available
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {filteredContacts.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No contacts found
              </h3>
              <p className="text-slate-600">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>

        {/* Post-Call Analysis Modal */}
        {selectedCall && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Brain className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Post-Call Analysis
                    </h2>
                    <p className="text-sm text-slate-600">
                      {new Date(selectedCall.date).toLocaleDateString()} •{" "}
                      {selectedCall.duration} • {selectedCall.assistant}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={closeCallAnalysis}
                  className="p-2"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="p-6 space-y-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Sentiment
                        </span>
                      </div>
                      <div
                        className={`text-lg font-bold ${getSentimentColor(
                          selectedCall.analysis.sentiment
                        )}`}
                      >
                        {selectedCall.analysis.sentiment}
                      </div>
                      <div className="text-xs text-slate-500">
                        {Math.round(selectedCall.analysis.confidence * 100)}%
                        confidence
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Outcome
                        </span>
                      </div>
                      <div className="text-lg font-bold text-slate-900">
                        {selectedCall.outcome}
                      </div>
                      <div className="text-xs text-slate-500">
                        {selectedCall.duration}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Conversion Probability
                        </span>
                      </div>
                      <div
                        className={`text-lg font-bold ${getConversionColor(
                          selectedCall.analysis.conversionProbability
                        )}`}
                      >
                        {selectedCall.analysis.conversionProbability}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">
                          Transcript
                        </span>
                      </div>
                      <div className="text-lg font-bold text-slate-900">
                        Available
                      </div>
                      <div className="text-xs text-slate-500">
                        Full conversation
                      </div>
                    </div>
                  </div>

                  {/* Key Insights */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Key Points */}
                    <div className="bg-blue-50 rounded-xl p-6">
                      <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Key Points
                      </h3>
                      <ul className="space-y-2">
                        {selectedCall.analysis.keyPoints.map(
                          (point: string, index: number) => (
                            <li
                              key={index}
                              className="text-sm text-blue-800 flex items-start gap-2"
                            >
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              {point}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    {/* Next Steps */}
                    <div className="bg-emerald-50 rounded-xl p-6">
                      <h3 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Next Steps
                      </h3>
                      <ul className="space-y-2">
                        {selectedCall.analysis.nextSteps.map(
                          (step: string, index: number) => (
                            <li
                              key={index}
                              className="text-sm text-emerald-800 flex items-start gap-2"
                            >
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                              {step}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* AI Insights */}
                  <div className="bg-purple-50 rounded-xl p-6">
                    <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      AI Insights & Recommendations
                    </h3>
                    <p className="text-purple-800 mb-4">
                      {selectedCall.analysis.aiInsights}
                    </p>
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-medium text-purple-900 mb-2">
                        Recommended Actions:
                      </h4>
                      <p className="text-purple-800 text-sm">
                        {selectedCall.analysis.recommendedActions}
                      </p>
                    </div>
                  </div>

                  {/* Full Transcript */}
                  <div className="bg-slate-50 rounded-xl p-6">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Full Transcript
                    </h3>
                    <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                        {selectedCall.transcript}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-200 bg-slate-50">
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={closeCallAnalysis}>
                    Close
                  </Button>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    Export Analysis
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ContactsPage;
