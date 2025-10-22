import { useState, useEffect } from 'react';
import './Dashboard.css';

interface Email {
  id: string;
  subject: string;
  from: { name: string; address: string };
  receivedDateTime: string;
  isRead: boolean;
  priority?: string;
}

interface Meeting {
  id: string;
  subject: string;
  start: string;
  end: string;
  attendees: any[];
}

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
}

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [error, setError] = useState('');
  const [priorityEmails, setPriorityEmails] = useState<Email[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('User');
  const [lastSync, setLastSync] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 120000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      setIsConnected(data.authenticated);
      if (data.userName) {
        setUserName(data.userName);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const emailsRes = await fetch('http://localhost:3001/api/emails/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 5 }),
      });
      const emailsData = await emailsRes.json();
      if (emailsData.success) {
        setPriorityEmails(emailsData.emails || []);
      }

      const meetingsRes = await fetch('http://localhost:3001/api/meetings/upcoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 3 }),
      });
      const meetingsData = await meetingsRes.json();
      if (meetingsData.success) {
        setUpcomingMeetings((meetingsData.meetings || []).slice(0, 5));
      }

      const insightsRes = await fetch('http://localhost:3001/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const insightsData = await insightsRes.json();
      if (insightsData.success) {
        setInsights((insightsData.insights || []).slice(0, 5));
      }

      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');
    setAuthMessage('Starting authentication...');

    try {
      const response = await fetch('http://localhost:3001/agent/start', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setAuthMessage(
          '✅ Authentication started! Check your terminal for the device code, then visit https://microsoft.com/devicelogin to sign in.'
        );
        pollAuthStatus();
      } else {
        setError(data.error || 'Failed to start authentication');
        setIsConnecting(false);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      setIsConnecting(false);
    }
  };

  const pollAuthStatus = () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:3001/health');
        const data = await response.json();
        if (data.authenticated) {
          setIsConnected(true);
          setIsConnecting(false);
          setAuthMessage('');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling auth status:', err);
      }
    }, 3000);

    setTimeout(() => clearInterval(interval), 300000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good morning';
    if (hour < 18) return '☀️ Good afternoon';
    return '🌙 Good evening';
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'high') return '🔴';
    if (priority === 'medium') return '🟡';
    return '🟢';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return '#dc3545';
    if (priority === 'medium') return '#ffc107';
    return '#28a745';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const formatMeetingTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 60) return `in ${diffMins} min`;
    if (diffHours < 24) return `Today at ${time}`;
    if (diffHours < 48) return `Tomorrow at ${time}`;
    return date.toLocaleDateString() + ' at ' + time;
  };

  // Welcome Screen
  if (!isConnected && !isConnecting) {
    return (
      <div className="dashboard-container">
        <div className="welcome-screen">
          <div className="welcome-icon">📧</div>
          <h1>Your AI Email & Meeting Assistant</h1>
          <div className="value-props">
            <div className="value-prop">
              <span className="prop-icon">✨</span>
              <span>Never miss important emails</span>
            </div>
            <div className="value-prop">
              <span className="prop-icon">📅</span>
              <span>Be prepared for every meeting</span>
            </div>
            <div className="value-prop">
              <span className="prop-icon">🔍</span>
              <span>Find notes in seconds</span>
            </div>
            <div className="value-prop">
              <span className="prop-icon">🤖</span>
              <span>AI-powered insights</span>
            </div>
          </div>
          
          <div style={{ marginTop: '32px', marginBottom: '16px' }}>
            <p style={{ fontSize: '16px', color: '#6c757d', marginBottom: '24px' }}>
              Choose your email provider to get started:
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={handleConnect}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>📧</span>
                <span>Connect Outlook</span>
              </button>
              <button 
                className="btn-primary" 
                onClick={() => alert('Gmail integration coming soon!')}
                style={{ 
                  background: '#EA4335',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px' 
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#d33426')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#EA4335')}
              >
                <span>📮</span>
                <span>Connect Gmail</span>
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '16px', fontStyle: 'italic' }}>
              You can connect multiple accounts later
            </p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  // Connecting Screen
  if (isConnecting) {
    return (
      <div className="dashboard-container">
        <div className="connecting-screen">
          <h2>🔐 Connecting to Microsoft</h2>
          <p className="auth-message">{authMessage}</p>
          <div className="auth-steps">
            <h3>Follow these steps:</h3>
            <ol>
              <li>Check your terminal for the device code</li>
              <li>
                Visit{' '}
                <a href="https://microsoft.com/devicelogin" target="_blank" rel="noopener noreferrer">
                  microsoft.com/devicelogin
                </a>
              </li>
              <li>Enter the code and sign in</li>
              <li>This page will update automatically</li>
            </ol>
          </div>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  const urgentCount = priorityEmails.filter((e) => e.priority === 'high').length;
  const importantCount = priorityEmails.filter((e) => e.priority === 'medium').length;
  const normalCount = priorityEmails.filter((e) => e.priority === 'low').length;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="greeting">
            {getGreeting()}, {userName}!
          </h1>
          <p className="sync-status">Last sync: {lastSync || 'Never'}</p>
        </div>
        <button className="btn-refresh" onClick={loadDashboardData} disabled={loading}>
          {loading ? '⏳ Syncing...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Priority Inbox Card */}
        <div className="dashboard-card priority-inbox-card">
          <div className="card-header">
            <h2>📬 Priority Inbox</h2>
            {priorityEmails.length > 0 && <span className="badge badge-red">{priorityEmails.length}</span>}
          </div>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : priorityEmails.length === 0 ? (
            <div className="empty-state">
              <p>🎉 No priority emails</p>
              <span className="empty-subtitle">You're all caught up!</span>
            </div>
          ) : (
            <>
              <div className="priority-summary">
                <div className="priority-stat">
                  <span className="stat-icon">🔴</span>
                  <span className="stat-count">{urgentCount}</span>
                  <span className="stat-label">Urgent</span>
                </div>
                <div className="priority-stat">
                  <span className="stat-icon">🟡</span>
                  <span className="stat-count">{importantCount}</span>
                  <span className="stat-label">Important</span>
                </div>
                <div className="priority-stat">
                  <span className="stat-icon">🟢</span>
                  <span className="stat-count">{normalCount}</span>
                  <span className="stat-label">Normal</span>
                </div>
              </div>

              <div className="email-list">
                {priorityEmails.slice(0, 3).map((email) => (
                  <div key={email.id} className="email-item" style={{ borderLeftColor: getPriorityColor(email.priority || 'low') }}>
                    <div className="email-header">
                      <span className="priority-icon">{getPriorityIcon(email.priority || 'low')}</span>
                      <span className="email-subject">{email.subject}</span>
                    </div>
                    <div className="email-meta">
                      <span className="email-from">From: {email.from.name}</span>
                      <span className="email-time">{formatTimeAgo(email.receivedDateTime)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn-link">View All Priority Emails →</button>
            </>
          )}
        </div>

        {/* Today's Meetings Card */}
        <div className="dashboard-card meetings-card">
          <div className="card-header">
            <h2>📅 Today's Meetings</h2>
            {upcomingMeetings.length > 0 && <span className="badge badge-blue">{upcomingMeetings.length}</span>}
          </div>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="empty-state">
              <p>📅 No meetings scheduled</p>
              <span className="empty-subtitle">Enjoy your meeting-free day!</span>
            </div>
          ) : (
            <>
              <div className="meeting-list">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="meeting-item">
                    <div className="meeting-time-badge">{formatMeetingTime(meeting.start)}</div>
                    <div className="meeting-details">
                      <div className="meeting-subject">{meeting.subject}</div>
                      <div className="meeting-meta">
                        <span>👥 {meeting.attendees.length} attendees</span>
                        <span className="brief-status">✅ Brief ready</span>
                      </div>
                    </div>
                    <button className="btn-small">View Brief</button>
                  </div>
                ))}
              </div>

              <button className="btn-link">View Full Calendar →</button>
            </>
          )}
        </div>

        {/* AI Insights Card */}
        <div className="dashboard-card insights-card">
          <div className="card-header">
            <h2>💡 AI Insights</h2>
          </div>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : insights.length === 0 ? (
            <div className="empty-state">
              <p>💡 No insights yet</p>
              <span className="empty-subtitle">Check back soon for AI-powered suggestions</span>
            </div>
          ) : (
            <>
              <div className="insight-list">
                {insights.map((insight) => (
                  <div key={insight.id} className="insight-item" style={{ borderLeftColor: getPriorityColor(insight.priority) }}>
                    <div className="insight-title">{insight.title}</div>
                    <div className="insight-description">{insight.description}</div>
                  </div>
                ))}
              </div>

              <button className="btn-link">View All Insights →</button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-card quick-actions-card">
        <h2>⚡ Quick Actions</h2>
        <div className="quick-actions">
          <button className="action-btn" onClick={loadDashboardData}>
            <span className="action-icon">🔄</span>
            <span>Refresh</span>
          </button>
          <button className="action-btn" onClick={() => window.open('https://outlook.office.com/mail/', '_blank')}>
            <span className="action-icon">📧</span>
            <span>Open Outlook</span>
          </button>
          <button className="action-btn" onClick={() => window.open('https://outlook.office.com/calendar/', '_blank')}>
            <span className="action-icon">📅</span>
            <span>Open Calendar</span>
          </button>
          <button className="action-btn">
            <span className="action-icon">📝</span>
            <span>Search Notes</span>
          </button>
        </div>
      </div>

      {/* Help Message */}
      {priorityEmails.length === 0 && upcomingMeetings.length === 0 && insights.length === 0 && !loading && (
        <div className="help-card">
          <h3>🎉 You're all set!</h3>
          <p>Your account is connected. Use the AI chat on the right to interact with your emails, notes, and calendar.</p>
          <p className="help-examples">
            <strong>Try asking:</strong>
            <br />• "Show me my priority emails"
            <br />• "What meetings do I have today?"
            <br />• "Search notes about [topic]"
          </p>
        </div>
      )}
    </div>
  );
}
