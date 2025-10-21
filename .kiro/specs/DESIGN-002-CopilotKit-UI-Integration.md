# Design Pattern: CopilotKit UI Integration

**Pattern ID:** DESIGN-002  
**Category:** Frontend / Conversational UI  
**Use Case:** Any application requiring conversational AI interface  
**Last Updated:** 2025-01-20

---

## Overview

A standardized pattern for integrating CopilotKit into React applications, providing conversational AI capabilities with custom actions, context management, and real-time updates.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │              CopilotKit Provider                  │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │  │
│  │  │  Actions   │  │  Context   │  │   Chat UI  │ │  │
│  │  │  Registry  │  │  Manager   │  │            │ │  │
│  │  └────────────┘  └────────────┘  └────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│                  CopilotKit Runtime                      │
│                  (Backend Server)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  LLM Client  │  │  Action      │  │  Context     │ │
│  │              │  │  Executor    │  │  Provider    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. App Setup with CopilotKit Provider

**Purpose:** Initialize CopilotKit in your React app

**Implementation:**
```typescript
// App.tsx
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

export default function App() {
  return (
    <CopilotKit 
      runtimeUrl="http://localhost:3001/copilotkit"
      // Optional: Custom headers
      headers={{
        'Authorization': `Bearer ${token}`,
      }}
    >
      <div className="app-container">
        {/* Your app content */}
        <MainContent />
        
        {/* CopilotKit Chat UI */}
        <CopilotChat
          labels={{
            title: 'AI Assistant',
            initial: 'Hi! How can I help you today?',
            placeholder: 'Ask me anything...',
          }}
          // Optional: Custom styling
          className="custom-chat"
        />
      </div>
    </CopilotKit>
  );
}
```

### 2. Custom Actions

**Purpose:** Define what the AI can do in your app

**Pattern:**
```typescript
// hooks/useCopilotActions.ts
import { useCopilotAction } from '@copilotkit/react-core';

export function useMyActions() {
  // Action 1: Simple data retrieval
  useCopilotAction({
    name: 'getData',
    description: 'Retrieve data based on user query',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: true,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of results',
        required: false,
      },
    ],
    handler: async ({ query, limit = 10 }) => {
      const results = await fetchData(query, limit);
      return `Found ${results.length} results for "${query}"`;
    },
  });

  // Action 2: Complex operation with state update
  useCopilotAction({
    name: 'processData',
    description: 'Process data and update UI',
    parameters: [
      {
        name: 'data',
        type: 'object',
        description: 'Data to process',
        required: true,
      },
    ],
    handler: async ({ data }) => {
      // Process data
      const processed = await processData(data);
      
      // Update app state
      updateAppState(processed);
      
      // Return user-friendly message
      return `Processed ${processed.items.length} items successfully`;
    },
  });

  // Action 3: Multi-step operation
  useCopilotAction({
    name: 'multiStepTask',
    description: 'Perform a multi-step task',
    parameters: [
      {
        name: 'steps',
        type: 'array',
        description: 'Steps to execute',
        required: true,
      },
    ],
    handler: async ({ steps }) => {
      const results = [];
      
      for (const step of steps) {
        const result = await executeStep(step);
        results.push(result);
        
        // Optional: Send progress updates
        sendProgressUpdate(`Completed step: ${step.name}`);
      }
      
      return `Completed all ${steps.length} steps`;
    },
  });
}
```

**Action Types Reference:**
```typescript
// Parameter types
type ParameterType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'object' 
  | 'array';

interface ActionParameter {
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  enum?: string[]; // For limited choices
  default?: any;   // Default value
}

// Action definition
interface CopilotAction {
  name: string;
  description: string;
  parameters: ActionParameter[];
  handler: (params: any) => Promise<string | void>;
  render?: (props: any) => React.ReactNode; // Optional custom rendering
}
```

### 3. Context Management

**Purpose:** Provide AI with app state and user context

**Implementation:**
```typescript
// hooks/useCopilotContext.ts
import { useCopilotReadable, useCopilotContext } from '@copilotkit/react-core';

export function useAppContext() {
  const [appState, setAppState] = useState({
    user: null,
    currentPage: 'home',
    selectedItems: [],
  });

  // Make state readable to AI
  useCopilotReadable({
    description: 'Current application state',
    value: appState,
  });

  // Make user profile readable
  useCopilotReadable({
    description: 'User profile and preferences',
    value: {
      name: appState.user?.name,
      preferences: appState.user?.preferences,
      history: appState.user?.recentActions,
    },
  });

  // Make current context readable
  useCopilotReadable({
    description: 'Current page and selected items',
    value: {
      page: appState.currentPage,
      selectedCount: appState.selectedItems.length,
      selectedIds: appState.selectedItems.map(item => item.id),
    },
  });

  return { appState, setAppState };
}
```

**Context Best Practices:**
```typescript
// ✅ Good: Specific, relevant context
useCopilotReadable({
  description: 'User shopping cart with 3 items totaling $45.99',
  value: {
    itemCount: cart.items.length,
    total: cart.total,
    items: cart.items.map(i => ({ name: i.name, price: i.price })),
  },
});

// ❌ Bad: Too much irrelevant data
useCopilotReadable({
  description: 'Everything',
  value: entireAppState, // Too much data
});
```

### 4. Custom Chat UI

**Purpose:** Customize the chat interface

**Implementation:**
```typescript
// components/CustomChat.tsx
import { CopilotChat } from '@copilotkit/react-ui';
import { useCopilotChat } from '@copilotkit/react-core';

export function CustomChat() {
  const { messages, sendMessage, isLoading } = useCopilotChat();

  return (
    <div className="custom-chat-container">
      {/* Custom header */}
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <button onClick={clearChat}>Clear</button>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* Custom input */}
      <div className="chat-input">
        <input
          type="text"
          placeholder="Ask me anything..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              sendMessage(e.target.value);
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
```

### 5. Action Rendering

**Purpose:** Custom UI for action results

**Implementation:**
```typescript
useCopilotAction({
  name: 'showChart',
  description: 'Display data as a chart',
  parameters: [
    {
      name: 'data',
      type: 'array',
      description: 'Chart data',
      required: true,
    },
  ],
  handler: async ({ data }) => {
    return 'Chart displayed';
  },
  // Custom rendering
  render: ({ status, result, args }) => {
    if (status === 'executing') {
      return <div>Loading chart...</div>;
    }
    
    if (status === 'complete') {
      return <Chart data={args.data} />;
    }
    
    return null;
  },
});
```

## Common Patterns

### Pattern 1: Search and Display

```typescript
export function useSearchAction() {
  const [results, setResults] = useState([]);

  useCopilotAction({
    name: 'search',
    description: 'Search for items',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: true,
      },
    ],
    handler: async ({ query }) => {
      const data = await api.search(query);
      setResults(data);
      return `Found ${data.length} results`;
    },
  });

  return results;
}
```

### Pattern 2: Form Filling

```typescript
export function useFormAction() {
  const [formData, setFormData] = useState({});

  useCopilotAction({
    name: 'fillForm',
    description: 'Fill form with provided data',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'User name',
        required: true,
      },
      {
        name: 'email',
        type: 'string',
        description: 'Email address',
        required: true,
      },
    ],
    handler: async ({ name, email }) => {
      setFormData({ name, email });
      return 'Form filled successfully';
    },
  });

  return formData;
}
```

### Pattern 3: Navigation

```typescript
export function useNavigationAction() {
  const navigate = useNavigate();

  useCopilotAction({
    name: 'navigateTo',
    description: 'Navigate to a page',
    parameters: [
      {
        name: 'page',
        type: 'string',
        description: 'Page to navigate to',
        required: true,
        enum: ['home', 'profile', 'settings', 'dashboard'],
      },
    ],
    handler: async ({ page }) => {
      navigate(`/${page}`);
      return `Navigated to ${page}`;
    },
  });
}
```

### Pattern 4: Data Visualization

```typescript
export function useVisualizationAction() {
  const [chartData, setChartData] = useState(null);

  useCopilotAction({
    name: 'visualizeData',
    description: 'Create a visualization from data',
    parameters: [
      {
        name: 'data',
        type: 'array',
        description: 'Data to visualize',
        required: true,
      },
      {
        name: 'chartType',
        type: 'string',
        description: 'Type of chart',
        required: true,
        enum: ['bar', 'line', 'pie', 'scatter'],
      },
    ],
    handler: async ({ data, chartType }) => {
      setChartData({ data, type: chartType });
      return `Created ${chartType} chart with ${data.length} data points`;
    },
  });

  return chartData;
}
```

## Backend Runtime Setup

**Purpose:** Configure CopilotKit runtime on server

**Implementation:**
```javascript
// server/copilotkit-runtime.js
import express from 'express';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';
import { createLLMClient } from './config/llm-config.js';

export function setupCopilotKitRuntime(app) {
  // Create LLM client
  const llmClient = createLLMClient();

  // Create adapter
  const serviceAdapter = new OpenAIAdapter({
    model: process.env.OPENAI_MODEL || 'gpt-4',
    openai: llmClient,
  });

  // Create runtime
  const runtime = new CopilotRuntime();

  // Mount endpoint
  app.use(
    '/copilotkit',
    copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilotkit',
      runtime,
      serviceAdapter,
    })
  );

  console.log('✅ CopilotKit runtime configured');
}
```

## Styling

**Custom CSS:**
```css
/* Custom chat styling */
.custom-chat {
  --copilot-kit-primary-color: #007bff;
  --copilot-kit-background-color: #ffffff;
  --copilot-kit-text-color: #333333;
  --copilot-kit-border-radius: 8px;
}

/* Position chat */
.copilot-chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 600px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Custom message styling */
.copilot-message {
  padding: 12px;
  margin: 8px 0;
  border-radius: 8px;
}

.copilot-message.user {
  background-color: #007bff;
  color: white;
  margin-left: auto;
}

.copilot-message.assistant {
  background-color: #f1f1f1;
  color: #333;
}
```

## Best Practices

### 1. Clear Action Descriptions

```typescript
// ❌ Bad
useCopilotAction({
  name: 'doThing',
  description: 'Does something',
  // ...
});

// ✅ Good
useCopilotAction({
  name: 'searchProducts',
  description: 'Search for products by name, category, or price range. Returns up to 20 results.',
  // ...
});
```

### 2. Validate Parameters

```typescript
handler: async ({ email, age }) => {
  // Validate email
  if (!email.includes('@')) {
    return 'Invalid email address';
  }
  
  // Validate age
  if (age < 0 || age > 150) {
    return 'Invalid age';
  }
  
  // Process...
}
```

### 3. Provide Helpful Feedback

```typescript
handler: async ({ query }) => {
  if (!query) {
    return 'Please provide a search query';
  }
  
  const results = await search(query);
  
  if (results.length === 0) {
    return `No results found for "${query}". Try a different search term.`;
  }
  
  return `Found ${results.length} results for "${query}"`;
}
```

### 4. Handle Errors Gracefully

```typescript
handler: async ({ id }) => {
  try {
    const data = await fetchData(id);
    return `Retrieved data for ID ${id}`;
  } catch (error) {
    console.error('Error fetching data:', error);
    return 'Sorry, I couldn\'t retrieve that data. Please try again.';
  }
}
```

### 5. Use Enums for Limited Choices

```typescript
parameters: [
  {
    name: 'priority',
    type: 'string',
    description: 'Task priority',
    required: true,
    enum: ['low', 'medium', 'high', 'urgent'],
  },
]
```

## Testing

### Mock CopilotKit

```typescript
// test/mocks/copilotkit-mock.tsx
export function MockCopilotKit({ children }) {
  return (
    <div data-testid="mock-copilotkit">
      {children}
    </div>
  );
}

export function mockUseCopilotAction() {
  return jest.fn();
}
```

### Test Actions

```typescript
describe('Search Action', () => {
  it('should search and return results', async () => {
    const { result } = renderHook(() => useSearchAction());
    
    await act(async () => {
      const response = await result.current.handler({ query: 'test' });
      expect(response).toContain('Found');
    });
  });
});
```

## Deployment Checklist

- [ ] CopilotKit runtime URL configured
- [ ] Actions registered and tested
- [ ] Context providers implemented
- [ ] Error handling in place
- [ ] Custom styling applied
- [ ] Backend runtime configured
- [ ] CORS configured for production
- [ ] Rate limiting implemented

## References

- CopilotKit Docs: https://docs.copilotkit.ai
- React Hooks: https://react.dev/reference/react
- TypeScript: https://www.typescriptlang.org/docs

---

**Previous:** [DESIGN-001-LLM-Server-Integration.md](./DESIGN-001-LLM-Server-Integration.md)  
**Next:** [DESIGN-003-WebSocket-Real-Time-Communication.md](./DESIGN-003-WebSocket-Real-Time-Communication.md)
