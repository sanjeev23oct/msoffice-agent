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

  const emailService = new EmailService(graphClient);
  const notesService = new NotesService(graphClient);
  const calendarService = new CalendarService(graphClient);
  const storageService = new StorageService();
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
    if (!agentCore) {
      res.status(404).json({ success: false, error: 'Agent not initialized' });
      return;
    }
    const { limit = 10 } = req.body;
    const emails = await agentCore.getPriorityEmails();
    res.json({ success: true, emails: emails.slice(0, limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
