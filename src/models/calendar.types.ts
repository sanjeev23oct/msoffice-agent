import { EmailAddress } from './email.types';

export interface Meeting {
  id: string;
  subject: string;
  start: Date;
  end: Date;
  location?: string;
  organizer: EmailAddress;
  attendees: Attendee[];
  body: string;
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string;
}

export interface Attendee {
  emailAddress: EmailAddress;
  type: 'required' | 'optional' | 'resource';
  status: 'none' | 'accepted' | 'declined' | 'tentative';
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface ICalendarService {
  getUpcomingMeetings(days: number): Promise<Meeting[]>;
  getMeetingById(id: string): Promise<Meeting>;
  findAvailableSlots(duration: number, days: number): Promise<TimeSlot[]>;
  getMeetingAttendees(meetingId: string): Promise<Attendee[]>;
}
