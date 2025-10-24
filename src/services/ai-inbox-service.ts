import { LLMService } from './llm-service';
import { Email } from '../models/email.types';

export enum EmailCategory {
  URGENT = 'urgent',
  IMPORTANT = 'important',
  NORMAL = 'normal',
  NEWSLETTER = 'newsletter',
  AUTOMATED = 'automated',
}

export interface EmailAnalysis {
  category: EmailCategory;
  categoryReason: string;
  summary: string;
  actionItems: ActionItem[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  keyPoints: string[];
}

export interface ActionItem {
  id: string;
  description: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

export interface ChatResponse {
  message: string;
  emails?: Email[];
  actions?: ChatAction[];
}

export interface ChatAction {
  type: 'filter' | 'archive' | 'mark_read';
  label: string;
  data: any;
}

export class AIInboxService {
  private llmService: LLMService;
  private analysisCache: Map<string, EmailAnalysis> = new Map();

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    // Check cache first
    if (this.analysisCache.has(email.id)) {
      return this.analysisCache.get(email.id)!;
    }

    try {
      const prompt = this.buildAnalysisPrompt(email);
      const response = await this.llmService.chat([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 500,
      });

      const analysis = this.parseAnalysisResponse(response.content, email);
      this.analysisCache.set(email.id, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing email:', error);
      return this.getDefaultAnalysis(email);
    }
  }

  async analyzeEmailBatch(emails: Email[]): Promise<Map<string, EmailAnalysis>> {
    const results = new Map<string, EmailAnalysis>();
    
    // Process in batches of 5 to avoid overwhelming the API
    for (let i = 0; i < emails.length; i += 5) {
      const batch = emails.slice(i, i + 5);
      const promises = batch.map(email => this.analyzeEmail(email));
      const analyses = await Promise.all(promises);
      
      batch.forEach((email, index) => {
        results.set(email.id, analyses[index]);
      });
    }
    
    return results;
  }

  async chatWithAI(message: string, emails: Email[]): Promise<ChatResponse> {
    try {
      const prompt = this.buildChatPrompt(message, emails);
      const response = await this.llmService.chat([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.7,
        maxTokens: 300,
      });

      return this.parseChatResponse(response.content, emails);
    } catch (error) {
      console.error('Error in AI chat:', error);
      return {
        message: "I'm having trouble processing that request. Please try again.",
      };
    }
  }

  private buildAnalysisPrompt(email: Email): string {
    return `Analyze this email and provide a structured response:

Subject: ${email.subject}
From: ${email.from.name} <${email.from.address}>
Body: ${email.body.substring(0, 1000)}

Provide analysis in this JSON format:
{
  "category": "urgent|important|normal|newsletter|automated",
  "categoryReason": "brief explanation",
  "summary": "2-3 sentence summary",
  "actionItems": [
    {
      "description": "what needs to be done",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "high|medium|low"
    }
  ],
  "sentiment": "positive|neutral|negative|urgent",
  "keyPoints": ["point 1", "point 2", "point 3"]
}

Categories:
- urgent: Requires immediate action, time-sensitive, from important people
- important: Needs attention soon, significant content
- normal: Regular email, can wait
- newsletter: Promotional, marketing, subscriptions
- automated: System notifications, no-reply emails

Be concise and accurate.`;
  }

  private buildChatPrompt(message: string, emails: Email[]): string {
    const emailSummaries = emails.slice(0, 10).map(e => 
      `- ${e.subject} from ${e.from.name} (${new Date(e.receivedDateTime).toLocaleDateString()})`
    ).join('\n');

    return `You are an AI email assistant. Help the user with their inbox.

User's question: "${message}"

Recent emails:
${emailSummaries}

Provide a helpful response. If the user is asking about specific emails, reference them.
If suggesting actions, be specific and actionable.

Keep response under 100 words.`;
  }

  private parseAnalysisResponse(response: string, email: Email): EmailAnalysis {
    try {
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          category: parsed.category || EmailCategory.NORMAL,
          categoryReason: parsed.categoryReason || '',
          summary: parsed.summary || email.subject,
          actionItems: (parsed.actionItems || []).map((item: any, index: number) => ({
            id: `${email.id}-action-${index}`,
            description: item.description,
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
            priority: item.priority || 'medium',
            completed: false,
          })),
          sentiment: parsed.sentiment || 'neutral',
          keyPoints: parsed.keyPoints || [],
        };
      }
    } catch (error) {
      console.error('Error parsing analysis response:', error);
    }

    return this.getDefaultAnalysis(email);
  }

  private parseChatResponse(response: string, emails: Email[]): ChatResponse {
    // Simple parsing - in production, you'd want more sophisticated parsing
    return {
      message: response.trim(),
      emails: [],
      actions: [],
    };
  }

  private getDefaultAnalysis(email: Email): EmailAnalysis {
    // Simple heuristic-based categorization as fallback
    let category = EmailCategory.NORMAL;
    
    const subject = email.subject.toLowerCase();
    const from = email.from.address.toLowerCase();
    
    if (from.includes('noreply') || from.includes('no-reply')) {
      category = EmailCategory.AUTOMATED;
    } else if (subject.includes('newsletter') || subject.includes('unsubscribe')) {
      category = EmailCategory.NEWSLETTER;
    } else if (subject.includes('urgent') || subject.includes('asap') || subject.includes('important')) {
      category = EmailCategory.URGENT;
    }

    return {
      category,
      categoryReason: 'Automatic categorization',
      summary: email.subject,
      actionItems: [],
      sentiment: 'neutral',
      keyPoints: [],
    };
  }

  clearCache(): void {
    this.analysisCache.clear();
  }
}
