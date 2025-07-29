# Discord OAuth2 Troubleshooting Guide

## Invalid Grant Error

The "invalid_grant" error with "Invalid 'code' in request" typically occurs due to one of these reasons:

### 1. Authorization Code Reuse
**Problem**: OAuth2 authorization codes can only be used once.
**Solution**: 
- Clear your browser cache and cookies
- Start a fresh OAuth2 flow
- Don't refresh the page after receiving the code

### 2. Code Expiration
**Problem**: Authorization codes expire after 10 minutes.
**Solution**: 
- Complete the verification process quickly
- Don't leave the page open for too long

### 3. Mismatched Redirect URI
**Problem**: The redirect URI in the token exchange must exactly match the one used in the authorization request.
**Solution**:
- Check your `.env` file: `REDIRECT_URI=http://localhost:3000/verify/callback`
- Ensure this matches exactly in your Discord application settings
- No trailing slashes or extra characters

### 4. Code Tampering
**Problem**: The code might be getting modified during URL parameter extraction.
**Solution**:
- Use the improved frontend code that prevents code reuse
- Check the debug information in the browser

## Debugging Steps

### Step 1: Check Environment Variables
Run the debug endpoint:
```bash
curl http://localhost:3000/debug
```

### Step 2: Generate Fresh OAuth URL
Use the test script:
```bash
node test-oauth.js url
```

### Step 3: Test Authorization Code
After getting a fresh code, test it:
```bash
node test-oauth.js test <your_authorization_code>
```

### Step 4: Check Discord Application Settings
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 settings
4. Verify the redirect URI matches exactly: `http://localhost:3000/verify/callback`

## Common Issues and Solutions

### Issue: "Client authentication failed"
**Cause**: Invalid client ID or secret
**Solution**: 
- Check your `.env` file
- Regenerate client secret in Discord Developer Portal
- Ensure no extra spaces or characters

### Issue: "Invalid request parameters"
**Cause**: Missing or malformed parameters
**Solution**:
- Check all required parameters are present
- Ensure proper URL encoding
- Verify Content-Type header

### Issue: "User not in guild"
**Cause**: User is not a member of the target Discord server
**Solution**:
- Ensure the user has joined your Discord server
- Check bot permissions for reading guild members

### Issue: "Bot lacks permissions"
**Cause**: Bot doesn't have required permissions
**Solution**:
- Add bot to server with proper permissions
- Enable "Server Members Intent" in Discord Developer Portal
- Ensure bot has "Manage Roles" permission

## Testing the Fix

1. **Start the server**:
   ```bash
   node server.js
   ```

2. **Generate a fresh OAuth URL**:
   ```bash
   node test-oauth.js url
   ```

3. **Open the URL in a new incognito/private browser window**

4. **Complete the OAuth flow quickly**

5. **Check the debug information on the verification page**

## Prevention Tips

1. **Always use fresh codes**: Don't reuse authorization codes
2. **Complete quickly**: Don't leave the verification page open
3. **Use incognito mode**: Prevents cache/cookie issues
4. **Check logs**: Monitor server console for detailed error information
5. **Test regularly**: Use the test script to validate your setup

## Environment Variables Checklist

Ensure your `.env` file contains:
```env
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
REDIRECT_URI=http://localhost:3000/verify/callback
GUILD_ID=your_guild_id
VERIFIED_ROLE_ID=your_role_id
SCOPE=identify email guilds guilds.members.read
```

## Discord Application Settings Checklist

1. **OAuth2 Redirect URI**: `http://localhost:3000/verify/callback`
2. **Bot Permissions**: 
   - Manage Roles
   - Read Messages/View Channels
   - Use Slash Commands
3. **Bot Intents**:
   - Server Members Intent (enabled)
4. **OAuth2 Scopes**:
   - identify
   - email
   - guilds
   - guilds.members.read 