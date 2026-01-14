# Deploying Bot Bedrock 2.0 on VPS / RDP

This guide covers how to run your bot 24/7 on a VPS (Linux/Ubuntu) or an RDP (Windows Server).

## Option 1: Linux VPS (Recommended)

**OS**: Ubuntu 20.04 / 22.04 or Debian 11/12

### 1. Requirements
Update your system and install Node.js (version 16+ or 18+).

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install tools
sudo apt install -y git build-essential cmake screen

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

### 2. Installation
Clone your repository (or upload files via SFTP/FileZilla).

```bash
git clone https://github.com/yourusername/botbedrock2.git
cd botbedrock2
npm install
```

> **Note**: If `npm install` fails on `raknet-native`, ensure you installed `build-essential` in step 1.

### 3. Configuration
1.  Create `.env`:
    ```bash
    cp .env.example .env
    nano .env
    # Edit your variables, then Ctrl+O (Save), Enter, Ctrl+X (Exit)
    ```
2.  Create `accounts.json`:
    ```bash
    cp accounts.example.json accounts.json
    nano accounts.json
    ```

### 4. Running 24/7 (Background)
Use `screen` or `pm2` to keep the bot running after you disconnect.

**Method A: Using Screen (Simple)**
```bash
# Create a new session called 'bot'
screen -S bot

# Start the bot
npm start

# To disconnect (detach), press: Ctrl + A, then D
# To reconnect later:
screen -r bot
```

**Method B: Using PM2 (Advanced/Auto-Restart)**
```bash
sudo npm install -g pm2
pm2 start index.js --name "bedrock-bot"
pm2 save
pm2 startup
```

---

## Option 2: Windows RDP

**OS**: Windows Server 2019/2022 or Windows 10/11

### 1. Requirements
1.  **Node.js**: Download **v20 LTS** or **v22 LTS** from [nodejs.org](https://nodejs.org/).
2.  **Git**: Download from [git-scm.com](https://git-scm.com/).
3.  **CMake**: Download "Windows x64 Installer" from [cmake.org/download/](https://cmake.org/download/).
    *   *Important*: During install, select **"Add CMake to the system PATH for all users"**.
4.  **Visual Studio Build Tools**:
    *   Download from [visualstudio.microsoft.com/visual-cpp-build-tools/](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
    *   Run installer, select **"Desktop development with C++"** workload.
    *   Click "Install" (this may take 1-2GB).

### 2. Installation
1.  Open **PowerShell** or **Command Prompt**.
2.  Clone your repo:
    ```powershell
    git clone https://github.com/yourusername/botbedrock2.git
    cd botbedrock2
    ```
3.  Install dependencies:
    ```powershell
    npm install
    ```

### 3. Configuration
1.  Navigate to the folder in File Explorer.
2.  Duplicate `.env.example` and rename it to `.env`. Edit it with Notepad.
3.  Duplicate `accounts.example.json` and rename it to `accounts.json`. Edit it with Notepad.

### 4. Running 24/7
1.  Simply run `start_bot.bat` (create this file):
    ```batch
    @echo off
    :loop
    node index.js
    echo Bot crashed! Restarting in 5 seconds...
    timeout /t 5
    goto loop
    ```
2.  Double click `start_bot.bat`.
3.  **Crucial**: Do not sign out of the RDP. Just close the remote desktop window (disconnect). If you sign out, the bot closes.

---

## Troubleshooting

### "There is no Visual C++ compiler installed" (Windows)
If `npm install` fails with `raknet-native` errors:
1.  **Use Node.js LTS**: You are using Node v24, which is too new. Uninstall it and install **Node.js v20 LTS** or **v22 LTS**. Pre-compiled binaries often don't exist for the absolute latest version, forcing a manual build.
2.  **Install Build Tools**: If it still fails, open an Administrator PowerShell and run:
    ```powershell
    npm install --global --production windows-build-tools
    ```
    Or manually install **Visual Studio Build Tools** (Select "Desktop development with C++").

### "Authentication Failed" on VPS
If you are running on a headless Linux VPS (no browser), the bot will show a Microsoft code in the console (e.g., `NVVX7KVF`).
1.  Copy the code.
2.  Open [microsoft.com/link](https://microsoft.com/link) on your **home computer/phone**.
3.  Enter the code there to authenticate the bot running on the VPS.

### "Rate Limit / IP Ban"
Remember that all bots on the VPS share the VPS's IP address. Using a datacenter IP (like AWS, DigitalOcean) is more likely to be flagged by anti-bot plugins than a residential IP.

## Performance Tuning (4 Core / 8GB RAM)

To run **50+ bots** on this hardware, you must optimize to prevent crashing.

### 1. Optimize `.env`
Edit your `.env` file with these settings to minimize CPU/RAM usage:
```ini
# Reduce console spam (Saves CPU)
MC_LOG_LEVEL=error

# Reduce loaded chunks (Saves RAM/Bandwidth)
# Set to 4 (minimum) to stop server from sending huge world data
MC_VIEW_DISTANCE=4

# Disable parsing expensive block/entity data
MC_DROP_BLOCK_ENTITIES=true
```

### 2. Increase Memory Limit
Node.js defaults to about 2GB RAM. For 8GB RAM, give Node more space.
Run the bot with this command instead of just `npm start`:
```bash
node --max-old-space-size=6144 index.js
```
*(6144 MB = 6GB, leaving 2GB for the OS)*

### 3. Use Linux (If possible)
Windows Server uses ~2-3GB RAM just for itself. Linux (Ubuntu Server) uses ~300MB.
Switching to Linux gives you **~30% more capacity** for bots.

## Hardware Sizing Guide

**Can I run it on 1 vCPU / 2GB RAM?**
**Yes**, but only if you use **Linux**.

*   **Windows Server on 2GB RAM**: ❌ **Impossible**. Windows needs 2GB just to boot. It will crash immediately.
*   **Linux (Ubuntu/Debian) on 2GB RAM**: ✅ **Yes**.
    *   OS usage: ~300MB
    *   Available for bots: ~1.7GB
    *   **Estimated Capacity**: 20-30 bots (with `MC_VIEW_DISTANCE=4`).

**Estimates per 1GB of RAM (Linux):**
*   **Idle Storage Bots**: ~15-20 bots
*   **Active/Mining Bots**: ~5-10 bots

> **Note**: CPU usage depends on how many bots move/interact simultaneously. 1 vCPU is fine for 30 standing bots, but might lag if 30 bots try to mine at once.
