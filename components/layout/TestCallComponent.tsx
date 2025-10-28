import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { availableAgents } from '../../data/mockData';

interface TestCallComponentProps {
  onCallInitiated?: (callData: any) => void;
}

export const TestCallComponent: React.FC<TestCallComponentProps> = ({ onCallInitiated }) => {
  const [selectedAgent, setSelectedAgent] = useState(availableAgents[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'completed' | 'failed'>('idle');
  const [callDuration, setCallDuration] = useState(0);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, '');
    
    // Format as UK number if it looks like one
    if (numbers.startsWith('44')) {
      return `+44 ${numbers.slice(2, 6)} ${numbers.slice(6, 9)} ${numbers.slice(9, 12)}`;
    } else if (numbers.startsWith('0')) {
      return `+44 ${numbers.slice(1, 5)} ${numbers.slice(5, 8)} ${numbers.slice(8, 11)}`;
    } else if (numbers.length === 10) {
      return `+44 ${numbers.slice(0, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7, 10)}`;
    }
    
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const initiateTestCall = async () => {
    if (!phoneNumber.trim()) {
      alert('Please enter a phone number');
      return;
    }

    setIsLoading(true);
    setCallStatus('calling');
    
    try {
      // Simulate API call to your actual VAPI endpoint
      const response = await fetch('/api/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistantId: selectedAgent.id,
          phoneNumberId: selectedAgent.phoneNumberId,
          customer: {
            number: phoneNumber
          },
          assistantOverrides: {
            variableValues: {
              pronunciation: 'Demo User',
              first_name: 'Demo',
              email: 'demo@example.com',
              phone_number: phoneNumber
            }
          },
          metadata: {
            CRM_id: 'demo-test-call',
            test_call: true,
            initiated_from: 'demo-dashboard'
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setCallStatus('connected');
        
        // Simulate call progression
        setTimeout(() => {
          setCallStatus('completed');
          setCallDuration(Math.floor(Math.random() * 300) + 60); // Random duration 1-5 minutes
          
          onCallInitiated?.({
            id: result.call_id || 'demo_' + Date.now(),
            phone_number: phoneNumber,
            assistant: selectedAgent.name,
            status: 'completed',
            duration: callDuration,
            timestamp: new Date().toISOString()
          });
        }, 3000);
        
      } else {
        throw new Error('Failed to initiate call');
      }
    } catch (error) {
      console.error('Test call failed:', error);
      setCallStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCall = () => {
    setCallStatus('idle');
    setCallDuration(0);
    setPhoneNumber('');
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'calling': return 'text-yellow-600 bg-yellow-50';
      case 'connected': return 'text-blue-600 bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling': return 'Initiating call...';
      case 'connected': return 'Call in progress...';
      case 'completed': return `Call completed (${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')})`;
      case 'failed': return 'Call failed';
      default: return 'Ready to call';
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-blue-600">📞</span>
          Test Voice AI Call
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select AI Assistant
          </label>
          <select 
            value={selectedAgent.id}
            onChange={(e) => setSelectedAgent(availableAgents.find(a => a.id === e.target.value) || availableAgents[0])}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={callStatus === 'calling' || callStatus === 'connected'}
          >
            {availableAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} - {agent.specialty} ({agent.success_rate}% success rate)
              </option>
            ))}
          </select>
        </div>

        {/* Phone Number Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="+44 7700 900123"
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={callStatus === 'calling' || callStatus === 'connected'}
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter a UK mobile number for testing
          </p>
        </div>

        {/* Call Status */}
        <div className={`p-3 rounded-lg ${getStatusColor()}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{getStatusText()}</span>
            {callStatus === 'calling' || callStatus === 'connected' ? (
              <div className="animate-pulse">
                <div className="w-2 h-2 bg-current rounded-full"></div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {callStatus === 'idle' || callStatus === 'failed' ? (
            <Button 
              onClick={initiateTestCall}
              disabled={isLoading || !phoneNumber.trim()}
              className="flex-1"
            >
              {isLoading ? 'Initiating...' : 'Start Test Call'}
            </Button>
          ) : callStatus === 'completed' ? (
            <Button 
              onClick={resetCall}
              variant="outline"
              className="flex-1"
            >
              Make Another Call
            </Button>
          ) : null}
        </div>

        {/* Demo Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Demo Mode:</strong> This will initiate a real call using your Voice AI system. 
            Make sure to use your own phone number for testing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 