# Minecraft Bedrock Multi-Account Bot

---------------
A modular, multi-account Minecraft Bedrock bot built with [bedrock-protocol](https://github.com/PrismarineJS/bedrock-protocol).

## Features
-   **Multi-Account**: Run multiple bots from a single process.
-   **Targeted Control**: Send commands to all bots or specific ones (e.g., `@Bot1 .sneak on`).
-   **Command System**: Support for local dot-commands (`.sneak`, `.join`) and server commands (`/gamemode`).
-   **Sequential Login**: Handles strict Xbox authentication flows by logging bots in one by one.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/AryasatyaWiryawan/botbedrock2.git
    cd botbedrock2
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure the bot:
    -   Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
3.  Configure the bot:
    -   Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
        ```
    -   Create `accounts.json` from `accounts.example.json`.

> **Deploying on VPS/RDP?** Check out the [VPS Installation Guide](VPS_GUIDE.md) for detailed instructions.

## Usage

Start the bot:
```bash
npm start
```

### Commands

**Global Control** (Affects all bots):
-   `join` / `.join`: Connect all bots to the server.
-   `disconnect` / `.disconnect`: Disconnect all bots.
-   `.sneak on/off`: Toggle sneak mode.
-   `/say Hello`: Send chat message or server command.

**Targeted Control** (Affects specific bot):
-   `@BotName .join`: Connect only this bot.
-   `@BotName .disconnect`: Disconnect only this bot.
-   `@BotName .sneak on`: Make only this bot sneak.
-   `@BotName /gamemode 1`: Send command from this bot.

### Risks & Detection
> [!WARNING]
> **IP Address & Rate Limits**: All bots running from this program share your computer's IP address.

Server admins **CAN** easily see that multiple accounts are coming from the same IP address.
-   **Logs**: Server console logs show the IP of every connecting player.
-   **Anti-Bot Plugins**: Many servers have plugins that automatically ban IPs with too many connections (e.g., >3 accounts).

**Recommendation**:
-   Limit your bot count per server (usually 2-3 is safe).
-   Do not join 50 bots instantly.

## Development

### Adding Commands
Create a new file in `src/commands/actions/`:
```javascript
// src/commands/actions/jump.js
module.exports = (bot, args) => {
    console.log('Jumped!');
    bot.client.queue('player_action', { action: 'jump', ... });
}
```
Then register it in `src/commands/commandHandler.js`.
