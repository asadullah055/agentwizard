import React from 'react';
import Layout from '../components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import Link from 'next/link';
import { 
  Database, 
  Calendar, 
  Bot, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle, 
  Zap, 
  Plus, 
  History, 
  Users, 
  Settings, 
  BarChart3 
} from 'lucide-react';

const HowItWorksPage: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">How The System Works</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A comprehensive guide to our automated calling and contact management system
          </p>
        </div>

        {/* System Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Our Voice AI system is a fully automated calling platform that connects with your CRM to make intelligent, 
              scheduled calls to your prospects. The system handles everything from contact data enhancement to call analytics, 
              ensuring maximum efficiency and conversion rates.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Contact Database</h3>
                <p className="text-sm text-gray-600">
                  Centralized storage of all contact information, call history, and outcomes.
                </p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Real-time sync with CRM</li>
                  <li>• Enhanced contact profiles</li>
                  <li>• Call attempt tracking</li>
                  <li>• Success rate analytics</li>
                </ul>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Smart Scheduling</h3>
                <p className="text-sm text-gray-600">
                  Intelligent call scheduling based on contact preferences and optimal calling times.
                </p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Timezone-aware scheduling</li>
                  <li>• Frequency management</li>
                  <li>• Batch processing</li>
                  <li>• Queue optimization</li>
                </ul>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI Voice Calls</h3>
                <p className="text-sm text-gray-600">
                  Natural, conversational AI that handles calls professionally and collects important data.
                </p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Multiple AI assistants</li>
                  <li>• Call recording</li>
                  <li>• Real-time transcription</li>
                  <li>• Outcome classification</li>
                </ul>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Analytics & Insights</h3>
                <p className="text-sm text-gray-600">
                  Comprehensive analytics and reporting for optimization and insights.
                </p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Real-time metrics</li>
                  <li>• Conversion tracking</li>
                  <li>• Performance analysis</li>
                  <li>• Detailed reporting</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How The Process Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">How The Process Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    1
                  </div>
                  <h3 className="font-semibold text-gray-900">Contact Import</h3>
                </div>
                <p className="text-sm text-gray-600 pl-11">
                  Contacts are automatically imported from your GHL CRM and enhanced with additional data
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    2
                  </div>
                  <h3 className="font-semibold text-gray-900">Smart Queuing</h3>
                </div>
                <p className="text-sm text-gray-600 pl-11">
                  Contacts are intelligently queued based on calling rules, frequency limits, and schedules
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    3
                  </div>
                  <h3 className="font-semibold text-gray-900">AI Calling</h3>
                </div>
                <p className="text-sm text-gray-600 pl-11">
                  Our AI assistants make calls, handle conversations, and collect valuable prospect data
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    4
                  </div>
                  <h3 className="font-semibold text-gray-900">Data Analysis</h3>
                </div>
                <p className="text-sm text-gray-600 pl-11">
                  Results are analyzed, contacts are updated, and insights are generated for your team
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Automation Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Automation Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <span className="text-gray-700">Automated contact enhancement from CRM</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <span className="text-gray-700">Intelligent call scheduling and batching</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <span className="text-gray-700">Real-time call outcome processing</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <span className="text-gray-700">Automatic retry logic for failed calls</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <span className="text-gray-700">Webhook-based data synchronization</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Analytics & Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Analytics & Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                  <span className="text-gray-700">Real-time call performance metrics</span>
                </li>
                <li className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                  <span className="text-gray-700">Contact conversion tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                  <span className="text-gray-700">Optimal calling time analysis</span>
                </li>
                <li className="flex items-start gap-3">
                  <History className="w-5 h-5 text-blue-600 mt-0.5" />
                  <span className="text-gray-700">Detailed call history and recordings</span>
                </li>
                <li className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-blue-600 mt-0.5" />
                  <span className="text-gray-700">Assistant performance comparison</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Technical Architecture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Technical Architecture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Data Layer</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Supabase PostgreSQL database</li>
                  <li>• Real-time data synchronization</li>
                  <li>• Automated backup and recovery</li>
                  <li>• GDPR-compliant data handling</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Integration Layer</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• CRM system integration</li>
                  <li>• Voice AI calling platform</li>
                  <li>• Workflow automation engine</li>
                  <li>• Real-time webhook processing</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Security Layer</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• End-to-end encryption</li>
                  <li>• API key management</li>
                  <li>• Audit trail logging</li>
                  <li>• Access control systems</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Monitoring Layer</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Real-time performance metrics</li>
                  <li>• System health monitoring</li>
                  <li>• Error tracking & alerts</li>
                  <li>• Usage analytics</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent System Enhancements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Recent System Enhancements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    New
                  </span>
                  <h3 className="font-semibold text-gray-900">Contact Data Enhancement</h3>
                </div>
                <p className="text-gray-600">Automated CRON job that enhances contact records with CRM data every 10 minutes</p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Fixed
                  </span>
                  <h3 className="font-semibold text-gray-900">Call History Display</h3>
                </div>
                <p className="text-gray-600">Resolved date display issues and improved contact name resolution</p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Enhanced
                  </span>
                  <h3 className="font-semibold text-gray-900">Database Functions</h3>
                </div>
                <p className="text-gray-600">Optimized contact call history retrieval with proper date handling</p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    Added
                  </span>
                  <h3 className="font-semibold text-gray-900">Edge Function Deployment</h3>
                </div>
                <p className="text-gray-600">Automated contact enhancement processing with GHL API integration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Quick Start Guide</CardTitle>
            <p className="text-gray-600">Ready to get started? Here's what you can do right now:</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/history">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 w-full">
                  <History className="w-8 h-8" />
                  <span className="font-medium">View Call History</span>
                  <span className="text-xs text-gray-500">See all past calls and their outcomes</span>
                </Button>
              </Link>

              <Link href="/contacts">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 w-full">
                  <Users className="w-8 h-8" />
                  <span className="font-medium">Check Contact Database</span>
                  <span className="text-xs text-gray-500">Review enhanced contact information</span>
                </Button>
              </Link>

              <Link href="/schedule">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 w-full">
                  <Settings className="w-8 h-8" />
                  <span className="font-medium">Configure Settings</span>
                  <span className="text-xs text-gray-500">Adjust calling schedules and preferences</span>
                </Button>
              </Link>

              <Link href="/">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 w-full">
                  <BarChart3 className="w-8 h-8" />
                  <span className="font-medium">Monitor Analytics</span>
                  <span className="text-xs text-gray-500">Track performance and conversion rates</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default HowItWorksPage; 