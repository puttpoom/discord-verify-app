// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Routes,
} from "discord.js";
import { REST } from "@discordjs/rest"; // Import REST for registering commands

// Environment Variables
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI; // This should be your backend server's redirect URI
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID; // Your Discord Guild (Server) ID

// Define the scopes needed for OAuth2 authorization
const SCOPES = "identify guilds.members.read"; // Permissions for the user to grant

// Construct the OAuth2 URL for Discord authorization
const OAUTH_AUTHORIZE_URL = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
  REDIRECT_URI
)}&response_type=code&scope=${encodeURIComponent(SCOPES)}`;

// Create a new Discord client instance with necessary intents
// IMPORTANT: Removed GatewayIntentBits.MessageContent as it's often the cause of "disallowed intents"
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Required for guild-related events (e.g., commands in guilds)
    // GatewayIntentBits.GuildMessages, // Not strictly needed for slash commands, but useful for general bot functions
    GatewayIntentBits.GuildMembers, // Required for member-related actions (e.g., fetching members, checking roles)
  ],
});

// For registering slash commands
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

// Define the slash command
const commands = [
  {
    name: "verify-setup",
    description: "Sends the Discord verification message with a button.",
  },
];

// --- Bot Event Handlers ---

// When the client is ready, log a message and register slash commands
client.once("ready", async () => {
  console.log(`Discord Bot logged in as ${client.user.tag}!`);
  console.log(`Verification URL: ${OAUTH_AUTHORIZE_URL}`);

  // Register slash commands globally or for a specific guild
  try {
    // Register commands for a specific guild (faster for development)
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), // Use applicationGuildCommands for guild-specific commands
      { body: commands }
    );
    console.log("Successfully registered slash commands for the guild.");
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
});

// Listen for slash command interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return; // Only process slash commands

  const { commandName } = interaction;

  if (commandName === "verify-setup") {
    // Optional: Check if the user has permissions to use this command
    if (!interaction.member.permissions.has("ManageRoles")) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
    }
    await sendVerifyMessage(interaction.channel);
    await interaction.reply({
      content: "Verification message sent!",
      ephemeral: true,
    }); // Acknowledge the command
  }
});

// Function to send the verification message with a button
async function sendVerifyMessage(channel) {
  const embed = new EmbedBuilder()
    .setTitle("Discord Verification")
    .setDescription(
      "Click the button below to verify your identity and receive a role."
    )
    .setColor(0x0099ff); // Discord blue color

  const verifyButton = new ButtonBuilder()
    .setLabel("Verify with Discord")
    .setStyle(ButtonStyle.Link) // Use ButtonStyle.Link for external URLs
    .setURL(OAUTH_AUTHORIZE_URL); // The URL the button will link to

  const row = new ActionRowBuilder().addComponents(verifyButton);

  await channel.send({ embeds: [embed], components: [row] });
  console.log("Verification message sent.");
}

// Log in to Discord with your client's token
client.login(BOT_TOKEN);
