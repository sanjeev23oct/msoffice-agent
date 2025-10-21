import React from 'react';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      setIsConnected(data.authenticated);
    } catch (err) {
      console.error('Error checking connection:', err);
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
        // Poll for authentication status
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
          setAuthMessage('✅ Successfully connected to Microsoft!');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling auth status:', err);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Dashboard</h2>

      {!isConnected && !isConnecting && (
        <div
          style={{
            background: '#f0f8ff',
            border: '2px solid #0078d4',
            borderRadius: '8px',
            padding: '24px',
            marginTop: '20px',
            textAlign: 'center',
          }}
        >
          <h3>Connect to Microsoft</h3>
          <p>Connect your Outlook and OneNote to get started</p>
          <button
            onClick={handleConnect}
            style={{
              background: '#0078d4',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              fontSize: '16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '12px',
            }}
          >
            Connect to Microsoft Account
          </button>
        </div>
      )}

      {isConnecting && (
        <div
          style={{
            background: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            padding: '24px',
            marginTop: '20px',
          }}
        >
          <h3>🔐 Authentication in Progress</h3>
          <p>{authMessage}</p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '12px' }}>
            <strong>Steps:</strong>
            <br />
            1. Check your terminal for the device code
            <br />
            2. Visit{' '}
            <a href="https://microsoft.com/devicelogin" target="_blank" rel="noopener noreferrer">
              https://microsoft.com/devicelogin
            </a>
            <br />
            3. Enter the code and sign in
            <br />
            4. This page will update automatically once connected
          </p>
        </div>
      )}

      {isConnected && (
        <div
          style={{
            background: '#d4edda',
            border: '2px solid #28a745',
            borderRadius: '8px',
            padding: '24px',
            marginTop: '20px',
          }}
        >
          <h3>✅ Connected to Microsoft</h3>
          <p>You can now use the AI assistant to:</p>
          <ul style={{ textAlign: 'left', marginTop: '12px' }}>
            <li>View your priority emails</li>
            <li>Search your emails</li>
            <li>Find notes in OneNote</li>
            <li>Check your calendar</li>
          </ul>
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
            Try asking in the chat: "Show me my priority emails"
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#f8d7da',
            border: '2px solid #dc3545',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '20px',
            color: '#721c24',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
