import { LLMService } from './llm-service';
import { Email } from '../models/email.types';
import { EmailAnalysis, Entity, ActionItem } from '../models/storage.types';

export class EmailAnalysisService {
  private llmService: LLMService;
  private vipSenders: string[];
  private urgentKeywords: string[];

  constructor(
    llmService: LLMService,
    vipSenders: string[] = [],
    urgentKeywords: string[] = ['urgent', 'asap', 'deadline', 'due by', 'critical', 'important']
  ) {
    this.llmService = llmService;
    this.vipSenders = vipSenders;
    this.urgentKeywords = urgentKeywords;
  }

  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    // Run analysis tasks in parallel
    const [priorityLevel, entities, actionItems, sentiment, summary] = await Promise.all([
      this.classifyPriority(email),
      this.extractEntities(email.body),
      this.extractActionItems(email.body),
      this.analyzeSentiment(email.body),
      this.generateSummary(email.body),
    ]);

    const deadline = this.extractDeadline(email.body);

    return {
      emailId: email.id,
      priorityLevel,
      priorityReason: this.getPriorityReason(email, priorityLevel),
      entities,
      actionItems,
      sentiment,
      summary,
      relatedNotes: [], // Will be populated by correlation service
      deadline,
      analyzedAt: new Date(),
    };
  }

  async classifyPriority(email: Email): Promise<'low' | 'medium' | 'high'> {
    // Check VIP senders
    if (this.vipSenders.includes(email.from.address.toLowerCase())) {
      return 'high';
    }

    // Check urgent keywords
    const content = `${email.subject} ${email.body}`.toLowerCase();
    if (this.urgentKeywords.some((keyword) => content.includes(keyword))) {
      return 'high';
    }

    // Check email importance flag
    if (email.importance === 'high') {
      return 'high';
    }

    // Use LLM for intelligent classification
    try {
      const response = await this.llmService.chat([
        {
          role: 'system',
          content:
            'You are an email priority classifier. Classify emails as low, medium, or high priority. Respond with only one word: low, medium, or high.',
        },
        {
          role: 'user',
          content: `Subject: ${email.subject}\n\nFrom: ${email.from.name}\n\nBody: ${email.body.substring(0, 500)}`,
        },
      ]);

      const priority = response.content.trim().toLowerCase();
      if (priority === 'low' || priority === 'medium' || priority === 'high') {
        return priority as 'low' | 'medium' | 'high';
      }
    } catch (error) {
      console.error('Error classifying priority:', error);
    }

    return 'medium'; // Default
  }

  async extractEntities(text: string): Promise<Entity[]> {
    try {
      const response = await this.llmService.chat([
        {
          role: 'system',
          content: `You are an entity extraction assistant. Extract people, companies, projects, locations, and dates from text. 
Return a JSON array of entities with format: [{"text": "entity name", "type": "person|company|project|location|date", "confidence": 0.0-1.0}]`,
        },
        {
          role: 'user',
          content: text.substring(0, 1000),
        },
      ]);

      const entities = JSON.parse(response.content);
      return entities;
    } catch (error) {
      console.error('Error extracting entities:', error);
      return [];
    }
  }

  async extractActionItems(text: string): Promise<ActionItem[]> {
    try {
      const response = await this.llmService.chat([
        {
          role: 'system',
          content: `You are an action item extractor. Identify tasks, requests, and action items from text.
Return a JSON array with format: [{"description": "action description", "dueDate": "ISO date or null", "priority": "low|medium|high"}]`,
        },
        {
          role: 'user',
          content: text.substring(0, 1000),
        },
      ]);

      const actionItems = JSON.parse(response.content);
      return actionItems.map((item: any) => ({
        ...item,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      }));
    } catch (error) {
      console.error('Error extracting action items:', error);
      return [];
    }
  }

  async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
      const response = await this.llmService.chat([
        {
          role: 'system',
          content:
            'You are a sentiment analyzer. Classify the sentiment as positive, neutral, or negative. Respond with only one word.',
        },
        {
          role: 'user',
          content: text.substring(0, 500),
        },
      ]);

      const sentiment = response.content.trim().toLowerCase();
      if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative') {
        return sentiment as 'positive' | 'neutral' | 'negative';
      }
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
    }

    return 'neutral'; // Default
  }

  async generateSummary(text: string): Promise<string> {
    try {
      const response = await this.llmService.chat([
        {
          role: 'system',
          content:
            'You are an email summarizer. Create a concise 1-2 sentence summary of the email content.',
        },
        {
          role: 'user',
          content: text.substring(0, 1000),
        },
      ]);

      return response.content.trim();
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Unable to generate summary';
    }
  }

  private extractDeadline(text: string): Date | undefined {
    // Simple deadline extraction using regex patterns
    const patterns = [
      /due\s+(?:by|on)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
      /deadline[:\s]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
      /by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (error) {
          // Continue to next pattern
        }
      }
    }

    return undefined;
  }

  private getPriorityReason(email: Email, priority: 'low' | 'medium' | 'high'): string {
    if (this.vipSenders.includes(email.from.address.toLowerCase())) {
      return 'Email from VIP sender';
    }

    const content = `${email.subject} ${email.body}`.toLowerCase();
    const foundKeyword = this.urgentKeywords.find((keyword) => content.includes(keyword));
    if (foundKeyword) {
      return `Contains urgent keyword: "${foundKeyword}"`;
    }

    if (email.importance === 'high') {
      return 'Marked as high importance by sender';
    }

    if (priority === 'high') {
      return 'AI classified as high priority based on content';
    }

    return 'Standard priority email';
  }
}
