# AI Inbox Organizer - Design Document

## Overview

This design adds AI-powered features to help users organize and manage their inbox more effectively. The system will use the existing LLM service (DeepSeek) to analyze emails and provide intelligent insights, categorization, and actions.

## Architecture

```
┌─────────────────────────────────────────┐
│         Dashboard (React)                │
│  - Smart Views                           │
│  - Category Filters                      │
│  - AI Chat Widget                        │
│  - Action Items Panel                    │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      AI Inbox Service (New)              │
│  - Email Analysis                        │
│  - Categorization                        │
│  - Action Item Extraction                │
│  - Smart Reply Generation                │
│  - Sentiment Analysis                    │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      LLM Service (Existing)              │
│  - DeepSeek API                          │
│  - Prompt Engineering                    │
│  - Response Parsing                      │
└─────────────────────────────────────────┘
```

## Components

### 1. AI Inbox Service

**File**: `src/services/ai-inbox-service.ts`

Main service that orchestrates all AI features:

```typescript
class AIInboxService {
  async analyzeEmail(email: Email): Promise<EmailAnalysis>
  async categorizeEmails(emails: Email[]): Promise<CategorizedEmails>
  async extractActionItems(email: Email): Promise<ActionItem[]>
  async generateSmartReplies(email: Email): Promise<string[]>
  async analyzeSentiment(email: Email): Promise<Sentiment>
  async summarizeEmail(email: Email): Promise<string>
  async summarizeThread(emails: Email[]): Promise<ThreadSummary>
  async suggestBulkActions(emails: Email[]): Promise<BulkAction[]>
}
```

### 2. Email Categories

```typescript
enum EmailCategory {
  URGENT = 'urgent',           // 🔴 Requires immediate action
  IMPORTANT = 'important',     // 🟡 Needs attention soon
  NORMAL = 'normal',           // 🟢 Can wait
  NEWSLETTER = 'newsletter',   // 📰 Promotional/informational
  AUTOMATED = 'automated',     // 🤖 System notifications
}
```

### 3. Smart Views Component

**File**: `src/renderer/components/SmartViews.tsx`

```typescript
interface SmartView {
  id: string;
  name: string;
  icon: string;
  filter: (email: Email) => boolean;
  count: number;
}

const views = [
  { id: 'all', name: 'All Emails', icon: '📥' },
  { id: 'action', name: 'Needs Action', icon: '⚡' },
  { id: 'people', name: 'From People', icon: '👤' },
  { id: 'newsletters', name: 'Newsletters', icon: '📰' },
  { id: 'done', name: 'Done', icon: '✅' },
];
```

### 4. Action Items Panel

**File**: `src/renderer/components/ActionItemsPanel.tsx`

Displays extracted action items from emails:

```typescript
interface ActionItem {
  id: string;
  emailId: string;
  description: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  source: {
    subject: string;
    from: string;
  };
}
```

### 5. AI Chat Widget

**File**: `src/renderer/components/AIChatWidget.tsx`

Floating chat interface for AI assistance:

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

interface ChatAction {
  type: 'filter' | 'archive' | 'mark_read';
  label: string;
  data: any;
}
```

### 6. Email Summary Card

**File**: `src/renderer/components/EmailSummaryCard.tsx`

Shows AI-generated summary and metadata:

```typescript
interface EmailSummary {
  summary: string;
  category: EmailCategory;
  sentiment: Sentiment;
  actionItems: ActionItem[];
  suggestedReplies: string[];
  keyPoints: string[];
}
```

## AI Prompts

### Email Categorization Prompt

```
Analyze this email and categorize it:

Subject: {subject}
From: {from}
Body: {body}

Categories:
- urgent: Requires immediate action, time-sensitive
- important: Needs attention soon, from key people
- normal: Regular email, can wait
- newsletter: Promotional, marketing, subscriptions
- automated: System notifications, no-reply emails

Return JSON: {"category": "...", "reason": "..."}
```

### Action Item Extraction Prompt

```
Extract action items from this email:

{email_content}

For each action item, identify:
- What needs to be done
- When it's due (if mentioned)
- Priority level

Return JSON array of action items.
```

### Smart Reply Generation Prompt

```
Generate 3 quick reply options for this email:

From: {from}
Subject: {subject}
Body: {body}

Replies should be:
- Professional and appropriate
- Brief (1-2 sentences)
- Contextually relevant

Return JSON array of reply strings.
```

### Email Summary Prompt

```
Summarize this email in 2-3 sentences:

{email_content}

Focus on:
- Main purpose
- Key information
- Required actions

Be concise and clear.
```

## UI Design

### Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Header                                    [Chat 💬] │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐  ┌──────────────────────────────┐ │
│  │ Smart Views │  │  Email List                   │ │
│  │             │  │                                │ │
│  │ 📥 All (45) │  │  🔴 [Gmail] Meeting Tomorrow  │ │
│  │ ⚡ Action(8)│  │  Summary: Quick sync needed... │ │
│  │ 👤 People(12│  │  ⚡ Action: Confirm attendance │ │
│  │ 📰 News (20)│  │                                │ │
│  │ ✅ Done (5) │  │  🟡 [Outlook] Project Update  │ │
│  │             │  │  Summary: Progress report...   │ │
│  │ ─────────── │  │                                │ │
│  │ Categories  │  │  🟢 [Gmail] Weekly Newsletter │ │
│  │ 🔴 Urgent(3)│  │  📰 Newsletter                 │ │
│  │ 🟡 Import(5)│  │                                │ │
│  │ 🟢 Normal   │  └────────────────────────────────┘ │
│  │ 📰 News     │                                     │
│  │ 🤖 Auto     │  ┌──────────────────────────────┐ │
│  └─────────────┘  │  Action Items Today          │ │
│                    │  ⚡ Confirm meeting - 2pm    │ │
│                    │  ⚡ Review document - EOD    │ │
│                    │  ⚡ Reply to John - Urgent   │ │
│                    └──────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Email Detail View

```
┌─────────────────────────────────────────────────────┐
│  🔴 Urgent  📧 Outlook  😊 Positive                  │
│                                                       │
│  Meeting Tomorrow - Project Kickoff                  │
│  From: John Smith <john@company.com>                 │
│  To: Me                                              │
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │ 🤖 AI Summary                                    ││
│  │ John is requesting a meeting tomorrow at 2pm to  ││
│  │ discuss the new project kickoff. He needs        ││
│  │ confirmation of attendance and agenda items.     ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │ ⚡ Action Items                                  ││
│  │ □ Confirm attendance by EOD                      ││
│  │ □ Prepare agenda items                           ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │ 💬 Smart Replies                                 ││
│  │ • "I'll be there. Looking forward to it!"        ││
│  │ • "Confirmed. I'll prepare some agenda items."   ││
│  │ • "Can we reschedule? I have a conflict."        ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  [Full Email Content...]                             │
└─────────────────────────────────────────────────────┘
```

### AI Chat Widget

```
┌─────────────────────────────┐
│  💬 AI Assistant            │
├─────────────────────────────┤
│                             │
│  You: Show urgent emails    │
│                             │
│  AI: I found 3 urgent       │
│  emails:                    │
│  1. Meeting Tomorrow        │
│  2. Budget Approval         │
│  3. Client Issue            │
│                             │
│  [View Emails] [Archive All]│
│                             │
│  You: What do I need to do? │
│                             │
│  AI: You have 8 action      │
│  items today:               │
│  - Confirm meeting (2pm)    │
│  - Review budget (EOD)      │
│  - Reply to client (Urgent) │
│  ...                        │
│                             │
├─────────────────────────────┤
│  [Type a message...]    [→] │
└─────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core AI Analysis (Week 1)
1. Create AIInboxService
2. Implement email categorization
3. Add category badges to email list
4. Create category filters

### Phase 2: Action Items (Week 2)
1. Implement action item extraction
2. Create ActionItemsPanel component
3. Add action item completion tracking
4. Show action items in email detail

### Phase 3: Smart Features (Week 3)
1. Implement email summarization
2. Add sentiment analysis
3. Create smart reply suggestions
4. Add EmailSummaryCard component

### Phase 4: Smart Views (Week 4)
1. Create SmartViews component
2. Implement view filtering logic
3. Add view counts
4. Create focus mode

### Phase 5: AI Chat (Week 5)
1. Create AIChatWidget component
2. Implement chat interface
3. Add natural language processing
4. Integrate with email actions

### Phase 6: Polish & Optimization (Week 6)
1. Add loading states
2. Implement caching
3. Optimize AI calls
4. Add error handling
5. User testing and feedback

## Performance Considerations

1. **Batch Processing**: Analyze multiple emails in one AI call
2. **Caching**: Cache AI analysis results
3. **Lazy Loading**: Analyze emails on-demand
4. **Background Processing**: Analyze in background thread
5. **Rate Limiting**: Respect LLM API limits

## Success Metrics

- **Time Saved**: Measure time to process inbox
- **Action Completion**: Track action item completion rate
- **User Engagement**: Monitor feature usage
- **Accuracy**: Measure categorization accuracy
- **Satisfaction**: User feedback scores

