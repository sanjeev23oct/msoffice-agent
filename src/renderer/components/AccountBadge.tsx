import { ProviderType } from '../../models/provider.types';

interface AccountBadgeProps {
  providerType: ProviderType;
  accountEmail: string;
}

export default function AccountBadge({ providerType, accountEmail }: AccountBadgeProps) {
  const getProviderIcon = () => {
    return providerType === 'microsoft' ? '📧' : '📮';
  };

  const getProviderColor = () => {
    return providerType === 'microsoft' ? '#0078d4' : '#ea4335';
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        background: `${getProviderColor()}15`,
        border: `1px solid ${getProviderColor()}30`,
        fontSize: '12px',
      }}
      title={accountEmail}
    >
      <span style={{ fontSize: '14px' }}>{getProviderIcon()}</span>
      <span style={{ color: getProviderColor(), fontWeight: '500' }}>
        {providerType === 'microsoft' ? 'Outlook' : 'Gmail'}
      </span>
    </div>
  );
}
