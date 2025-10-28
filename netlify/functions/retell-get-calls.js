const https = require('https');

// Netlify Function to get call history from Retell AI
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get API key from environment variables
    const retellApiKey = process.env.RETELL_API_KEY;
    
    if (!retellApiKey) {
      console.error('RETELL_API_KEY environment variable not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const { 
      limit = '50', 
      offset = '0', 
      start_date, 
      end_date,
      agent_id,
      call_status 
    } = queryParams;

    // Build query string for Retell AI API
    const params = new URLSearchParams({
      limit,
      offset,
      ...(start_date && { start_date }),
      ...(end_date && { end_date }),
      ...(agent_id && { agent_id }),
      ...(call_status && { call_status })
    });

    // Make request to Retell AI
    const endpoint = `/list-calls?${params.toString()}`;
    const retellResponse = await makeRetellRequest('GET', endpoint, null, retellApiKey);

    // Transform the response to match your dashboard format
    const transformedCalls = retellResponse.calls?.map(call => ({
      id: call.call_id,
      phoneNumber: call.to_number,
      customer: call.metadata?.customer_name || `Customer`,
      agent: call.agent_id || 'Unknown Agent',
      outcome: mapRetellStatus(call.call_status, call.end_reason),
      duration: formatDuration(call.call_length_seconds),
      date: call.start_timestamp,
      transcript: call.transcript || 'Transcript not available',
      recording: call.recording_url,
      metadata: call.metadata || {}
    })) || [];

    // Calculate analytics
    const analytics = calculateAnalytics(retellResponse.calls || []);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        calls: transformedCalls,
        analytics,
        totalCount: retellResponse.total_count || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + transformedCalls.length) < (retellResponse.total_count || 0)
        }
      }),
    };

  } catch (error) {
    console.error('Error fetching calls:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch calls',
        details: error.message 
      }),
    };
  }
};

// Helper function to make requests to Retell AI
function makeRetellRequest(method, endpoint, data, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.retellai.com',
      port: 443,
      path: '/v2' + endpoint,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`Retell AI API error: ${res.statusCode} ${parsedData.message || responseData}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse Retell AI response: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request to Retell AI failed: ${error.message}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Map Retell AI status to dashboard outcomes
function mapRetellStatus(status, endReason) {
  const statusMap = {
    'completed': endReason === 'agent_hangup' ? 'Meeting booked' : 'Customer ended call',
    'failed': 'Failed to connect',
    'busy': 'No answer',
    'no_answer': 'No answer',
    'voicemail': 'Voicemail',
    'in_progress': 'In progress',
    'queued': 'Queued'
  };

  return statusMap[status] || 'Unknown';
}

// Format duration from seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Calculate analytics from calls
function calculateAnalytics(calls) {
  if (!calls || calls.length === 0) {
    return {
      totalCalls: 0,
      pickupRate: 0,
      connectionRate: 0,
      successRate: 0,
      averageDuration: 0,
      callOutcomes: []
    };
  }

  const totalCalls = calls.length;
  const completedCalls = calls.filter(call => call.call_status === 'completed').length;
  const connectedCalls = calls.filter(call => 
    ['completed', 'voicemail'].includes(call.call_status)
  ).length;
  
  const successfulCalls = calls.filter(call => 
    call.call_status === 'completed' && 
    call.end_reason === 'agent_hangup'
  ).length;

  // Calculate average duration for completed calls
  const completedCallDurations = calls
    .filter(call => call.call_status === 'completed')
    .map(call => call.call_length_seconds || 0);
  
  const averageDuration = completedCallDurations.length > 0
    ? Math.round(completedCallDurations.reduce((a, b) => a + b, 0) / completedCallDurations.length)
    : 0;

  // Count outcomes
  const outcomeCount = {};
  calls.forEach(call => {
    const outcome = mapRetellStatus(call.call_status, call.end_reason);
    outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1;
  });

  const callOutcomes = Object.entries(outcomeCount).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / totalCalls) * 100)
  })).sort((a, b) => b.percentage - a.percentage);

  return {
    totalCalls,
    pickupRate: Math.round((connectedCalls / totalCalls) * 100),
    connectionRate: Math.round((connectedCalls / totalCalls) * 100),
    successRate: Math.round((successfulCalls / totalCalls) * 100),
    averageDuration,
    callOutcomes
  };
} 