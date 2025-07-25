// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Discord API Endpoints
const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const DISCORD_TOKEN_URL = `${DISCORD_API_BASE_URL}/oauth2/token`;

// Environment Variables
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Middleware to parse JSON bodies
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Route to serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint for Discord OAuth2 redirect (this is where Discord sends the 'code')
// This route will simply serve the HTML page that handles the 'code'
app.get("/verify/callback", (req, res) => {
  // The frontend JS will read the 'code' from the URL and send it to /verify/process
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint to process the verification (called by frontend JS)
app.post("/verify/process", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Authorization code missing." });
  }

  try {
    // Step 1: Exchange the authorization code for an access token
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, // IMPORTANT: Use client_secret on server-side only
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        scope: "identify guilds guilds.members.read", // Must match the scopes requested
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Error exchanging code for token:", errorData);
      return res
        .status(tokenResponse.status)
        .json({
          message: "Failed to exchange code for token.",
          error: errorData,
        });
    }

    const { access_token, token_type } = await tokenResponse.json();

    // Step 2: Use the access token to fetch user information
    const userResponse = await fetch(`${DISCORD_API_BASE_URL}/users/@me`, {
      headers: {
        authorization: `${token_type} ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error("Error fetching user info:", errorData);
      return res
        .status(userResponse.status)
        .json({
          message: "Failed to fetch user information.",
          error: errorData,
        });
    }

    const user = await userResponse.json();
    console.log(
      `User ${user.username}#${user.discriminator} (${user.id}) successfully identified.`
    );

    console.log("user ==>", user);

    // Step 3: (Optional but Recommended) Verify if the user is in the target guild
    // This requires the 'guilds.members.read' scope and BOT_TOKEN with GuildMembers Intent
    const guildMemberResponse = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${GUILD_ID}/members/${user.id}`,
      {
        headers: {
          authorization: `Bot ${BOT_TOKEN}`, // Use bot token to check guild membership
        },
      }
    );

    if (!guildMemberResponse.ok) {
      // User is not in the guild or bot doesn't have permissions to read members
      console.warn(
        `User ${user.id} is not in guild ${GUILD_ID} or bot lacks permissions.`
      );
      return res
        .status(403)
        .json({
          message: "You must be a member of our Discord server to verify.",
        });
    }

    const guildMember = await guildMemberResponse.json();
    console.log("guildMember ==>", guildMember);
    // Check if the user already has the verified role
    if (guildMember.roles && guildMember.roles.includes(VERIFIED_ROLE_ID)) {
      console.log(`User ${user.id} already has the verified role.`);
      return res.status(200).json({
        message: "You are already verified and have the role.",
        username: user.username,
        discriminator: user.discriminator,
      });
    }

    // Step 4: Assign the role to the user in the target guild
    const assignRoleResponse = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${GUILD_ID}/members/${user.id}/roles/${VERIFIED_ROLE_ID}`,
      {
        method: "PUT", // PUT method to add a role
        headers: {
          authorization: `Bot ${BOT_TOKEN}`, // IMPORTANT: Use bot token for role management
          "Content-Type": "application/json",
        },
      }
    );

    if (!assignRoleResponse.ok) {
      const errorData = await assignRoleResponse.json();
      console.error("Error assigning role:", errorData);
      return res
        .status(assignRoleResponse.status)
        .json({ message: "Failed to assign role.", error: errorData });
    }

    const userGuildsResponse = await fetch(
      `${DISCORD_API_BASE_URL}/users/@me/guilds`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${access_token}`,
        },
      }
    );

    const userGuilds = await userGuildsResponse.json();
    console.log("userGuilds ==>", userGuilds);

    const userGuild = userGuilds.find((guild) => guild.id === GUILD_ID);
    console.log("userGuild ==>", userGuild);
    if (!userGuild) {
      console.log(`User ${user.id} is not in guild ${GUILD_ID}.`);
      return res.status(403).json({
        message: "You must be a member of our Discord server to verify.",
      });
    }

    console.log(
      `Successfully assigned role ${VERIFIED_ROLE_ID} to user ${user.id}.`
    );
    res.status(200).json({
      message: "Verification successful and role assigned!",
      username: user.username,
      discriminator: user.discriminator,
    });
  } catch (error) {
    console.error("Verification process error:", error);
    res
      .status(500)
      .json({ message: "Internal server error during verification." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Redirect URI set to: ${REDIRECT_URI}`);
});
