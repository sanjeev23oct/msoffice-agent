import { useCopilotAction } from '@copilotkit/react-core';

export function useAgentActions() {
  // Action: Start agent and authenticate
  useCopilotAction({
    name: 'startAgent',
    description: 'Start the agent and authenticate with Microsoft account',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('http://localhost:3001/agent/start', {
          method: 'POST',
        });
        const data = await response.json();
        
        if (data.success) {
          return 'Agent started successfully! You can now ask me to show your emails, notes, or meetings.';
        }
        
        return data.error || 'Failed to start agent. Please check your Microsoft credentials in the .env file.';
      } catch (error: any) {
        return `Error starting agent: ${error.message}. Make sure your MICROSOFT_CLIENT_ID is configured in the .env file.`;
      }
    },
  });
}

export function useNotesActions() {
  // Action: Search notes
  useCopilotAction({
    name: 'searchNotes',
    description: 'Search notes by keyword or topic across all notebooks',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (keyword or topic to find in notes)',
        required: true,
      },
    ],
    handler: async ({ query }) => {
      try {
        const response = await fetch('http://localhost:3001/api/notes/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await response.json();
        
        if (data.success) {
          const notes = data.notes;
          if (notes.length === 0) {
            return `No notes found matching "${query}"`;
          }
          
          const noteList = notes
            .slice(0, 10)
            .map((note: any, i: number) => 
              `${i + 1}. **${note.title}** (${note.notebookName} > ${note.sectionName})`
            )
            .join('\n');
          
          return `Found ${notes.length} notes matching "${query}":\n\n${noteList}`;
        }
        
        return data.error || 'Failed to search notes';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get client notes
  useCopilotAction({
    name: 'getClientNotes',
    description: 'Get all notes related to a specific client, person, or company',
    parameters: [
      {
        name: 'clientName',
        type: 'string',
        description: 'Name of the client, person, or company',
        required: true,
      },
    ],
    handler: async ({ clientName }) => {
      try {
        const response = await fetch('http://localhost:3001/api/notes/entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityName: clientName, entityType: 'person' }),
        });
        const data = await response.json();
        
        if (data.success) {
          const notes = data.notes;
          if (notes.length === 0) {
            return `No notes found about ${clientName}`;
          }
          
          const noteList = notes
            .map((note: any, i: number) => 
              `${i + 1}. **${note.title}** - Last modified: ${new Date(note.lastModifiedDateTime).toLocaleDateString()}`
            )
            .join('\n');
          
          return `Found ${notes.length} notes about ${clientName}:\n\n${noteList}`;
        }
        
        return data.error || 'Failed to get client notes';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get note content
  useCopilotAction({
    name: 'getNoteContent',
    description: 'Get the full content of a specific note by its ID',
    parameters: [
      {
        name: 'noteId',
        type: 'string',
        description: 'The ID of the note to retrieve',
        required: true,
      },
    ],
    handler: async ({ noteId }) => {
      try {
        const response = await fetch('http://localhost:3001/api/notes/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId }),
        });
        const data = await response.json();
        
        if (data.success) {
          const note = data.note;
          return `**${note.title}**\n\nLocation: ${note.notebookName} > ${note.sectionName}\nLast modified: ${new Date(note.lastModifiedDateTime).toLocaleDateString()}\n\n${note.content}`;
        }
        
        return data.error || 'Failed to get note content';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Find related notes for an email
  useCopilotAction({
    name: 'findRelatedNotes',
    description: 'Find notes related to a specific email based on its content and entities',
    parameters: [
      {
        name: 'emailId',
        type: 'string',
        description: 'The ID of the email to find related notes for',
        required: true,
      },
    ],
    handler: async ({ emailId }) => {
      try {
        const response = await fetch('http://localhost:3001/api/notes/related', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId }),
        });
        const data = await response.json();
        
        if (data.success) {
          const notes = data.notes;
          if (notes.length === 0) {
            return 'No related notes found for this email';
          }
          
          const noteList = notes
            .map((note: any, i: number) => 
              `${i + 1}. **${note.title}** (relevance: ${Math.round(note.relevance * 100)}%)`
            )
            .join('\n');
          
          return `Found ${notes.length} related notes:\n\n${noteList}`;
        }
        
        return data.error || 'Failed to find related notes';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });
}

export function useEmailActions() {
  // Action: Get priority emails
  useCopilotAction({
    name: 'getPriorityEmails',
    description: 'Get high-priority or urgent emails from Outlook inbox',
    parameters: [
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of emails to return (default: 10)',
        required: false,
      },
    ],
    handler: async ({ limit = 10 }) => {
      try {
        const response = await fetch('http://localhost:3001/api/emails/priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit }),
        });
        const data = await response.json();
        
        if (data.success) {
          const emails = data.emails;
          if (emails.length === 0) {
            return 'No priority emails found.';
          }
          
          const emailList = emails
            .map((email: any, i: number) => 
              `${i + 1}. **${email.subject}** from ${email.from.name} (${email.priority})`
            )
            .join('\n');
          
          return `Found ${emails.length} priority emails:\n\n${emailList}`;
        }
        
        return data.error || 'Failed to get priority emails';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Search emails
  useCopilotAction({
    name: 'searchEmails',
    description: 'Search emails by keyword, sender, or subject',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (keyword, sender name, or subject)',
        required: true,
      },
    ],
    handler: async ({ query }) => {
      try {
        const response = await fetch('http://localhost:3001/api/emails/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await response.json();
        
        if (data.success) {
          const emails = data.emails;
          if (emails.length === 0) {
            return `No emails found matching "${query}"`;
          }
          
          const emailList = emails
            .slice(0, 10)
            .map((email: any, i: number) => 
              `${i + 1}. **${email.subject}** from ${email.from.name}`
            )
            .join('\n');
          
          return `Found ${emails.length} emails matching "${query}":\n\n${emailList}`;
        }
        
        return data.error || 'Failed to search emails';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get recent emails
  useCopilotAction({
    name: 'getRecentEmails',
    description: 'Get the most recent emails from Outlook inbox',
    parameters: [
      {
        name: 'count',
        type: 'number',
        description: 'Number of recent emails to retrieve (default: 10)',
        required: false,
      },
    ],
    handler: async ({ count = 10 }) => {
      try {
        const response = await fetch('http://localhost:3001/api/emails/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count }),
        });
        const data = await response.json();
        
        if (data.success) {
          const emails = data.emails;
          if (emails.length === 0) {
            return 'No recent emails found.';
          }
          
          const emailList = emails
            .map((email: any, i: number) => 
              `${i + 1}. **${email.subject}** from ${email.from.name} - ${new Date(email.receivedDateTime).toLocaleDateString()}`
            )
            .join('\n');
          
          return `Your ${emails.length} most recent emails:\n\n${emailList}`;
        }
        
        return data.error || 'Failed to get recent emails';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });
}

export function useMeetingActions() {
  // Action: Get upcoming meetings
  useCopilotAction({
    name: 'getUpcomingMeetings',
    description: 'Get upcoming meetings from Outlook calendar for the next N days',
    parameters: [
      {
        name: 'days',
        type: 'number',
        description: 'Number of days to look ahead (default: 7)',
        required: false,
      },
    ],
    handler: async ({ days = 7 }) => {
      try {
        const response = await fetch('http://localhost:3001/api/meetings/upcoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days }),
        });
        const data = await response.json();
        
        if (data.success) {
          const meetings = data.meetings;
          if (meetings.length === 0) {
            return `No meetings scheduled in the next ${days} days.`;
          }
          
          const meetingList = meetings
            .map((meeting: any, i: number) => {
              const startDate = new Date(meeting.start);
              return `${i + 1}. **${meeting.subject}** - ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            })
            .join('\n');
          
          return `You have ${meetings.length} meetings in the next ${days} days:\n\n${meetingList}`;
        }
        
        return data.error || 'Failed to get upcoming meetings';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get meeting briefing
  useCopilotAction({
    name: 'getMeetingBriefing',
    description: 'Get a detailed briefing for an upcoming meeting with related notes and emails',
    parameters: [
      {
        name: 'meetingId',
        type: 'string',
        description: 'The ID of the meeting to get a briefing for',
        required: true,
      },
    ],
    handler: async ({ meetingId }) => {
      try {
        const response = await fetch('http://localhost:3001/api/meetings/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId }),
        });
        const data = await response.json();
        
        if (data.success) {
          const briefing = data.briefing;
          let result = `**Meeting Briefing: ${briefing.meeting.subject}**\n\n`;
          result += `📅 ${new Date(briefing.meeting.start).toLocaleString()}\n`;
          result += `👥 Attendees: ${briefing.meeting.attendees.length}\n\n`;
          
          if (briefing.relatedNotes.length > 0) {
            result += `📝 Related Notes (${briefing.relatedNotes.length}):\n`;
            briefing.relatedNotes.slice(0, 5).forEach((note: any, i: number) => {
              result += `${i + 1}. ${note.title}\n`;
            });
            result += '\n';
          }
          
          if (briefing.recentEmails.length > 0) {
            result += `📧 Recent Emails (${briefing.recentEmails.length}):\n`;
            briefing.recentEmails.slice(0, 5).forEach((email: any, i: number) => {
              result += `${i + 1}. ${email.subject} from ${email.from.name}\n`;
            });
            result += '\n';
          }
          
          if (briefing.suggestedTopics.length > 0) {
            result += `💡 Suggested Topics:\n`;
            briefing.suggestedTopics.forEach((topic: string, i: number) => {
              result += `• ${topic}\n`;
            });
          }
          
          return result;
        }
        
        return data.error || 'Failed to get meeting briefing';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Find available time slots
  useCopilotAction({
    name: 'findAvailableSlots',
    description: 'Find available time slots in the calendar for scheduling meetings',
    parameters: [
      {
        name: 'duration',
        type: 'number',
        description: 'Meeting duration in minutes (default: 60)',
        required: false,
      },
      {
        name: 'days',
        type: 'number',
        description: 'Number of days to look ahead (default: 7)',
        required: false,
      },
    ],
    handler: async ({ duration = 60, days = 7 }) => {
      try {
        const response = await fetch('http://localhost:3001/api/meetings/available-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration, days }),
        });
        const data = await response.json();
        
        if (data.success) {
          const slots = data.slots;
          if (slots.length === 0) {
            return `No available ${duration}-minute slots found in the next ${days} days.`;
          }
          
          const slotList = slots
            .slice(0, 10)
            .map((slot: any, i: number) => {
              const start = new Date(slot.start);
              const end = new Date(slot.end);
              return `${i + 1}. ${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            })
            .join('\n');
          
          return `Found ${slots.length} available ${duration}-minute slots:\n\n${slotList}`;
        }
        
        return data.error || 'Failed to find available slots';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get meeting context
  useCopilotAction({
    name: 'getMeetingContext',
    description: 'Get context about meeting attendees including recent communications',
    parameters: [
      {
        name: 'meetingId',
        type: 'string',
        description: 'The ID of the meeting',
        required: true,
      },
    ],
    handler: async ({ meetingId }) => {
      try {
        const response = await fetch('http://localhost:3001/api/meetings/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId }),
        });
        const data = await response.json();
        
        if (data.success) {
          const context = data.context;
          let result = `**Meeting Context**\n\n`;
          
          context.attendees.forEach((attendee: any) => {
            result += `👤 **${attendee.name}**\n`;
            if (attendee.recentEmails > 0) {
              result += `  📧 ${attendee.recentEmails} recent emails\n`;
            }
            if (attendee.notes > 0) {
              result += `  📝 ${attendee.notes} related notes\n`;
            }
            result += '\n';
          });
          
          return result;
        }
        
        return data.error || 'Failed to get meeting context';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });
}

export function useInsightsActions() {
  // Action: Get insights
  useCopilotAction({
    name: 'getInsights',
    description: 'Get AI-powered insights and suggestions about emails, meetings, and tasks',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        
        if (data.success) {
          const insights = data.insights;
          if (insights.length === 0) {
            return 'No insights available at the moment.';
          }
          
          const insightList = insights
            .map((insight: any, i: number) => {
              let emoji = '💡';
              if (insight.type === 'follow_up') emoji = '📧';
              if (insight.type === 'deadline') emoji = '⏰';
              if (insight.type === 'pattern') emoji = '📊';
              
              return `${emoji} **${insight.title}**\n   ${insight.description}`;
            })
            .join('\n\n');
          
          return `Here are your insights:\n\n${insightList}`;
        }
        
        return data.error || 'Failed to get insights';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get follow-ups
  useCopilotAction({
    name: 'getFollowUps',
    description: 'Get emails that need follow-up or response',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/insights/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        
        if (data.success) {
          const followups = data.followups;
          if (followups.length === 0) {
            return 'No emails need follow-up right now. Great job staying on top of things!';
          }
          
          const followupList = followups
            .map((item: any, i: number) => 
              `${i + 1}. **${item.subject}** from ${item.from} - ${item.daysWaiting} days ago`
            )
            .join('\n');
          
          return `${followups.length} emails need follow-up:\n\n${followupList}`;
        }
        
        return data.error || 'Failed to get follow-ups';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get deadlines
  useCopilotAction({
    name: 'getDeadlines',
    description: 'Get upcoming deadlines and due dates from emails',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/insights/deadlines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        
        if (data.success) {
          const deadlines = data.deadlines;
          if (deadlines.length === 0) {
            return 'No upcoming deadlines found.';
          }
          
          const deadlineList = deadlines
            .map((item: any, i: number) => {
              const dueDate = new Date(item.dueDate);
              const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              let urgency = '';
              if (daysUntil <= 1) urgency = '🔴 ';
              else if (daysUntil <= 3) urgency = '🟡 ';
              
              return `${urgency}${i + 1}. **${item.description}** - Due ${dueDate.toLocaleDateString()} (${daysUntil} days)`;
            })
            .join('\n');
          
          return `Upcoming deadlines:\n\n${deadlineList}`;
        }
        
        return data.error || 'Failed to get deadlines';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });

  // Action: Get communication patterns
  useCopilotAction({
    name: 'getCommunicationPatterns',
    description: 'Get insights about communication patterns and trends',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/insights/patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        
        if (data.success) {
          const patterns = data.patterns;
          let result = '**Communication Patterns:**\n\n';
          
          if (patterns.topSenders && patterns.topSenders.length > 0) {
            result += '📊 Top Senders:\n';
            patterns.topSenders.slice(0, 5).forEach((sender: any, i: number) => {
              result += `${i + 1}. ${sender.name} (${sender.count} emails)\n`;
            });
            result += '\n';
          }
          
          if (patterns.responseTime) {
            result += `⏱️ Average Response Time: ${patterns.responseTime}\n\n`;
          }
          
          if (patterns.busiestDays && patterns.busiestDays.length > 0) {
            result += '📅 Busiest Days:\n';
            patterns.busiestDays.forEach((day: any) => {
              result += `• ${day.day}: ${day.count} emails\n`;
            });
          }
          
          return result;
        }
        
        return data.error || 'Failed to get communication patterns';
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });
}
