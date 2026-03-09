# 💎 Minecraft Mod Makerz — Discord Bot

A full-featured Discord economy bot for the Minecraft Mod Makerz server. Players earn and spend **Emeralds** to request custom Minecraft mods.

---

## 🚀 Setup Guide

### 1. Prerequisites
- [Node.js v18+](https://nodejs.org/)
- A PostgreSQL database (free options: [Railway](https://railway.app), [Supabase](https://supabase.com), [Neon](https://neon.tech))
- A Discord bot token

### 2. Create Your Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it `Mod Makerz Bot`
3. Go to **Bot** tab → click **Reset Token** → copy your token
4. Enable these **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (easiest for setup)
6. Copy the generated URL → open it → invite the bot to your server

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
DISCORD_TOKEN=    # Your bot token from step 2
CLIENT_ID=        # Application ID (from Developer Portal > General)
DATABASE_URL=     # PostgreSQL connection string
OWNER_ID=         # Your personal Discord user ID (right-click yourself → Copy ID)
```

**How to get your Discord User ID:**
- Enable Developer Mode in Discord Settings → Advanced → Developer Mode
- Right-click your username → Copy User ID

### 5. Set Up the Database

Your PostgreSQL database just needs to exist — the bot creates all tables automatically on startup.

**Railway (easiest free option):**
1. Go to https://railway.app → New Project → Add PostgreSQL
2. Click the database → Variables tab → copy `DATABASE_URL`
3. Paste it into your `.env`

### 6. Deploy Slash Commands

```bash
npm run deploy
```

This registers all `/commands` with Discord. You only need to run this once (or when adding new commands).

### 7. Start the Bot

```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

### 8. Build Your Server

Once the bot is online, run in your Discord server:
```
/setup server
```

This automatically creates all channels, roles, and posts the default embeds. **Done!**

---

## 📋 All Commands

### 👤 User Commands
| Command | Description |
|---------|-------------|
| `/verify` | Get verified + 50 free Emeralds (one-time) |
| `/balance [@user]` | Check your (or another user's) balance |
| `/daily` | Claim 10 Emeralds every 24 hours |
| `/transfer @user <amount>` | Send Emeralds to another user |
| `/request-mod` | Submit a mod request (opens a form) |
| `/check-status <id>` | Check status of a mod request |
| `/leaderboard` | See the top 10 richest users |

### 🎰 Gambling Commands (in #gambling only)
| Command | Description |
|---------|-------------|
| `/coinflip <amount> <heads\|tails>` | 50/50 bet |
| `/slots <amount>` | Spin the slot machine |
| `/blackjack <amount>` | Play blackjack vs. the dealer |

### 🛠️ Staff Commands (Staff role required)
| Command | Description |
|---------|-------------|
| `/price-mod <id> <price>` | Set the emerald price for a mod request |
| `/approve-mod <id>` | Approve a priced mod (deducts emeralds) |
| `/deny-mod <id> <reason>` | Deny a mod request with reason |
| `/complete-mod <id>` | Mark a mod as completed |
| `/close-request <id>` | Lock a mod request channel |
| `/lock-channel` | Lock current channel |
| `/unlock-channel` | Unlock current channel |
| `/warn @user <reason>` | Issue a warning to a user |

### 👑 Admin Commands (Admin role required)
| Command | Description |
|---------|-------------|
| `/add-emeralds @user <amount>` | Add emeralds to a user |
| `/remove-emeralds @user <amount>` | Remove emeralds from a user |
| `/set-emeralds @user <amount>` | Set exact balance |
| `/give-role @user <role>` | Give a role to a user |
| `/remove-role @user <role>` | Remove a role from a user |
| `/announce <channel> <message>` | Post an announcement embed |

### ⚙️ Owner Commands (Server Owner only)
| Command | Description |
|---------|-------------|
| `/setup server` | Build the entire server from scratch |
| `/setup reset` | Wipe all bot-created content |

---

## 💎 Mod Request Workflow

1. User runs `/request-mod` → fills in the form
2. Bot creates a **private channel** only visible to the user + Staff
3. Staff reviews → runs `/price-mod REQ-XXXX 120`
4. User is notified via DM with the price
5. User runs `/approve-mod REQ-XXXX` → emeralds are deducted
6. Staff builds the mod → delivers it in the channel
7. Staff runs `/complete-mod REQ-XXXX` → user gets **Customer** role
8. Staff runs `/close-request REQ-XXXX` → channel is locked

---

## 🏆 Milestone Roles (Auto-assigned)

| Emeralds Spent | Role |
|----------------|------|
| 500 | 🟠 Mod Supporter |
| 2,000 | 🟡 Mod Investor |
| 5,000 | 🟣 Mod Legend |

---

## 🤖 Automatic Systems

- **Anti-Spam:** 5+ messages in 5 seconds → auto 10-minute timeout
- **Welcome DM:** New members get a DM with getting-started instructions
- **Emerald Logging:** Every transaction logged to `#emerald-logs`
- **Milestone Roles:** Auto-assigned when spending thresholds are reached

---

## 🌐 Hosting Options

| Platform | Cost | Notes |
|----------|------|-------|
| [Railway](https://railway.app) | Free tier | Easiest — host bot + DB together |
| [Render](https://render.com) | Free tier | Good alternative |
| [VPS (DigitalOcean/Linode)](https://digitalocean.com) | ~$4/mo | Most control |
| Your own PC | Free | Must stay online 24/7 |

---

## 📁 Project Structure

```
modmakerz-bot/
├── src/
│   ├── index.js              # Bot entry point
│   ├── deploy-commands.js    # Slash command deployer
│   ├── db/
│   │   └── index.js          # PostgreSQL connection + helpers
│   ├── utils/
│   │   └── helpers.js        # Embeds, permission checker
│   ├── events/
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   ├── guildMemberAdd.js
│   │   └── messageCreate.js  # Anti-spam
│   └── commands/
│       ├── owner/setup.js
│       ├── user/             # verify, balance, daily, transfer, request-mod, etc.
│       ├── gambling/         # coinflip, slots, blackjack
│       ├── staff/            # price-mod, approve-mod, deny-mod, etc.
│       └── admin/            # add/remove/set-emeralds, give-role, announce
├── .env.example
├── package.json
└── README.md
```
