// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
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
const SCOPE = process.env.SCOPE;

// Middleware to parse JSON bodies
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Route to serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Debug endpoint to check environment variables
app.get("/debug", (req, res) => {
  res.json({
    clientId: CLIENT_ID ? "Set" : "Missing",
    clientSecret: CLIENT_SECRET ? "Set" : "Missing",
    redirectUri: REDIRECT_URI,
    scope: SCOPE,
    guildId: GUILD_ID,
    verifiedRoleId: VERIFIED_ROLE_ID,
    botToken: BOT_TOKEN ? "Set" : "Missing",
  });
});

// OAuth2 test page
app.get("/oauth-test", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "oauth-test.html"));
});

// Endpoint for Discord OAuth2 redirect (this is where Discord sends the 'code')
// This route will simply serve the HTML page that handles the 'code'
app.get("/verify/callback", (req, res) => {
  // The frontend JS will read the 'code' from the URL and send it to /verify/process
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint to process the verification (called by frontend JS)
app.post("/verify/process", async (req, res) => {
  const { code, state, timestamp } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Authorization code missing." });
  }

  // Debug logging
  console.log("=== OAuth2 Verification Process Started ===");
  console.log("Code received:", code.substring(0, 10) + "...");
  console.log("State received:", state);
  console.log("Timestamp received:", timestamp);
  console.log("Using redirect_uri:", REDIRECT_URI);
  console.log("Client ID:", CLIENT_ID ? "Set" : "Missing");
  console.log("Client Secret:", CLIENT_SECRET ? "Set" : "Missing");

  try {
    // Validate the code format (should be a reasonable length)
    if (code.length < 20 || code.length > 100) {
      console.error("Invalid code length:", code.length);
      return res.status(400).json({
        message: "Invalid authorization code format.",
        error: { code_length: code.length },
      });
    }

    // Prepare the token exchange request
    const tokenRequestBody = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
    });

    console.log("Token request body (without secret):", {
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code: code.substring(0, 10) + "...",
      redirect_uri: REDIRECT_URI,
    });

    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Discord-Verify-App/1.0",
      },
      body: tokenRequestBody,
    });

    console.log("Token response status:", tokenResponse.status);
    console.log(
      "Token response headers:",
      Object.fromEntries(tokenResponse.headers.entries())
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("=== Token Exchange Failed ===");
      console.error("Status:", tokenResponse.status);
      console.error("Error data:", errorData);
      console.error("Response text:", await tokenResponse.text());

      // Provide more specific error messages
      let errorMessage = "Failed to exchange code for token.";
      if (errorData.error === "invalid_grant") {
        errorMessage =
          "Authorization code is invalid, expired, or has already been used. Please try the verification process again.";
      } else if (errorData.error === "invalid_client") {
        errorMessage =
          "Client authentication failed. Please check your Discord application settings.";
      } else if (errorData.error === "invalid_request") {
        errorMessage =
          "Invalid request parameters. Please check your configuration.";
      }

      return res.status(tokenResponse.status).json({
        message: errorMessage,
        error: errorData,
        debug: {
          code_length: code.length,
          redirect_uri: REDIRECT_URI,
          client_id_set: !!CLIENT_ID,
          client_secret_set: !!CLIENT_SECRET,
        },
      });
    }

    const tokenData = await tokenResponse.json();
    console.log("=== Token Exchange Successful ===");
    console.log("Token type:", tokenData.token_type);
    console.log(
      "Access token received:",
      tokenData.access_token ? "Yes" : "No"
    );
    console.log(
      "Refresh token received:",
      tokenData.refresh_token ? "Yes" : "No"
    );

    const { access_token, token_type } = tokenData;

    // Step 2: Use the access token to fetch user information
    const userResponse = await fetch(`${DISCORD_API_BASE_URL}/users/@me`, {
      headers: {
        authorization: `${token_type} ${access_token}`,
        "User-Agent": "Discord-Verify-App/1.0",
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error("Error fetching user info:", errorData);
      return res.status(userResponse.status).json({
        message: "Failed to fetch user information.",
        error: errorData,
      });
    }

    const user = await userResponse.json();
    console.log("User info retrieved:", {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      email: user.email ? "Present" : "Not present",
    });

    // Check if user exists in database
    const existingUser = await prisma.user.findUnique({
      where: {
        discordId: user.id,
      },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          discordId: user.id,
          username: user.username,
          discriminator: user.discriminator,
          email: user.email,
        },
      });
    }
    console.log(
      `User ${user.username}#${user.discriminator} (${user.id}) successfully identified.`
    );

    fs.writeFileSync("user.json", JSON.stringify(user, null, 2));

    // Step 3: (Optional but Recommended) Verify if the user is in the target guild
    // This requires the 'guilds.members.read' scope and BOT_TOKEN with GuildMembers Intent
    const guildMemberResponse = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${GUILD_ID}/members/${user.id}`,
      {
        headers: {
          authorization: `Bot ${BOT_TOKEN}`, // Use bot token to check guild membership
          "User-Agent": "Discord-Verify-App/1.0",
        },
      }
    );

    if (!guildMemberResponse.ok) {
      // User is not in the guild or bot doesn't have permissions to read members
      console.warn(
        `User ${user.id} is not in guild ${GUILD_ID} or bot lacks permissions.`
      );
      return res.status(403).json({
        message: "You must be a member of our Discord server to verify.",
      });
    }

    const guildMember = await guildMemberResponse.json();
    fs.writeFileSync("guildMember.json", JSON.stringify(guildMember, null, 2));

    // Check if the user already has the verified role
    if (guildMember.roles && guildMember.roles.includes(VERIFIED_ROLE_ID)) {
      console.log(`User ${user.id} already has the verified role.`);
      // return res.status(200).json({
      //   message: "You are already verified and have the role.",
      //   username: user.username,
      //   discriminator: user.discriminator,
      // });
    }

    // Step 4: Assign the role to the user in the target guild
    const assignRoleResponse = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${GUILD_ID}/members/${user.id}/roles/${VERIFIED_ROLE_ID}`,
      {
        method: "PUT", // PUT method to add a role
        headers: {
          authorization: `Bot ${BOT_TOKEN}`, // IMPORTANT: Use bot token for role management
          "Content-Type": "application/json",
          "User-Agent": "Discord-Verify-App/1.0",
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
          "User-Agent": "Discord-Verify-App/1.0",
        },
      }
    );

    const userGuilds = await userGuildsResponse.json();
    fs.writeFileSync("userGuilds.json", JSON.stringify(userGuilds, null, 2));

    const userGuild = userGuilds.find((guild) => guild.id === GUILD_ID);

    if (!userGuild) {
      console.log(`User ${user.id} is not in guild ${GUILD_ID}.`);
      return res.status(403).json({
        message: "You must be a member of our Discord server to verify.",
      });
    }

    console.log(
      `Successfully assigned role ${VERIFIED_ROLE_ID} to user ${user.id}.`
    );
    console.log("=== OAuth2 Verification Process Completed Successfully ===");

    res.status(200).json({
      message: "Verification successful and role assigned!",
      username: user.username,
      discriminator: user.discriminator,
    });
  } catch (error) {
    console.error("=== Verification Process Error ===");
    console.error("Error:", error);
    console.error("Error stack:", error.stack);
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
