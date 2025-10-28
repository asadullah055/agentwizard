const https = require('https');

// Netlify Function to create a call with Retell AI
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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get API key from environment variables (set in Netlify dashboard)
    const retellApiKey = process.env.RETELL_API_KEY;
    
    if (!retellApiKey) {
      console.error('RETELL_API_KEY environment variable not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    
    // Validate required fields
    const { phoneNumber, agentId, metadata } = requestBody;
    
    if (!phoneNumber || !agentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: phoneNumber and agentId' 
        }),
      };
    }

    // Format phone number (handle UK numbers)
    const formatPhoneNumber = (phone) => {
      if (phone.startsWith('0')) {
        return '+44' + phone.slice(1);
      }
      return phone;
    };

    // Prepare data for Retell AI (matching your n8n structure)
    const retellData = {
      from_number: process.env.RETELL_PHONE_NUMBER || "+447700138833", // Your Retell phone number
      to_number: formatPhoneNumber(phoneNumber),
      agent_id: agentId, // Use agent_id instead of override_agent_id
      retell_llm_dynamic_variables: {
        pronunciation: metadata?.pronunciation || '',
        first_name: metadata?.firstName || metadata?.customerName || 'Customer',
        email: metadata?.email || '',
        phone_number: metadata?.phoneNumber || phoneNumber
      },
      opt_out_sensitive_data_storage: false,
      opt_in_signed_url: true,
      // Add metadata for tracking
      ...(metadata && { metadata: metadata })
    };

    console.log('Creating call with Retell AI:', {
      to_number: retellData.to_number,
      agent_id: retellData.agent_id,
      from_number: retellData.from_number
    });

    // Make request to Retell AI
    const retellResponse = await makeRetellRequest('POST', '/create-phone-call', retellData, retellApiKey);

    console.log('Retell AI response:', retellResponse);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        callId: retellResponse.call_id,
        status: retellResponse.call_status,
        message: 'Call initiated successfully',
        callData: {
          toNumber: retellData.to_number,
          agentId: retellData.agent_id,
          timestamp: new Date().toISOString()
        }
      }),
    };

  } catch (error) {
    console.error('Error creating call:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create call',
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