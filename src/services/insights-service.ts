import { EmailService } from './email-service';
import { CalendarService } from './calendar-service';
import { StorageService } from './storage-service';
import { LLMService } from './llm-service';
import { Insight, RelatedItem } from '../models/insight.types';
import { Email } from '../models/email.types';
import { Meeting } from '../models/calendar.types';

export class InsightsService {
  private emailService: EmailService;
  private calendarService: CalendarService;
  private storageService: StorageService;
  private llmService: LLMService;

  constructor(
    emailService: EmailService,
    calendarService: CalendarService,
    storageService: StorageService,
    llmService: LLMService
  ) {
    this.emailService = emailService;
    this.calendarService = calendarService;
    this.storageService = storageService;
    this.llmService = llmService;
  }

  async generateInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Run insight generation in parallel
    const [followUps, deadlines, patterns, suggestions] = await Promise.all([
      this.detectFollowUpNeeded(),
      this.detectUpcomingDeadlines(),
      this.detectCommunicationPatterns(),
      this.generateSuggestions(),
    ]);

    insights.push(...followUps, ...deadlines, ...patterns, ...suggestions);

    // Sort by priority and date
    insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return insights;
  }

  private async detectFollowUpNeeded(): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Get recent emails
      const emails = await this.emailService.getRecentEmails(50);

      // Check for emails with action items that haven't been followed up
      for (const email of emails) {
        const analysis = await this.storageService.getAnalysis(email.id);
        
        if (analysis && analysis.actionItems.length > 0) {
          // Check if email is older than 3 days and not replied
          const daysSinceReceived =
            (Date.now() - email.receivedDateTime.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceReceived > 3 && !email.isRead) {
            insights.push({
              id: `follow-up-${email.id}`,
              type: 'follow_up',
              title: 'Follow-up needed',
              description: `Email from ${email.from.name} has ${analysis.actionItems.length} pending action items`,
              priority: 'medium',
              actionable: true,
              relatedItems: [
                {
                  type: 'email',
                  id: email.id,
                  title: email.subject,
                },
              ],
              createdAt: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error detecting follow-ups:', error);
    }

    return insights;
  }

  private async detectUpcomingDeadlines(): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Get recent emails
      const emails = await this.emailService.getRecentEmails(50);

      for (const email of emails) {
        const analysis = await this.storageService.getAnalysis(email.id);
        
        if (analysis && analysis.deadline) {
          const daysUntilDeadline =
            (analysis.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

          // Alert for deadlines within 7 days
          if (daysUntilDeadline > 0 && daysUntilDeadline <= 7) {
            insights.push({
              id: `deadline-${email.id}`,
              type: 'deadline',
              title: 'Upcoming deadline',
              description: `Deadline in ${Math.ceil(daysUntilDeadline)} days: ${email.subject}`,
              priority: daysUntilDeadline <= 2 ? 'high' : 'medium',
              actionable: true,
              relatedItems: [
                {
                  type: 'email',
                  id: email.id,
                  title: email.subject,
                },
              ],
              createdAt: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error detecting deadlines:', error);
    }

    return insights;
  }

  private async detectCommunicationPatterns(): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Get recent emails
      const emails = await this.emailService.getRecentEmails(100);

      // Group by sender
      const senderMap = new Map<string, Email[]>();
      for (const email of emails) {
        const sender = email.from.address;
        if (!senderMap.has(sender)) {
          senderMap.set(sender, []);
        }
        senderMap.get(sender)!.push(email);
      }

      // Detect clients not contacted recently
      for (const [sender, senderEmails] of senderMap.entries()) {
        if (senderEmails.length >= 3) {
          // Frequent contact
          const lastEmail = senderEmails[0];
          const daysSinceLastContact =
            (Date.now() - lastEmail.receivedDateTime.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceLastContact > 14) {
            insights.push({
              id: `pattern-${sender}`,
              type: 'pattern',
              title: 'Client not contacted recently',
              description: `No communication with ${lastEmail.from.name} in ${Math.floor(daysSinceLastContact)} days`,
              priority: 'low',
              actionable: true,
              relatedItems: [
                {
                  type: 'email',
                  id: lastEmail.id,
                  title: `Last email: ${lastEmail.subject}`,
                },
              ],
              createdAt: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error detecting patterns:', error);
    }

    return insights;
  }

  private async generateSuggestions(): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Check for scheduling conflicts
      const meetings = await this.calendarService.getUpcomingMeetings(7);
      
      // Detect overlapping meetings
      for (let i = 0; i < meetings.length - 1; i++) {
        const current = meetings[i];
        const next = meetings[i + 1];

        if (current.end > next.start) {
          insights.push({
            id: `conflict-${current.id}-${next.id}`,
            type: 'suggestion',
            title: 'Scheduling conflict detected',
            description: `"${current.subject}" overlaps with "${next.subject}"`,
            priority: 'high',
            actionable: true,
            relatedItems: [
              {
                type: 'meeting',
                id: current.id,
                title: current.subject,
              },
              {
                type: 'meeting',
                id: next.id,
                title: next.subject,
              },
            ],
            createdAt: new Date(),
          });
        }
      }

      // Suggest meeting preparation
      const upcomingMeetings = meetings.filter((m) => {
        const hoursUntil = (m.start.getTime() - Date.now()) / (1000 * 60 * 60);
        return hoursUntil > 0 && hoursUntil <= 24;
      });

      for (const meeting of upcomingMeetings) {
        insights.push({
          id: `prep-${meeting.id}`,
          type: 'suggestion',
          title: 'Prepare for upcoming meeting',
          description: `Meeting "${meeting.subject}" starts soon. Review briefing and notes.`,
          priority: 'medium',
          actionable: true,
          relatedItems: [
            {
              type: 'meeting',
              id: meeting.id,
              title: meeting.subject,
            },
          ],
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }

    return insights;
  }
}
