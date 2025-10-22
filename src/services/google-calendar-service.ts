import { google, calendar_v3 } from 'googleapis';
import { GoogleAuthService } from './google-auth-service';
import { ICalendarProvider, MeetingWithProvider, TimeSlot, Attendee } from '../models/provider.types';

export class GoogleCalendarService implements ICalendarProvider {
  readonly providerType = 'google' as const;
  readonly accountId: string;

  private calendar: calendar_v3.Calendar;
  private authService: GoogleAuthService;

  constructor(authService: GoogleAuthService) {
    this.authService = authService;
    this.accountId = authService.accountId;
    this.calendar = google.calendar({
      version: 'v3',
      auth: authService.getOAuth2Client(),
    });
  }

  async getUpcomingMeetings(days: number): Promise<MeetingWithProvider[]> {
    try {
      const now = new Date();
      const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      return events.map((event) => this.mapGoogleEventToMeeting(event));
    } catch (error) {
      console.error('Error getting upcoming meetings:', error);
      return [];
    }
  }

  async getMeetingById(id: string): Promise<MeetingWithProvider> {
    const response = await this.calendar.events.get({
      calendarId: 'primary',
      eventId: id,
    });

    return this.mapGoogleEventToMeeting(response.data);
  }

  async findAvailableSlots(duration: number, days: number): Promise<TimeSlot[]> {
    try {
      const now = new Date();
      const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // Get free/busy information
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: 'primary' }],
        },
      });

      const busySlots = response.data.calendars?.primary?.busy || [];
      const availableSlots: TimeSlot[] = [];

      // Generate time slots (9 AM to 5 PM, weekdays only)
      let currentDate = new Date(now);
      currentDate.setHours(9, 0, 0, 0);

      while (currentDate < timeMax) {
        // Skip weekends
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate.setHours(9, 0, 0, 0);
          continue;
        }

        // Check each hour slot
        for (let hour = 9; hour < 17; hour++) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

          // Check if slot is in the past
          if (slotEnd <= now) {
            continue;
          }

          // Check if slot conflicts with busy times
          const isAvailable = !busySlots.some((busy) => {
            const busyStart = new Date(busy.start!);
            const busyEnd = new Date(busy.end!);
            return (
              (slotStart >= busyStart && slotStart < busyEnd) ||
              (slotEnd > busyStart && slotEnd <= busyEnd) ||
              (slotStart <= busyStart && slotEnd >= busyEnd)
            );
          });

          if (isAvailable) {
            availableSlots.push({
              start: slotStart,
              end: slotEnd,
            });
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(9, 0, 0, 0);
      }

      return availableSlots.slice(0, 20); // Return top 20 slots
    } catch (error) {
      console.error('Error finding available slots:', error);
      return [];
    }
  }

  async getMeetingAttendees(meetingId: string): Promise<Attendee[]> {
    try {
      const meeting = await this.getMeetingById(meetingId);
      return meeting.attendees;
    } catch (error) {
      console.error('Error getting meeting attendees:', error);
      return [];
    }
  }

  clearCache(): void {
    console.log('Google Calendar cache cleared (no-op)');
  }

  private mapGoogleEventToMeeting(event: calendar_v3.Schema$Event): MeetingWithProvider {
    const accountInfo = this.authService.getAccountInfo();

    // Parse attendees
    const attendees: Attendee[] = (event.attendees || []).map((attendee) => ({
      emailAddress: {
        name: attendee.displayName || attendee.email || '',
        address: attendee.email || '',
      },
      type: attendee.optional ? 'optional' : 'required',
      status: this.mapResponseStatus(attendee.responseStatus),
    }));

    // Parse organizer
    const organizer = {
      name: event.organizer?.displayName || event.organizer?.email || '',
      address: event.organizer?.email || '',
    };

    // Parse dates
    const start = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
      ? new Date(event.start.date)
      : new Date();

    const end = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
      ? new Date(event.end.date)
      : new Date(start.getTime() + 60 * 60 * 1000);

    // Check for online meeting
    const isOnlineMeeting = !!(event.conferenceData || event.hangoutLink);
    const onlineMeetingUrl =
      event.conferenceData?.entryPoints?.[0]?.uri || event.hangoutLink || undefined;

    return {
      id: event.id || '',
      subject: event.summary || '(No Title)',
      start,
      end,
      location: event.location,
      organizer,
      attendees,
      body: event.description || '',
      isOnlineMeeting,
      onlineMeetingUrl,
      providerType: 'google',
      accountId: this.accountId,
      accountEmail: accountInfo.email,
      metadata: {
        calendarId: 'primary',
        recurringEventId: event.recurringEventId,
        conferenceData: event.conferenceData,
      },
    };
  }

  private mapResponseStatus(
    status?: string | null
  ): 'none' | 'accepted' | 'declined' | 'tentative' {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'tentative';
      default:
        return 'none';
    }
  }
}
