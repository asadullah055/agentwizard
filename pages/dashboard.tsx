import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle,
  Clock,
  Phone,
  PhoneOff,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  AnalyticsCharts,
  LineChartComponent,
  PieChartComponent,
} from "../components/charts/AnalyticsCharts";
import Layout from "../components/layout/Layout";
import { Button } from "../components/ui/Button";
import {
  getAnalyticsData,
  getDerivedMetrics,
  getRecentCalls,
} from "../data/centralData";
import {
  getRetellClient,
  isCallActive as retellIsCallActive,
  off as retellOff,
  on as retellOn,
  stopCall as retellStopCall,
} from "../lib/retellClient";

const Dashboard: React.FC = () => {
  const analyticsData = getAnalyticsData();
  const derivedMetrics = getDerivedMetrics(analyticsData);
  const [recentCalls, setRecentCalls] = useState(getRecentCalls(5));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [callActive, setCallActive] = useState(false);

  useEffect(() => {
    getRetellClient().catch(() => {});
    setCallActive(retellIsCallActive());
    const started = () => setCallActive(true);
    const ended = () => setCallActive(false);
    const error = () => setCallActive(false);
    retellOn("call_started", started);
    retellOn("call_ended", ended);
    retellOn("error", error);
    return () => {
      retellOff("call_started", started);
      retellOff("call_ended", ended);
      retellOff("error", error);
    };
  }, []);

  const tabs = [
    { id: "overview", name: "Overview", icon: BarChart3 },
    { id: "performance", name: "Performance", icon: TrendingUp },
    { id: "activity", name: "Activity", icon: Activity },
    { id: "contacts", name: "Contacts", icon: Users },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Floating End Call control */}
        {callActive && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={() => retellStopCall()}
              className="bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-500/30 flex items-center gap-3 px-5 py-3 text-base rounded-xl"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </Button>
          </div>
        )}

        {/* Modern Tab Navigation */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-1 border border-slate-200/50">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6 border border-blue-200/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                      <ArrowUp className="w-4 h-4" />
                      {derivedMetrics.weeklyChange.calls}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {analyticsData.totalCalls}
                  </div>
                  <div className="text-slate-600 text-sm">Total Calls</div>
                  <div className="text-xs text-slate-500 mt-1">
                    +316 from last week
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 rounded-2xl p-6 border border-emerald-200/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-green-600/5"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-500 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                      <ArrowUp className="w-4 h-4" />
                      {derivedMetrics.weeklyChange.successRate}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {analyticsData.successRate}%
                  </div>
                  <div className="text-slate-600 text-sm">Success Rate</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Meeting conversion rate
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-6 border border-purple-200/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-violet-600/5"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-500 rounded-xl">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                      <ArrowUp className="w-4 h-4" />
                      {derivedMetrics.weeklyChange.pickupRate}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {analyticsData.pickupRate}%
                  </div>
                  <div className="text-slate-600 text-sm">Pickup Rate</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Calls answered
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl p-6 border border-amber-200/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-orange-600/5"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-amber-500 rounded-xl">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-red-500 text-sm font-medium">
                      <ArrowDown className="w-4 h-4" />
                      {derivedMetrics.weeklyChange.averageDuration}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {analyticsData.averageDuration}s
                  </div>
                  <div className="text-slate-600 text-sm">Avg Duration</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Optimal length
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-200/50">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Call Performance Metrics
                  </h3>
                  <p className="text-slate-600 text-sm">
                    Success, pickup, and connection rates
                  </p>
                </div>
                <div className="p-6">
                  <div className="h-80">
                    <AnalyticsCharts data={analyticsData} />
                  </div>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-200/50">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Call Outcomes
                  </h3>
                  <p className="text-slate-600 text-sm">
                    Distribution breakdown
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {analyticsData.callOutcomes.map((outcome, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: outcome.color }}
                          ></div>
                          <span className="text-slate-700 text-sm">
                            {outcome.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">
                            {outcome.percentage}%
                          </div>
                          <div className="text-xs text-slate-500">
                            {outcome.value} calls
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "performance" && (
          <div className="space-y-8">
            {/* Performance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-emerald-600 text-xs font-medium">
                    {derivedMetrics.weeklyChange.calls}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {analyticsData.totalCalls}
                </div>
                <div className="text-sm text-slate-600">Total Calls</div>
                <div className="text-xs text-slate-500 mt-1">
                  {derivedMetrics.dailyAverage}/day average
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-emerald-500 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-emerald-600 text-xs font-medium">
                    {derivedMetrics.weeklyChange.successRate}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {analyticsData.successRate}%
                </div>
                <div className="text-sm text-slate-600">Success Rate</div>
                <div className="text-xs text-slate-500 mt-1">
                  {derivedMetrics.totalMeetings} meetings booked
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-emerald-600 text-xs font-medium">
                    {derivedMetrics.weeklyChange.pickupRate}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {analyticsData.pickupRate}%
                </div>
                <div className="text-sm text-slate-600">Pickup Rate</div>
                <div className="text-xs text-slate-500 mt-1">
                  Calls answered
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-amber-500 rounded-lg">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-emerald-600 text-xs font-medium">
                    {derivedMetrics.weeklyChange.connectionRate}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {analyticsData.connectionRate}%
                </div>
                <div className="text-sm text-slate-600">Connection Rate</div>
                <div className="text-xs text-slate-500 mt-1">
                  Successfully connected
                </div>
              </div>
            </div>

            {/* Large Performance Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Performance Metrics Chart */}
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-200/50">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Performance Metrics
                  </h3>
                  <p className="text-slate-600 text-sm mt-1">
                    Success, pickup, and connection rates comparison
                  </p>
                </div>
                <div className="p-6">
                  <div className="h-96">
                    <AnalyticsCharts data={analyticsData} />
                  </div>
                </div>
              </div>

              {/* Call Outcomes Distribution */}
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-200/50">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Call Outcomes Distribution
                  </h3>
                  <p className="text-slate-600 text-sm mt-1">
                    Breakdown of call results and outcomes
                  </p>
                </div>
                <div className="p-6">
                  <div className="h-96">
                    <PieChartComponent data={analyticsData} />
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Performance */}
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
              <div className="p-6 border-b border-slate-200/50">
                <h3 className="text-xl font-semibold text-slate-900">
                  Weekly Performance Timeline
                </h3>
                <p className="text-slate-600 text-sm mt-1">
                  Daily call volume and success rate trends over the past week
                </p>
              </div>
              <div className="p-6">
                <div className="h-80">
                  <LineChartComponent data={analyticsData} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
              <div className="p-6 border-b border-slate-200/50">
                <h3 className="text-lg font-semibold text-slate-900">
                  Live Activity Feed
                </h3>
                <p className="text-slate-600 text-sm">Real-time call updates</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentCalls.map((call) => (
                    <div
                      key={call.id}
                      className="flex items-center gap-4 p-4 bg-white/50 rounded-xl border border-slate-200/30"
                    >
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          {call.contact_name}
                        </div>
                        <div className="text-sm text-slate-600">
                          {call.phone_number}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-900">
                          {call.outcome}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(call.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
              <div className="p-6 border-b border-slate-200/50">
                <h3 className="text-lg font-semibold text-slate-900">
                  System Health
                </h3>
                <p className="text-slate-600 text-sm">
                  Real-time system monitoring
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">AI Calling System</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-emerald-600 text-sm font-medium">
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Queue Processing</span>
                    <span className="text-slate-900 font-medium">
                      5 calls/batch
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Daily Limit</span>
                    <span className="text-slate-900 font-medium">
                      847 / 1000
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-blue-500 h-2 rounded-full"
                      style={{ width: "84.7%" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 overflow-hidden">
            <div className="p-6 border-b border-slate-200/50">
              <h3 className="text-lg font-semibold text-slate-900">
                Contact Overview
              </h3>
              <p className="text-slate-600 text-sm">
                Quick access to contact management
              </p>
            </div>
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Contact Management
              </h3>
              <p className="text-slate-600 mb-6">
                Access detailed contact information and call history
              </p>
              <Button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700">
                View Contact History
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
