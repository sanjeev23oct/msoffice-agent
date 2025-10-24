# Google OAuth Setup Guide

This guide will help you set up Google OAuth for Gmail integration.

## 🚨 QUICK FIX: "Access blocked" Error

**Seeing "Access blocked: EmailAssistant has not completed the Google verification process"?**

This is normal for development! Here's the 30-second fix:

```
1. Open: https://console.cloud.google.com/
2. Go to: APIs & Services → OAuth consent screen
3. Scroll to: "Test users" section
4. Click: "Add Users"
5. Enter: your-email@gmail.com
6. Click: "Add" → "Save"
7. Try signing in again ✅
```

**That's it!** Google requires you to whitelist yourself during development. Once you add your email as a test user, authentication will work immediately.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "Email AI Assistant")
4. Click "Create"

## Step 2: Enable Required APIs

1. In your project, go to "APIs & Services" → "Library"
2. Search for and enable the following APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google Drive API**
   - **Google People API**

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Email AI Assistant
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
8. Click "Save and Continue"
9. **CRITICAL**: On the "Test users" page, click "Add Users"
10. **Add your Gmail address** (the one you'll use to sign in)
11. Click "Add" then "Save and Continue"
12. Review and click "Back to Dashboard"

> ⚠️ **Important**: If you skip adding yourself as a test user, you'll see "Access blocked: EmailAssistant has not completed the Google verification process". Make sure to add your email in step 9-10!

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Enter name: "Email AI Assistant"
5. Under "Authorized redirect URIs", click "Add URI"
6. Add: `http://localhost:3001/auth/google/callback`
7. Click "Create"
8. Copy the **Client ID** and **Client Secret**

## Step 5: Update .env File

1. Open your `.env` file
2. Update the Google OAuth variables:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
```

## Step 6: Test the Integration

1. Start the application
2. Click "Add Account" → "Gmail"
3. Check the terminal for the authentication URL
4. Copy the URL and open it in your browser
5. Sign in with your Google account
6. Grant the requested permissions
7. You should see a success page
8. Return to the app - your Gmail account is now connected!

## Troubleshooting

### "Access blocked: EmailAssistant has not completed the Google verification process" ⚠️ MOST COMMON

**Solution**: You need to add yourself as a test user!

1. Go to Google Cloud Console → Your Project
2. Navigate to "APIs & Services" → "OAuth consent screen"
3. Scroll to "Test users" section
4. Click "Add Users"
5. Enter your Gmail address
6. Click "Add" and "Save"
7. Try again - should work immediately!

**Why this happens**: During development, Google requires you to explicitly whitelist users who can access your app. This is a security feature.

### "Access blocked: This app's request is invalid"

- Make sure you've added your email as a test user in the OAuth consent screen
- Verify that all required APIs are enabled

### "redirect_uri_mismatch"

- Check that `http://localhost:3001/auth/google/callback` is added to authorized redirect URIs
- Make sure the redirect URI in `.env` matches exactly

### "invalid_client"

- Verify your Client ID and Client Secret are correct in `.env`
- Make sure there are no extra spaces or quotes

## Security Notes

- Keep your Client Secret secure and never commit it to version control
- The `.env` file is already in `.gitignore`
- For production, you'll need to verify your app with Google

## Next Steps

Once connected, you can:
- View Gmail emails in the unified inbox
- See Google Calendar events
- Search across Gmail and Outlook
- Get AI insights from both email providers

For production deployment, you'll need to:
1. Submit your app for Google OAuth verification
2. Complete the security assessment
3. Update the redirect URI to your production domain
