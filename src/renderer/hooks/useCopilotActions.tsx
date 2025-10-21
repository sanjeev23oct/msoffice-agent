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
