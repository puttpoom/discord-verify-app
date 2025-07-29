// Test script to debug OAuth2 flow
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const DISCORD_TOKEN_URL = `${DISCORD_API_BASE_URL}/oauth2/token`;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

console.log('=== OAuth2 Configuration Test ===');
console.log('Client ID:', CLIENT_ID ? 'Set' : 'Missing');
console.log('Client Secret:', CLIENT_SECRET ? 'Set' : 'Missing');
console.log('Redirect URI:', REDIRECT_URI);

// Test function to validate a code
async function testCode(code) {
  console.log('\n=== Testing Authorization Code ===');
  console.log('Code:', code.substring(0, 10) + '...');
  console.log('Code length:', code.length);
  
  try {
    const response = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Discord-Verify-App-Test/1.0',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Token exchange successful!');
      console.log('Token type:', data.token_type);
      console.log('Access token received:', data.access_token ? 'Yes' : 'No');
    } else {
      console.log('❌ Token exchange failed!');
      console.log('Error:', data);
    }
    
    return { success: response.ok, data };
  } catch (error) {
    console.error('❌ Request failed:', error);
    return { success: false, error: error.message };
  }
}

// Function to generate a test OAuth URL
function generateOAuthUrl() {
  const state = Math.random().toString(36).substring(2, 15);
  const scope = 'identify guilds guilds.members.read';
  
  const url = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  
  console.log('\n=== OAuth2 Authorization URL ===');
  console.log(url);
  console.log('\nState parameter:', state);
  console.log('\nUse this URL to get a fresh authorization code for testing.');
  
  return { url, state };
}

// Main execution
if (process.argv[2] === 'url') {
  generateOAuthUrl();
} else if (process.argv[2] === 'test' && process.argv[3]) {
  testCode(process.argv[3]);
} else {
  console.log('\nUsage:');
  console.log('  node test-oauth.js url                    - Generate OAuth2 URL');
  console.log('  node test-oauth.js test <authorization_code> - Test a code');
  console.log('\nExample:');
  console.log('  node test-oauth.js url');
  console.log('  node test-oauth.js test abc123def456...');
} 