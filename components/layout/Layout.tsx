import {
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  HelpCircle,
  History,
  Phone,
  Settings,
  TestTube2,
  User,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const [showCallHistory, setShowCallHistory] = useState(false);

  const navigation = [
    { name: 'Analytics', href: '/dashboard', icon: BarChart3, active: router.pathname === '/dashboard' },
    { name: 'Contacts', href: '/contacts', icon: Users, active: router.pathname === '/contacts' },
    { name: 'History', href: '/history', icon: History, active: router.pathname === '/history' },
    { name: 'Schedule', href: '/schedule', icon: Calendar, active: router.pathname === '/schedule' },
    { name: 'Test Calls', href: '/test-calls', icon: TestTube2, active: router.pathname === '/test-calls' },
    { name: 'How It Works', href: '/how-it-works', icon: HelpCircle, active: router.pathname === '/how-it-works' },
    { name: 'Settings', href: '/settings/agents', icon: HelpCircle, active: router.pathname === '/settings/agents' },
  ];

  const recentCalls = [
    {
      id: '1',
      contact: 'Contact A',
      phone: '+44 7XXX XXX001',
      outcome: 'Meeting Booked',
      duration: '2:34',
      time: '2 mins ago',
      status: 'success'
    },
    {
      id: '2',
      contact: 'Contact B',
      phone: '+44 7XXX XXX002',
      outcome: 'Callback Requested',
      duration: '1:42',
      time: '5 mins ago',
      status: 'pending'
    },
    {
      id: '3',
      contact: 'Contact C',
      phone: '+44 7XXX XXX003',
      outcome: 'Not Interested',
      duration: '0:48',
      time: '12 mins ago',
      status: 'failed'
    }
  ];

  const getPageTitle = () => {
    switch (router.pathname) {
      case '/': return 'Voice AI Dashboard';
      case '/dashboard': return 'Voice AI Analytics';
      case '/contacts': return 'Contact Management';
      case '/history': return 'Call History';
      case '/schedule': return 'Schedule Manager';
      case '/test-calls': return 'Test Center';
      case '/how-it-works': return 'Documentation';
      default: return 'Voice AI Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex">
      {/* Modern Sidebar */}
      <div className="w-80 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 flex flex-col">
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Voice AI</h1>
              <p className="text-sm text-slate-500">Analytics Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4">
          <div className="space-y-2">
            {navigation.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                    ${item.active 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }
                  `}
                >
                  <IconComponent className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Call History Section */}
          <div className="mt-8">
            <div className="px-4 mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recent Activity
              </p>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowCallHistory(!showCallHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100/60 rounded-xl transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5" />
                  <span>Recent Calls</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showCallHistory ? 'rotate-180' : ''}`} />
              </button>

              {showCallHistory && (
                <div className="mt-2 bg-white/60 backdrop-blur-xl rounded-xl border border-slate-200/50 overflow-hidden animate-slideDown">
                  <div className="max-h-64 overflow-y-auto">
                    {recentCalls.map((call) => (
                      <div key={call.id} className="px-4 py-3 hover:bg-slate-50/60 border-b border-slate-100/50 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-900 text-sm">{call.contact}</span>
                          <span className="text-xs text-slate-500">{call.time}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-600">{call.phone}</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-500">{call.duration}</span>
                          </div>
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            call.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                            call.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {call.outcome}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100/50">
                    <Link 
                      href="/history"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      onClick={() => setShowCallHistory(false)}
                    >
                      View all call history →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-200/50">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-100/60 rounded-xl">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Demo User</p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all duration-200">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/60 backdrop-blur-xl border-b border-slate-200/50 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{getPageTitle()}</h1>
              <p className="text-slate-600 mt-1">Real-time insights and performance metrics</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                Live
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all duration-200">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>

      {/* Click outside to close dropdown */}
      {showCallHistory && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowCallHistory(false)}
        />
      )}
    </div>
  );
};

export default Layout; 