let cachedToken = null;
let tokenExpiry = 0;

async function getOAuthToken() {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials'
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: params
  });

  if (!response.ok) {
    throw new Error('Failed to get OAuth token');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

  return cachedToken;
}

async function fetchStreamPage(token, gameId, cursor) {
  const params = new URLSearchParams({
    game_id: gameId,
    first: '100'
  });

  if (cursor) {
    params.append('after', cursor);
  }

  const url = `https://api.twitch.tv/helix/streams?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch streams');
  }

  return await response.json();
}

export default async function handler(req, res) {
  // Enable CORS for local development and production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://streamlist-modern.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { game_id, cursor } = req.query;

    if (!game_id) {
      return res.status(400).json({ error: 'game_id is required' });
    }

    const token = await getOAuthToken();
    const data = await fetchStreamPage(token, game_id, cursor);

    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch streams',
      message: error.message
    });
  }
}