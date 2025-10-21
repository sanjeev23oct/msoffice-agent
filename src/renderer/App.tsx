import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import './App.css';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Header from './components/Header';
import { useAgentActions, useEmailActions } from './hooks/useCopilotActions';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeAgent();
  }, []);

  const initializeAgent = async () => {
    try {
      const response = await fetch('http://localhost:3001/agent/initialize', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setIsInitialized(true);
      } else {
        setError(data.error || 'Failed to initialize agent');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
    }
  };

  if (error) {
    return (
      <div className="app-container">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={initializeAgent}>Retry</button>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="app-container">
        <div className="loading">Initializing agent...</div>
      </div>
    );
  }

  return (
    <CopilotKit runtimeUrl="http://localhost:3001/copilotkit">
      <AppContent />
    </CopilotKit>
  );
}

function AppContent() {
  // Register CopilotKit actions
  useAgentActions();
  useEmailActions();

  return (
    <Router>
      <div className="app-container">
        <div className="main-content">
          <Header />
          <div className="content-area">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
        <CopilotChat
          labels={{
            title: 'Outlook-OneNote AI Assistant',
            initial:
              'Hi! I can help you manage emails, find notes, and prepare for meetings. Try asking:\n\n• "Show me my priority emails"\n• "Search for emails from [name]"\n• "Get my recent emails"',
            placeholder: 'Ask me anything...',
          }}
          className="copilot-chat"
        />
      </div>
    </Router>
  );
}
