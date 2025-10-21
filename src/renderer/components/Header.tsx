import React from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3001/agent/logout', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('Logged out successfully! Please restart the app.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error logging out. Please try again.');
    }
  };

  return (
    <div className="header">
      <h1>Outlook-OneNote AI Agent</h1>
      <nav>
        <Link to="/" style={{ color: 'white', marginRight: '16px' }}>
          Dashboard
        </Link>
        <Link to="/settings" style={{ color: 'white', marginRight: '16px' }}>
          Settings
        </Link>
        <button
          onClick={handleLogout}
          style={{
            background: '#d32f2f',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </nav>
    </div>
  );
}
