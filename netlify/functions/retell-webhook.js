const crypto = require('crypto');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-retell-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const apiKey = process.env.RETELL_API_KEY;
    const signature = event.headers['x-retell-signature'];
    
    if (!apiKey) {
      throw new Error('RETELL_API_KEY not configured');
    }

    // Verify webhook signature (official Retell pattern)
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', apiKey)
        .update(event.body, 'utf8')
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' }),
        };
      }
    }

    const content = JSON.parse(event.body);
    
    // Handle different event types (official Retell pattern)
    switch (content.event) {
      case 'call_started':
        console.log('Call started event received', content.data.call_id);
        break;
      case 'call_ended':
        console.log('Call ended event received', content.data.call_id);
        break;
      case 'call_analyzed':
        console.log('Call analyzed event received', content.data.call_id);
        break;
      default:
        console.log('Received an unknown event:', content.event);
    }

    // Acknowledge the receipt of the event (official pattern)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };

  } catch (error) {
    console.error('Webhook processing failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        message: error.message 
      }),
    };
  }
}; 