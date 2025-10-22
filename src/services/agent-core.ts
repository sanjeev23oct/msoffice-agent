import { AuthenticationService } from './authentication-service';
import { GraphClient } from './graph-client';
import { EmailService } from './email-service';
import { NotesService } from './notes-service';
import { CalendarService } from './calendar-service';
import { StorageService } from './storage-service';
import { LLMService } from './llm-service';
import { EmailAnalysisService } from './email-analysis-service';
import { CorrelationService } from './correlation-service';
import { BriefingService } from './briefing-service';
import { InsightsService } from './insights-service';
import { Email } from '../models/email.types';
import { Briefing } from '../models/briefing.types';
import { Insight } from '../models/insight.types';

export interface AgentCoreConfig {
  vipSenders?: string[];
  urgentKeywords?: string[];
  pollInterval?: number;
}

export class AgentCore {
  private authService: AuthenticationService;
  private graphClient: GraphClient;
  private emailService: EmailService;
  private notesService: NotesService;
  private calendarService: CalendarService;
  private storageService: StorageService;
  private llmService: LLMService;
  private emailAnalysisService: EmailAnalysisService;
  private correlationService: CorrelationService;
  private briefingService: BriefingService;
  private insightsService: InsightsService;
  
  private isRunning: boolean = false;
  private config: AgentCoreConfig;

  constructor(
    authService: AuthenticationService,
    graphClient: GraphClient,
    emailService: EmailService,
    notesService: NotesService,
    calendarService: CalendarService,
    storageService: StorageService,
    llmService: LLMService,
    config: AgentCoreConfig = {}
  ) {
    this.authService = authService;
    this.graphClient = graphClient;
    this.emailService = emailService;
    this.notesService = notesService;
    this.calendarService = calendarService;
    this.storageService = storageService;
    this.llmService = llmService;
    this.config = config;

    // Initialize analysis services
    this.emailAnalysisService = new EmailAnalysisService(
      llmService,
      config.vipSenders,
      config.urgentKeywords
    );

    this.correlationService = new CorrelationService(notesService, storageService);

    this.briefingService = new BriefingService(
      calendarService,
      notesService,
      emailService,
      llmService
    );

    this.insightsService = new InsightsService(
      emailService,
      calendarService,
      storageService,
      llmService
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Agent already running');
      return;
    }

    console.log('🚀 Starting Agent Core...');

    // Initialize storage
    await this.storageService.initialize();

    // Check if authenticated
    if (!this.authService.isAuthenticated()) {
      console.log('🔐 Not authenticated. Starting authentication flow...');
      await this.authService.login();
      console.log('✅ Authentication successful!');
    }

    // Initialize Graph client
    this.graphClient.initialize();

    // Subscribe to email changes
    this.emailService.subscribeToChanges((email) => {
      this.processNewEmail(email);
    });

    // Start email monitoring
    await this.emailService.startMonitoring();

    this.isRunning = true;
    console.log('✅ Agent Core started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping Agent Core...');

    await this.emailService.stopMonitoring();

    this.isRunning = false;
    console.log('✅ Agent Core stopped');
  }

  async processNewEmail(email: Email): Promise<void> {
    try {
      console.log(`📧 Processing new email: ${email.subject}`);

      // Save email to storage
      await this.storageService.saveEmail(email);

      // Analyze email with AI
      const analysis = await this.emailAnalysisService.analyzeEmail(email);

      // Find related notes
      const relatedNoteIds = await this.correlationService.correlateEmailWithNotes(
        email,
        analysis.entities
      );
      analysis.relatedNotes = relatedNoteIds;

      // Save analysis
      await this.storageService.saveAnalysis(email.id, analysis);

      // Notify user if high priority
      if (analysis.priorityLevel === 'high') {
        console.log(`⚠️ High priority email detected: ${email.subject}`);
        // Notification will be handled by notification service
      }

      console.log(`✅ Email processed: ${email.subject}`);
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  async handleUserQuery(query: string): Promise<string> {
    try {
      // Use LLM to understand intent and generate response
      const response = await this.llmService.chat([
        {
          role: 'system',
          content: `You are an AI assistant helping with email and note management. 
You can search emails, find notes, check meetings, and provide insights.
Be concise and helpful.`,
        },
        {
          role: 'user',
          content: query,
        },
      ]);

      return response.content;
    } catch (error) {
      console.error('Error handling query:', error);
      return 'Sorry, I encountered an error processing your request.';
    }
  }

  async getPriorityEmails(): Promise<Email[]> {
    try {
      const recentEmails = await this.emailService.getRecentEmails(50);
      const priorityEmails: Email[] = [];

      for (const email of recentEmails) {
        const analysis = await this.storageService.getAnalysis(email.id);
        if (analysis && analysis.priorityLevel === 'high') {
          priorityEmails.push(email);
        }
      }

      return priorityEmails;
    } catch (error) {
      console.error('Error getting priority emails:', error);
      return [];
    }
  }

  async getMeetingBriefing(meetingId: string): Promise<Briefing> {
    return this.briefingService.generateBriefing(meetingId);
  }

  async getInsights(): Promise<Insight[]> {
    return this.insightsService.generateInsights();
  }

  // Getters for services (for CopilotKit actions)
  getAuthService(): AuthenticationService {
    return this.authService;
  }

  getEmailService(): EmailService {
    return this.emailService;
  }

  getNotesService(): NotesService {
    return this.notesService;
  }

  getCalendarService(): CalendarService {
    return this.calendarService;
  }

  getBriefingService(): BriefingService {
    return this.briefingService;
  }

  getInsightsService(): InsightsService {
    return this.insightsService;
  }

  getCorrelationService(): CorrelationService {
    return this.correlationService;
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }
}
