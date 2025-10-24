import { useState, useEffect } from 'react';
import { AccountInfo } from '../../models/provider.types';

interface AccountSelectorProps {
  onAccountChange?: (accountId: string | null) => void;
}

export default function AccountSelector({ onAccountChange }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load accounts from backend
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/accounts');
      const data = await response.json();
      if (data.success) {
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const handleAccountSelect = (accountId: string | null) => {
    setSelectedAccountId(accountId);
    setIsOpen(false);
    if (onAccountChange) {
      onAccountChange(accountId);
    }
    // Save to local storage
    if (accountId) {
      localStorage.setItem('selectedAccountId', accountId);
    } else {
      localStorage.removeItem('selectedAccountId');
    }
  };

  const getSelectedAccount = () => {
    if (!selectedAccountId) return null;
    return accounts.find((acc) => acc.id === selectedAccountId);
  };

  const getProviderIcon = (providerType: string) => {
    return providerType === 'microsoft' ? '📧' : '📮';
  };

  const selectedAccount = getSelectedAccount();

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          minWidth: '180px',
        }}
      >
        {selectedAccount ? (
          <>
            <span>{getProviderIcon(selectedAccount.providerType)}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{selectedAccount.email}</span>
          </>
        ) : (
          <>
            <span>📬</span>
            <span style={{ flex: 1, textAlign: 'left' }}>All Accounts</span>
          </>
        )}
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>

      {isOpen && (
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
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '100%',
              zIndex: 1000,
            }}
          >
            <div style={{ padding: '4px 0' }}>
              <button
                onClick={() => handleAccountSelect(null)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: !selectedAccountId ? '#f8f9fa' : 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  if (!selectedAccountId) return;
                  e.currentTarget.style.background = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  if (!selectedAccountId) return;
                  e.currentTarget.style.background = 'white';
                }}
              >
                <span>📬</span>
                <span>All Accounts</span>
              </button>

              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleAccountSelect(account.id)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    background: selectedAccountId === account.id ? '#f8f9fa' : 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedAccountId === account.id) return;
                    e.currentTarget.style.background = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedAccountId === account.id) return;
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <span>{getProviderIcon(account.providerType)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500' }}>{account.name}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>{account.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
