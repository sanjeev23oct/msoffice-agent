import { Meeting } from './calendar.types';
import { Note } from './note.types';
import { Email } from './email.types';

export interface Briefing {
  meeting: Meeting;
  attendeeNotes: Map<string, Note[]>;
  recentEmails: Email[];
  suggestedTopics: string[];
  generatedAt: Date;
}
