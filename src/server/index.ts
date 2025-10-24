import 'dotenv/config';
import express from 'express';
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from '@copilotkit/runtime';
import { LLMService } from '../services/llm-service';
import { llmConfig } from '../config/llm-config';
import { createDeepSeekClient } from './deepseek-client';
import { AgentCore } from '../services/agent-core';
import { AuthenticationService } from '../services/authentication-service';
import { GraphClient } from '../services/graph-client';
import { EmailService } from '../services/email-service';
import { NotesService } from '../services/notes-service';
import { CalendarService } from '../services/calendar-service';
import { StorageService } from '../services/storage-service';
import { authConfig } from '../config/auth-config';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '3001');

// Global agent instance
let agentCore: AgentCore | null = null;

async function initializeAgent(): Promise<AgentCore> {
  console.log('🔧 Initializing Agent Core...');

  // Initialize services
  const authService = new AuthenticationService(authConfig);
  await authService.initialize();

  const graphClient = new GraphClient(authService);
  graphClient.initialize();

  const emailService = new EmailService(graphClient, authService);
  const notesService = new NotesService(graphClient, authService);
  const calendarService = new CalendarService(graphClient, authService);
  
  // For MVP: Skip storage initialization (no DB persistence needed)
  const storageService = new StorageService();
  // await storageService.initialize(); // Commented out for MVP
  
  const llmService = new LLMService(llmConfig);

  // Create agent core
  const agent = new AgentCore(
    authService,
    graphClient,
    emailService,
    notesService,
    calendarService,
    storageService,
    llmService,
    {
      vipSenders: process.env.VIP_SENDERS?.split(',') || [],
      urgentKeywords: process.env.URGENT_KEYWORDS?.split(','),
      pollInterval: parseInt(process.env.POLL_INTERVAL || '30000'),
    }
  );

  return agent;
}

// Initialize LLM Service for CopilotKit
const llmService = new LLMService(llmConfig);

// Create DeepSeek client with role transformation (DESIGN-013)
const deepseekClient = createDeepSeekClient({
  apiKey: llmConfig.apiKey || '',
  baseURL: llmConfig.baseURL,
  model: llmConfig.model,
});

// Create CopilotKit adapter with DeepSeek client
const serviceAdapter = new OpenAIAdapter({
  model: llmConfig.model,
  openai: deepseekClient,
});

// Create CopilotKit runtime
const runtime = new CopilotRuntime();

// Middleware
app.use(express.json());

// CORS for Electron renderer
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-copilotkit-runtime-client-gql-version'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: agentCore ? 'initialized' : 'not initialized',
    authenticated: agentCore?.isAuthenticated() || false,
  });
});

// Agent initialization endpoint
app.post('/agent/initialize', async (req, res) => {
  try {
    if (!agentCore) {
      agentCore = await initializeAgent();
    }
    res.json({ success: true, message: 'Agent initialized' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agent start endpoint
app.post('/agent/start', async (req, res) => {
  try {
    if (!agentCore) {
      agentCore = await initializeAgent();
    }
    await agentCore.start();
    res.json({ success: true, message: 'Agent started' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agent stop endpoint
app.post('/agent/stop', async (req, res) => {
  try {
    if (agentCore) {
      await agentCore.stop();
    }
    res.json({ success: true, message: 'Agent stopped' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agent logout endpoint
app.post('/agent/logout', async (req, res) => {
  try {
    if (agentCore) {
      await agentCore.stop();
      const authService = agentCore.getAuthService();
      await authService.logout();
    }
    agentCore = null;
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Store Google auth instance temporarily
let pendingGoogleAuth: any = null;
let googleAuthCompleted = false;

// Get Gmail OAuth URL
app.get('/auth/gmail/url', async (req, res) => {
  try {
    const { GoogleAuthService } = await import('../services/google-auth-service');
    
    const googleAuthConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
    };

    const googleAuth = new GoogleAuthService(googleAuthConfig);
    await googleAuth.initialize();
    
    // Store for callback
    pendingGoogleAuth = googleAuth;
    googleAuthCompleted = false;
    
    // Generate auth URL
    const authUrl = googleAuth.getOAuth2Client().generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Gmail URL generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check Gmail auth status
app.get('/auth/gmail/status', (req, res) => {
  res.json({ authenticated: googleAuthCompleted });
});

// Gmail OAuth callback endpoint
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code || !pendingGoogleAuth) {
      res.status(400).send('Invalid authentication request');
      return;
    }

    // Exchange code for tokens
    const result = await pendingGoogleAuth.handleAuthCode(code as string);
    
    if (result.success) {
      // Mark as completed
      googleAuthCompleted = true;
      
      // Clear pending auth after a delay
      setTimeout(() => {
        pendingGoogleAuth = null;
        googleAuthCompleted = false;
      }, 5000);
      
      // Send success page
      res.send(`
        <html>
          <head>
            <title>Authentication Successful</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 48px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 400px;
              }
              .success-icon {
                font-size: 64px;
                margin-bottom: 24px;
              }
              h1 {
                color: #28a745;
                margin: 0 0 16px 0;
              }
              p {
                color: #666;
                margin: 0 0 24px 0;
              }
              .account-info {
                background: #f8f9fa;
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 24px;
              }
              .email {
                font-weight: 600;
                color: #333;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Authentication Successful!</h1>
              <p>Your Gmail account has been connected.</p>
              <div class="account-info">
                <div class="email">${result.accountInfo?.email}</div>
              </div>
              <p style="font-size: 14px; color: #999;">This window will close automatically...</p>
            </div>
            <script>
              // Auto-close after 2 seconds
              setTimeout(() => {
                window.close();
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } else {
      res.status(400).send(`
        <html>
          <head>
            <title>Authentication Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              }
              .container {
                background: white;
                padding: 48px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 400px;
              }
              .error-icon {
                font-size: 64px;
                margin-bottom: 24px;
              }
              h1 {
                color: #dc3545;
                margin: 0 0 16px 0;
              }
              p {
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Authentication Failed</h1>
              <p>${result.error || 'Unknown error occurred'}</p>
              <p style="font-size: 14px; color: #999; margin-top: 24px;">Please try again.</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    res.status(500).send('Authentication error: ' + error.message);
  }
});

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = [];
    
    // Get Outlook account
    if (agentCore && agentCore.isAuthenticated()) {
      try {
        const authService = agentCore.getAuthService();
        const accountInfo = authService.getAccountInfo();
        accounts.push(accountInfo);
      } catch (error) {
        console.error('Error getting Outlook account:', error);
      }
    }
    
    // Get Gmail account
    try {
      const { GoogleAuthService } = await import('../services/google-auth-service');
      
      const googleAuthConfig = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
      };

      const googleAuth = new GoogleAuthService(googleAuthConfig, 'gmail-main');
      await googleAuth.initialize();
      
      if (googleAuth.isAuthenticated()) {
        const accountInfo = googleAuth.getAccountInfo();
        accounts.push(accountInfo);
      }
    } catch (error) {
      console.error('Error getting Gmail account:', error);
    }
    
    res.json({ success: true, accounts });
  } catch (error: any) {
    console.error('Error getting accounts:', error);
    res.json({ success: true, accounts: [] });
  }
});

// Test Gmail emails endpoint
app.get('/api/gmail/test', async (req, res) => {
  try {
    const { GoogleAuthService } = await import('../services/google-auth-service');
    const { GmailEmailService } = await import('../services/gmail-email-service');
    
    const googleAuthConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
    };

    const googleAuth = new GoogleAuthService(googleAuthConfig, 'gmail-test');
    await googleAuth.initialize();
    
    if (!googleAuth.isAuthenticated()) {
      res.json({ success: false, error: 'Not authenticated. Please sign in first.' });
      return;
    }
    
    const gmailService = new GmailEmailService(googleAuth);
    const emails = await gmailService.getRecentEmails(10);
    
    res.json({ 
      success: true, 
      count: emails.length,
      emails: emails.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        receivedDateTime: e.receivedDateTime,
        providerType: e.providerType,
        accountEmail: e.accountEmail,
      }))
    });
  } catch (error: any) {
    console.error('Gmail test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get agent instance (for CopilotKit actions)
app.get('/agent/instance', (req, res) => {
  if (!agentCore) {
    res.status(404).json({ error: 'Agent not initialized' });
    return;
  }
  res.json({ initialized: true });
});

// Diagnostic endpoint to test Graph API directly
app.get('/api/test-graph', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    
    const graphClient = agentCore['graphClient'];
    const client = graphClient.getClient();
    
    // Test 1: Get user profile
    const userProfile = await client.api('/me').get();
    
    // Test 2: Try to get mailbox settings
    let mailboxSettings = null;
    try {
      mailboxSettings = await client.api('/me/mailboxSettings').get();
    } catch (e: any) {
      mailboxSettings = { error: e.message };
    }
    
    // Test 3: Try to get messages with detailed error
    let messages = null;
    let messagesError = null;
    try {
      messages = await client.api('/me/messages').top(1).get();
    } catch (e: any) {
      messagesError = {
        message: e.message,
        statusCode: e.statusCode,
        code: e.code,
        body: e.body
      };
    }
    
    res.json({
      success: true,
      userProfile: {
        displayName: userProfile.displayName,
        mail: userProfile.mail,
        userPrincipalName: userProfile.userPrincipalName,
        id: userProfile.id
      },
      mailboxSettings,
      messages: messages || messagesError
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.body || error
    });
  }
});

// Email API endpoints
app.post('/api/emails/priority', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    const allEmails = [];
    
    // Get Outlook emails if agent is initialized
    if (agentCore && agentCore.isAuthenticated()) {
      try {
        const outlookEmails = await agentCore.getPriorityEmails();
        allEmails.push(...outlookEmails);
      } catch (error) {
        console.error('Error getting Outlook emails:', error);
      }
    }
    
    // Get Gmail emails if authenticated
    try {
      const { GoogleAuthService } = await import('../services/google-auth-service');
      const { GmailEmailService } = await import('../services/gmail-email-service');
      
      const googleAuthConfig = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
      };

      const googleAuth = new GoogleAuthService(googleAuthConfig, 'gmail-main');
      await googleAuth.initialize();
      
      if (googleAuth.isAuthenticated()) {
        const gmailService = new GmailEmailService(googleAuth);
        const gmailEmails = await gmailService.getRecentEmails(limit);
        allEmails.push(...gmailEmails);
      }
    } catch (error) {
      console.error('Error getting Gmail emails:', error);
    }
    
    // Sort by date, most recent first
    allEmails.sort((a, b) => {
      const dateA = new Date(a.receivedDateTime).getTime();
      const dateB = new Date(b.receivedDateTime).getTime();
      return dateB - dateA;
    });
    
    res.json({ success: true, emails: allEmails.slice(0, limit) });
  } catch (error: any) {
    console.error('Error getting priority emails:', error);
    res.json({ success: true, emails: [] });
  }
});

app.post('/api/emails/search', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { query } = req.body;
    const emailService = agentCore.getEmailService();
    const emails = await emailService.searchEmails(query);
    res.json({ success: true, emails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/emails/recent', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { count = 10 } = req.body;
    const emailService = agentCore.getEmailService();
    const emails = await emailService.getRecentEmails(count);
    res.json({ success: true, emails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/emails/stats', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const emailService = agentCore.getEmailService();
    const recentEmails = await emailService.getRecentEmails(100);
    const priorityEmails = await agentCore.getPriorityEmails();
    
    const unreadCount = recentEmails.filter((email) => !email.isRead).length;
    
    res.json({
      success: true,
      stats: {
        unread: unreadCount,
        priority: priorityEmails.length,
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notes API endpoints
app.post('/api/notes/search', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { query } = req.body;
    const notesService = agentCore.getNotesService();
    const notes = await notesService.searchNotes(query);
    res.json({ success: true, notes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notes/entity', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { entityName, entityType } = req.body;
    const notesService = agentCore.getNotesService();
    const notes = await notesService.findNotesByEntity(entityName, entityType);
    res.json({ success: true, notes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notes/content', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { noteId } = req.body;
    const notesService = agentCore.getNotesService();
    const note = await notesService.getNoteContent(noteId);
    res.json({ success: true, note });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notes/related', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { emailId } = req.body;
    
    // Get the email and its analysis
    const storageService = agentCore['storageService'];
    const email = await storageService.getEmail(emailId);
    if (!email) {
      res.status(404).json({ success: false, error: 'Email not found' });
      return;
    }
    
    const analysis = await storageService.getAnalysis(emailId);
    const entities = analysis?.entities || [];
    
    const correlationService = agentCore.getCorrelationService();
    const notes = await correlationService.findRelatedNotes(email, entities);
    
    // Add relevance scores
    const notesWithRelevance = notes.map((note, index) => ({
      ...note,
      relevance: 1 - (index * 0.1), // Simple relevance scoring
    }));
    
    res.json({ success: true, notes: notesWithRelevance });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Meeting API endpoints
app.post('/api/meetings/upcoming', async (req, res) => {
  try {
    if (!agentCore || !agentCore.isAuthenticated()) {
      res.json({ success: true, meetings: [] });
      return;
    }
    const { days = 7 } = req.body;
    const calendarService = agentCore.getCalendarService();
    const meetings = await calendarService.getUpcomingMeetings(days);
    res.json({ success: true, meetings });
  } catch (error: any) {
    console.error('Error getting meetings:', error);
    res.json({ success: true, meetings: [] });
  }
});

app.post('/api/meetings/briefing', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { meetingId } = req.body;
    const briefing = await agentCore.getMeetingBriefing(meetingId);
    res.json({ success: true, briefing });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/meetings/available-slots', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { duration = 60, days = 7 } = req.body;
    const calendarService = agentCore.getCalendarService();
    const slots = await calendarService.findAvailableSlots(duration, days);
    res.json({ success: true, slots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/meetings/context', async (req, res) => {
  try {
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { meetingId } = req.body;
    const calendarService = agentCore.getCalendarService();
    const meeting = await calendarService.getMeetingById(meetingId);
    
    if (!meeting) {
      res.status(404).json({ success: false, error: 'Meeting not found' });
      return;
    }
    
    // Get context for each attendee
    const emailService = agentCore.getEmailService();
    const notesService = agentCore.getNotesService();
    
    const attendeesContext = await Promise.all(
      meeting.attendees.map(async (attendee) => {
        const emails = await emailService.searchEmails(attendee.emailAddress.address);
        const notes = await notesService.findNotesByEntity(attendee.emailAddress.name, 'person');
        
        return {
          name: attendee.emailAddress.name,
          email: attendee.emailAddress.address,
          recentEmails: emails.length,
          notes: notes.length,
        };
      })
    );
    
    res.json({ success: true, context: { attendees: attendeesContext } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Insights API endpoints
app.post('/api/insights', async (req, res) => {
  try {
    if (!agentCore || !agentCore.isAuthenticated()) {
      res.json({ success: true, insights: [] });
      return;
    }
    const insights = await agentCore.getInsights();
    res.json({ success: true, insights });
  } catch (error: any) {
    console.error('Error getting insights:', error);
    res.json({ success: true, insights: [] });
  }
});

app.post('/api/insights/followups', async (req, res) => {
  try {
    if (!agentCore || !agentCore.isAuthenticated()) {
      res.json({ success: true, followups: [] });
      return;
    }
    // Get all insights and filter for follow-ups
    const insights = await agentCore.getInsights();
    const followups = insights
      .filter((insight) => insight.type === 'follow_up')
      .map((insight) => ({
        subject: insight.title,
        from: insight.description,
        daysWaiting: 3, // Placeholder
      }));
    res.json({ success: true, followups });
  } catch (error: any) {
    console.error('Error getting follow-ups:', error);
    res.json({ success: true, followups: [] });
  }
});

app.post('/api/insights/deadlines', async (req, res) => {
  try {
    if (!agentCore || !agentCore.isAuthenticated()) {
      res.json({ success: true, deadlines: [] });
      return;
    }
    // Get all insights and filter for deadlines
    const insights = await agentCore.getInsights();
    const deadlines = insights
      .filter((insight) => insight.type === 'deadline')
      .map((insight) => ({
        description: insight.title,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Placeholder: 3 days from now
      }));
    res.json({ success: true, deadlines });
  } catch (error: any) {
    console.error('Error getting deadlines:', error);
    res.json({ success: true, deadlines: [] });
  }
});

app.post('/api/insights/patterns', async (req, res) => {
  try {
    if (!agentCore || !agentCore.isAuthenticated()) {
      res.json({ success: true, patterns: { topSenders: [], busiestDays: [] } });
      return;
    }
    // Get all insights and filter for patterns
    const insights = await agentCore.getInsights();
    const patterns = {
      topSenders: [],
      responseTime: 'N/A',
      busiestDays: [],
    };
    res.json({ success: true, patterns });
  } catch (error: any) {
    console.error('Error getting patterns:', error);
    res.json({ success: true, patterns: { topSenders: [], busiestDays: [] } });
  }
});

// Mount CopilotKit endpoint
app.use(
  '/copilotkit',
  copilotRuntimeNodeHttpEndpoint({
    endpoint: '/copilotkit',
    runtime,
    serviceAdapter,
  })
);

console.log('✅ CopilotKit endpoint mounted at /copilotkit');

// Start server
app.listen(PORT, () => {
  console.log(`✅ CopilotKit runtime server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Export for use in Electron main process
export { app, agentCore, initializeAgent };
