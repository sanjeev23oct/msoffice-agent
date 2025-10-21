# Microsoft Azure App Registration Guide

This guide will help you register an application in Azure to get the Client ID and Tenant ID needed for accessing Outlook and OneNote.

## Prerequisites

- A Microsoft account (personal or work/school)
- Access to Azure Portal (free tier is fine)

---

## Step-by-Step Instructions

### Step 1: Access Azure Portal

1. Go to **https://portal.azure.com**
2. Sign in with your Microsoft account
3. If you don't have an Azure account, you'll be prompted to create one (it's free)

### Step 2: Navigate to App Registrations

1. In the Azure Portal search bar at the top, type **"App registrations"**
2. Click on **"App registrations"** from the results
3. Click the **"+ New registration"** button at the top

### Step 3: Register Your Application

Fill in the registration form:

**1. Name:**
```
Outlook-OneNote AI Agent
```

**2. Supported account types:**
Select: **"Accounts in any organizational directory and personal Microsoft accounts (Any Azure AD directory - Multitenant and personal Microsoft accounts)"**

This allows the app to work with:
- Personal Microsoft accounts (Outlook.com, Hotmail, etc.)
- Work/School accounts (Office 365)

**3. Redirect URI:**
- Platform: Select **"Public client/native (mobile & desktop)"**
- URI: Enter `http://localhost:3000/auth/callback`

**4. Click "Register"**

### Step 4: Copy Your Client ID

After registration, you'll see the app overview page:

1. Look for **"Application (client) ID"** - this is a GUID like `12345678-1234-1234-1234-123456789abc`
2. **Copy this value** - this is your `MICROSOFT_CLIENT_ID`
3. Look for **"Directory (tenant) ID"** - copy this too (this is your `MICROSOFT_TENANT_ID`)

**Add these to your `.env` file:**
```env
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_TENANT_ID=common
```

> **Note:** For personal Microsoft accounts, use `MICROSOFT_TENANT_ID=common`
> For work/school accounts, you can use the actual tenant ID or `common`

### Step 5: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search for and add these permissions:

   ✅ **User.Read** (Read user profile)
   - Expand "User" section
   - Check "User.Read"

   ✅ **Mail.Read** (Read user mail)
   - Expand "Mail" section
   - Check "Mail.Read"

   ✅ **Notes.Read** (Read user OneNote notebooks)
   - Expand "Notes" section
   - Check "Notes.Read"

   ✅ **Calendars.Read** (Read user calendars)
   - Expand "Calendars" section
   - Check "Calendars.Read"

6. Click **"Add permissions"**

### Step 6: Grant Admin Consent (Optional but Recommended)

If you're using a work/school account:

1. Click the **"Grant admin consent for [Your Organization]"** button
2. Click **"Yes"** to confirm

For personal accounts, this step is not needed - users will consent when they first log in.

### Step 7: Configure Authentication Settings

1. In the left sidebar, click **"Authentication"**
2. Under "Advanced settings", find **"Allow public client flows"**
3. Set it to **"Yes"**
4. Click **"Save"** at the top

---

## Your Final Configuration

Your `.env` file should now look like this:

```env
# LLM Provider Configuration
LLM_PROVIDER=deepseek
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# Microsoft Graph API
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/callback

# Other settings...
```

---

## Testing Your Configuration

Once you've added the Client ID, test the authentication:

1. Run the backend server:
   ```bash
   npm run test:server
   ```

2. Initialize the agent:
   ```bash
   curl -X POST http://localhost:3001/agent/initialize
   ```

3. Start the agent (this will trigger authentication):
   ```bash
   curl -X POST http://localhost:3001/agent/start
   ```

4. You should see a device code in the console with instructions to authenticate

---

## Troubleshooting

### Error: "AADSTS700016: Application not found"
- Double-check your Client ID is correct
- Make sure you copied the entire GUID

### Error: "AADSTS65001: The user or administrator has not consented"
- Go back to API permissions and grant consent
- Or users will need to consent on first login

### Error: "Invalid redirect URI"
- Make sure the redirect URI in Azure matches exactly: `http://localhost:3000/auth/callback`
- Check for trailing slashes or typos

---

## Quick Reference

**Azure Portal:** https://portal.azure.com
**App Registrations:** Search for "App registrations" in Azure Portal
**Required Permissions:**
- User.Read
- Mail.Read
- Notes.Read
- Calendars.Read

**Redirect URI:** `http://localhost:3000/auth/callback`
**Account Type:** Multitenant + Personal accounts

---

## Screenshots Reference

If you need visual guidance, here are the key screens you'll see:

1. **App Registrations** - Where you create the app
2. **Overview** - Where you find Client ID and Tenant ID
3. **API Permissions** - Where you add Microsoft Graph permissions
4. **Authentication** - Where you configure redirect URIs

---

## Need Help?

If you encounter any issues:
1. Check the Azure Portal for error messages
2. Verify all permissions are added correctly
3. Make sure "Allow public client flows" is enabled
4. Ensure the redirect URI matches exactly

Let me know if you need help with any step!
