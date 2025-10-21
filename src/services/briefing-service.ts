import { CalendarService } from './calendar-service';
import { NotesService } from './notes-service';
import { EmailService } from './email-service';
import { LLMService } from './llm-service';
import { Meeting } from '../models/calendar.types';
import { Briefing } from '../models/briefing.types';
import { Note } from '../models/note.types';
import { Email } from '../models/email.types';

export class BriefingService {
  private calendarService: CalendarService;
  private notesService: NotesService;
  private emailService: EmailService;
  private llmService: LLMService;

  constructor(
    calendarService: CalendarService,
    notesService: NotesService,
    emailService: EmailService,
    llmService: LLMService
  ) {
    this.calendarService = calendarService;
    this.notesService = notesService;
    this.emailService = emailService;
    this.llmService = llmService;
  }

  async generateBriefing(meetingId: string): Promise<Briefing> {
    // Get meeting details
    const meeting = await this.calendarService.getMeetingById(meetingId);

    // Get notes for each attendee
    const attendeeNotes = await this.getAttendeeNotes(meeting);

    // Get recent emails with attendees
    const recentEmails = await this.getRecentEmailsWithAttendees(meeting);

    // Generate suggested topics using AI
    const suggestedTopics = await this.generateSuggestedTopics(
      meeting,
      attendeeNotes,
      recentEmails
    );

    return {
      meeting,
      attendeeNotes,
      recentEmails,
      suggestedTopics,
      generatedAt: new Date(),
    };
  }

  private async getAttendeeNotes(meeting: Meeting): Promise<Map<string, Note[]>> {
    const attendeeNotes = new Map<string, Note[]>();

    for (const attendee of meeting.attendees) {
      const name = attendee.emailAddress.name || attendee.emailAddress.address;
      
      try {
        const notes = await this.notesService.findNotesByEntity(name, 'person');
        if (notes.length > 0) {
          attendeeNotes.set(name, notes.slice(0, 5)); // Top 5 notes per attendee
        }
      } catch (error) {
        console.error(`Error getting notes for ${name}:`, error);
      }
    }

    return attendeeNotes;
  }

  private async getRecentEmailsWithAttendees(meeting: Meeting): Promise<Email[]> {
    const recentEmails: Email[] = [];
    const attendeeEmails = meeting.attendees.map((a) => a.emailAddress.address.toLowerCase());

    try {
      // Get recent emails (last 30 days)
      const allEmails = await this.emailService.getRecentEmails(100);

      // Filter emails involving meeting attendees
      for (const email of allEmails) {
        const fromAttendee = attendeeEmails.includes(email.from.address.toLowerCase());
        const toAttendee = email.to.some((to) =>
          attendeeEmails.includes(to.address.toLowerCase())
        );

        if (fromAttendee || toAttendee) {
          recentEmails.push(email);
        }

        if (recentEmails.length >= 10) break; // Limit to 10 emails
      }
    } catch (error) {
      console.error('Error getting recent emails:', error);
    }

    return recentEmails;
  }

  private async generateSuggestedTopics(
    meeting: Meeting,
    attendeeNotes: Map<string, Note[]>,
    recentEmails: Email[]
  ): Promise<string[]> {
    try {
      // Prepare context for LLM
      const notesContext = Array.from(attendeeNotes.entries())
        .map(([name, notes]) => {
          const noteTitles = notes.map((n) => n.title).join(', ');
          return `${name}: ${noteTitles}`;
        })
        .join('\n');

      const emailContext = recentEmails
        .map((e) => `- ${e.subject}`)
        .slice(0, 5)
        .join('\n');

      const response = await this.llmService.chat([
        {
          role: 'system',
          content: `You are a meeting preparation assistant. Based on meeting details, attendee notes, and recent emails, suggest 3-5 relevant discussion topics.
Return a JSON array of topic strings.`,
        },
        {
          role: 'user',
          content: `Meeting: ${meeting.subject}
Attendees: ${meeting.attendees.map((a) => a.emailAddress.name).join(', ')}

Recent Notes:
${notesContext}

Recent Email Subjects:
${emailContext}

Suggest relevant topics for this meeting.`,
        },
      ]);

      const topics = JSON.parse(response.content);
      return Array.isArray(topics) ? topics : [];
    } catch (error) {
      console.error('Error generating suggested topics:', error);
      return ['Review meeting agenda', 'Discuss action items', 'Q&A'];
    }
  }

  async checkUpcomingMeetings(): Promise<Meeting[]> {
    // Get meetings in next 24 hours
    const meetings = await this.calendarService.getUpcomingMeetings(1);
    
    // Filter to meetings starting within 24 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return meetings.filter((meeting) => {
      return meeting.start >= now && meeting.start <= tomorrow;
    });
  }
}
