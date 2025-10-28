const https = require('https');

// Helper function to make HTTPS requests to Retell AI
const makeRetellRequest = (path, data, apiKey) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const contentLength = Buffer.byteLength(postData);
    
    const options = {
      hostname: 'api.retellai.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': contentLength
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: { message: responseData }
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'RETELL_API_KEY not set' }) };
    }

    const { agent_id, agent_version, metadata, retell_llm_dynamic_variables } = JSON.parse(event.body || '{}');

    if (!agent_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'agent_id is required' })
      };
    }

    const retellData = {
      agent_id: agent_id,
      metadata: metadata || {},
      retell_llm_dynamic_variables: retell_llm_dynamic_variables || {}
    };

    const response = await makeRetellRequest('/v2/create-web-call', retellData, apiKey);

    if (response.statusCode === 200 || response.statusCode === 201) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response.data)
      };
    }

    return {
      statusCode: response.statusCode || 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: response.data?.message || 'Retell API error',
        retell: response.data
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message, message: 'Failed to create web call' })
    };
  }
}; 