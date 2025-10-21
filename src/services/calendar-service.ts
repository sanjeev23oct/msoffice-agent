import { GraphClient } from './graph-client';
import { ICalendarService, Meeting, Attendee, TimeSlot } from '../models/calendar.types';
import { EmailAddress } from '../models/email.types';

export class CalendarService implements ICalendarService {
  private graphClient: GraphClient;
  private meetingCache: Map<string, Meeting> = new Map();

  constructor(graphClient: GraphClient) {
    this.graphClient = graphClient;
  }

  async getUpcomingMeetings(days: number): Promise<Meeting[]> {
    const client = this.graphClient.getClient();

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const response = await this.graphClient.executeWithRetry(() =>
      client
        .api('/me/calendar/calendarView')
        .query({
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
        })
        .top(100)
        .orderby('start/dateTime')
        .get()
    );

    return response.value.map((rawEvent: any) => {
      const meeting = this.mapToMeeting(rawEvent);
      this.meetingCache.set(meeting.id, meeting);
      return meeting;
    });
  }

  async getMeetingById(id: string): Promise<Meeting> {
    // Check cache first
    if (this.meetingCache.has(id)) {
      return this.meetingCache.get(id)!;
    }

    const client = this.graphClient.getClient();

    const rawEvent = await this.graphClient.executeWithRetry(() =>
      client.api(`/me/events/${id}`).get()
    );

    const meeting = this.mapToMeeting(rawEvent);
    this.meetingCache.set(id, meeting);
    return meeting;
  }

  async findAvailableSlots(duration: number, days: number): Promise<TimeSlot[]> {
    const client = this.graphClient.getClient();

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    // Get all events in the time range
    const response = await this.graphClient.executeWithRetry(() =>
      client
        .api('/me/calendar/calendarView')
        .query({
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
        })
        .get()
    );

    // Calculate free slots
    const busySlots: TimeSlot[] = response.value.map((event: any) => ({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
    }));

    return this.calculateFreeSlots(busySlots, startDate, endDate, duration);
  }

  async getMeetingAttendees(meetingId: string): Promise<Attendee[]> {
    const meeting = await this.getMeetingById(meetingId);
    return meeting.attendees;
  }

  private mapToMeeting(rawEvent: any): Meeting {
    return {
      id: rawEvent.id,
      subject: rawEvent.subject || '(No Subject)',
      start: new Date(rawEvent.start.dateTime),
      end: new Date(rawEvent.end.dateTime),
      location: rawEvent.location?.displayName,
      organizer: this.mapEmailAddress(rawEvent.organizer?.emailAddress),
      attendees: rawEvent.attendees?.map((a: any) => this.mapAttendee(a)) || [],
      body: rawEvent.body?.content || '',
      isOnlineMeeting: rawEvent.isOnlineMeeting || false,
      onlineMeetingUrl: rawEvent.onlineMeeting?.joinUrl,
    };
  }

  private mapEmailAddress(address: any): EmailAddress {
    return {
      name: address?.name || '',
      address: address?.address || '',
    };
  }

  private mapAttendee(rawAttendee: any): Attendee {
    return {
      emailAddress: this.mapEmailAddress(rawAttendee.emailAddress),
      type: rawAttendee.type || 'required',
      status: rawAttendee.status?.response || 'none',
    };
  }

  private calculateFreeSlots(
    busySlots: TimeSlot[],
    startDate: Date,
    endDate: Date,
    duration: number
  ): TimeSlot[] {
    const freeSlots: TimeSlot[] = [];
    
    // Sort busy slots by start time
    busySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = new Date(startDate);

    for (const busySlot of busySlots) {
      // Check if there's a gap before this busy slot
      const gapDuration = busySlot.start.getTime() - currentTime.getTime();
      
      if (gapDuration >= duration * 60 * 1000) {
        freeSlots.push({
          start: new Date(currentTime),
          end: new Date(busySlot.start),
        });
      }

      // Move current time to end of busy slot
      currentTime = new Date(Math.max(currentTime.getTime(), busySlot.end.getTime()));
    }

    // Check for free time after last busy slot
    if (currentTime < endDate) {
      const remainingDuration = endDate.getTime() - currentTime.getTime();
      if (remainingDuration >= duration * 60 * 1000) {
        freeSlots.push({
          start: new Date(currentTime),
          end: new Date(endDate),
        });
      }
    }

    return freeSlots;
  }

  clearCache(): void {
    this.meetingCache.clear();
  }
}
