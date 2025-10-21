# Outlook-OneNote AI Agent

AI Agent for Outlook and OneNote integration with intelligent email management, note retrieval, and meeting assistance.

## Features

- Email monitoring and prioritization
- OneNote note search and retrieval
- Email-note correlation
- Meeting briefing generation
- AI-powered insights
- Conversational UI with CopilotKit

## Setup

### Prerequisites
- Node.js 18+ installed
- An LLM API key (OpenAI, DeepSeek, etc.)
- Microsoft Azure App Registration (for Outlook/OneNote access)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**

Edit the `.env` file and add your API keys:

```env
# Required: LLM API Key
OPENAI_API_KEY=sk-your-api-key-here

# Required: Microsoft App Registration
MICROSOFT_CLIENT_ID=your-client-id-here
```

### Getting API Keys

#### 1. LLM API Key (DeepSeek or OpenAI)

**Option A: DeepSeek (Recommended - Cheaper)**
- Sign up at https://platform.deepseek.com
- Get your API key from the dashboard
- Use: `LLM_PROVIDER=deepseek` in `.env`

**Option B: OpenAI**
- Sign up at https://platform.openai.com
- Get your API key
- Use: `LLM_PROVIDER=openai` and `OPENAI_BASE_URL=https://api.openai.com/v1`

#### 2. Microsoft App Registration

1. Go to https://portal.azure.com
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Name: "Outlook-OneNote AI Agent"
5. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
6. Redirect URI: `http://localhost:3000/auth/callback`
7. After creation, copy the "Application (client) ID"
8. Go to "API permissions" > "Add a permission" > "Microsoft Graph"
9. Add these permissions:
   - `User.Read`
   - `Mail.Read`
   - `Notes.Read`
   - `Calendars.Read`
10. Click "Grant admin consent"

### Testing the Backend

Test the backend server first:

```bash
npm run test:server
```

You should see:
```
✅ CopilotKit runtime server running on http://localhost:3001
📊 Health check: http://localhost:3001/health
```

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

## Development

Run in development mode:
```bash
npm run dev
```

This starts:
- Electron main process (watch mode)
- React renderer (Vite dev server)
- CopilotKit backend server (watch mode)

## Build

Build for production:
```bash
npm run build
```

Package as Electron app:
```bash
npm run package
```

## Project Structure

```
src/
├── main/          # Electron main process
├── renderer/      # React frontend
├── server/        # CopilotKit backend server
├── services/      # Business logic services
├── models/        # TypeScript interfaces
├── config/        # Configuration
└── utils/         # Utility functions
```

## Troubleshooting

### "Mailbox is inactive or soft-deleted" Error

If you get this error when trying to access emails:

**Solution:** Make sure `MICROSOFT_TENANT_ID=common` in your `.env` file.

**Why:** Using a specific tenant ID can cause authentication as a guest user, which doesn't have a mailbox. The `common` tenant allows authentication with personal Microsoft accounts (outlook.com, hotmail.com) that have real mailboxes.

### Testing Microsoft Graph API Connection

Run the diagnostic test:
```bash
powershell -File test-graph-api.ps1
```

This will show:
- Your user profile
- Mailbox settings
- Whether email access is working

### Clear Cached Tokens

If you need to re-authenticate:
1. Navigate to: `%APPDATA%\.outlook-ai-agent\`
2. Delete the `tokens.enc` file
3. Restart the application

## Tech Stack

- **Electron** - Desktop app framework
- **React** - UI framework
- **TypeScript** - Type safety
- **CopilotKit** - Conversational AI interface
- **Microsoft Graph API** - Outlook & OneNote integration
- **SQLite** - Local data storage
- **DeepSeek AI** - LLM for email analysis and insights

## License

MIT
