import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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

  const handleAddAccount = () => {
    setShowAccountMenu(true);
  };

  const handleAddOutlook = async () => {
    alert('Outlook account is already connected. To add another Outlook account, please disconnect first.');
    setShowAccountMenu(false);
  };

  const handleAddGmail = async () => {
    alert('Gmail integration is in progress. This feature will be available soon!');
    setShowAccountMenu(false);
  };

  return (
    <div className="header">
      <h1>📧 AI Email Assistant</h1>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <Link to="/settings" style={{ color: 'white', textDecoration: 'none' }}>
          Settings
        </Link>
        
        <div style={{ position: 'relative' }}>
          <button
            onClick={handleAddAccount}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>➕</span>
            <span>Add Account</span>
          </button>

          {showAccountMenu && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'transparent',
                  zIndex: 999,
                }}
                onClick={() => setShowAccountMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  zIndex: 1000,
                }}
              >
                <div style={{ padding: '8px 0' }}>
                  <button
                    onClick={handleAddOutlook}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '14px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    <span style={{ fontSize: '20px' }}>📧</span>
                    <div>
                      <div style={{ fontWeight: '500', color: '#1a1a1a' }}>Outlook</div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>Microsoft 365</div>
                    </div>
                  </button>
                  <button
                    onClick={handleAddGmail}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '14px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    <span style={{ fontSize: '20px' }}>📮</span>
                    <div>
                      <div style={{ fontWeight: '500', color: '#1a1a1a' }}>Gmail</div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>Google Workspace</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

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
